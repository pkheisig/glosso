// content.js (v2 Refactor)
const tooltip = document.createElement('div');
tooltip.id = 'word-lookup-tooltip';
document.body.appendChild(tooltip);

let cache = new Map();
let hideTimeout, showTimeout;
let lastHoveredWord = null;
let currentLang = 'auto'; // Default, updated on init

// Regex patterns (Restricted Unicode: Latin, Cyrillic, Greek)
// Excludes Asian scripts (Han, Kana, etc.) which require special segmentation.
const wordRegex = /[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}\p{M}\u0027\u2019\-\u00AD]{2,}/gu;

// UI Logic
let isEnabled = false;
let highlightEnabled = true;

function init() {
  chrome.storage.sync.get(['enabled', 'language', 'highlightWords'], (data) => {
    currentLang = data.language;
    // Fix: If 'en' was stored or language is missing, default to 'auto'
    if (!currentLang || currentLang === 'en') {
        currentLang = 'auto';
        // Optional: Correct the storage to avoid future checks
        chrome.storage.sync.set({ language: 'auto' });
    }
    
    highlightEnabled = data.highlightWords !== false;
    if (data.enabled !== false) {
      enableExtension();
    }
  });

  // Listen for dynamic toggle changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.enabled) {
      if (changes.enabled.newValue) {
        enableExtension();
      } else {
        disableExtension();
      }
    }
    if (namespace === 'sync' && changes.language) {
        currentLang = changes.language.newValue;
        // Optionally re-highlight or just update for next interaction
    }
    if (namespace === 'sync' && changes.highlightWords) {
        highlightEnabled = changes.highlightWords.newValue;
        if (isEnabled) {
            const marks = document.querySelectorAll('.rl-highlight');
            marks.forEach(m => {
                if (highlightEnabled) m.classList.remove('rl-hide-underline');
                else m.classList.add('rl-hide-underline');
            });
        }
    }
  });
}

function enableExtension() {
  if (isEnabled) return;
  isEnabled = true;
  highlightWords();
  document.addEventListener('mouseup', handleSelection);
  document.addEventListener('mousemove', handleMouseMove);
}

function disableExtension() {
  if (!isEnabled) return;
  isEnabled = false;
  removeHighlights();
  document.removeEventListener('mouseup', handleSelection);
  document.removeEventListener('mousemove', handleMouseMove);
  tooltip.style.display = 'none';
}

function handleMouseMove(e) {
  if (tooltip.style.display === 'block') {
    const rect = tooltip.getBoundingClientRect();
    const pad = 40; // Increased from 20 to 40
    if (e.clientX < rect.left - pad || e.clientX > rect.right + pad ||
      e.clientY < rect.top - pad || e.clientY > rect.bottom + pad) {
      startHideTimer();
    } else {
      if (hideTimeout) clearTimeout(hideTimeout);
    }
  }
}

function removeHighlights() {
  const highlights = document.querySelectorAll('.rl-highlight');
  highlights.forEach(mark => {
    const text = document.createTextNode(mark.textContent);
    mark.parentNode.replaceChild(text, mark);
  });
  document.body.normalize(); // Merge adjacent text nodes
}

function handleSelection(e) {
  if (!isEnabled) return;
  if (e.target.closest('#word-lookup-tooltip')) return;
  const selection = window.getSelection();
  const text = selection.toString().trim().replace(/\u00AD/g, '');

  if (text.length > 1 && text.length < 50) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const mockRect = { left: rect.left, bottom: rect.bottom, right: rect.right, width: rect.width, height: rect.height };

    lastHoveredWord = text;
    positionTooltip(mockRect);
    tooltip.style.display = 'block';

    // Disable hover temporarily? Handled by isCollapsed check in interaction
    if (cache.has(text)) renderData(text, cache.get(text));
    else { renderLoading(text); fetchData(text); }
  }
}

function highlightWords() {
  if (!isEnabled) return;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      if (['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'MARK'].includes(node.parentNode.tagName)) return NodeFilter.FILTER_REJECT;
      // Pre-check for supported scripts (Latin, Cyrillic, Greek)
      return /[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}]/u.test(node.textContent) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    }
  });

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  for (const node of nodes) {
    const text = node.textContent;
    let match;
    let lastIndex = 0;
    const fragment = document.createDocumentFragment();
    let hasMatch = false;

    wordRegex.lastIndex = 0;
    while ((match = wordRegex.exec(text)) !== null) {
      hasMatch = true;
      fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));

      const word = match[0];
      const mark = document.createElement('mark');
      mark.className = 'rl-highlight';
      if (!highlightEnabled) mark.classList.add('rl-hide-underline');
      mark.textContent = word;
      const cleanLookup = word.replace(/\u00AD/g, '');
      mark.addEventListener('mouseenter', (e) => handleInteraction(e, cleanLookup));
      mark.addEventListener('mouseleave', startHideTimer);
      fragment.appendChild(mark);
      lastIndex = wordRegex.lastIndex;
    }
    if (hasMatch && node.parentNode) {
      fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
      node.replaceWith(fragment);
    }
  }
}

function handleInteraction(e, word) {
  if (!window.getSelection().isCollapsed) return; // Don't interfere with selection
  if (hideTimeout) clearTimeout(hideTimeout);
  if (showTimeout) clearTimeout(showTimeout);

  // Debounce hover
  showTimeout = setTimeout(() => {
    lastHoveredWord = word;
    positionTooltip(e.target.getBoundingClientRect());
    tooltip.style.display = 'block';

    if (cache.has(word)) renderData(word, cache.get(word));
    else { renderLoading(word); fetchData(word); }
  }, 300);
}

function startHideTimer() {
  if (showTimeout) clearTimeout(showTimeout); // Cancel pending show if user leaves
  hideTimeout = setTimeout(() => {
    tooltip.style.display = 'none';
  }, 300);
}

function positionTooltip(rect) {
  const top = rect.bottom + window.scrollY + 5;
  const left = rect.left + window.scrollX;
  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
}

// Data Fetching Logic (v2 Structural)
async function fetchData(word, depth = 0) {
  // Check cache only for depth 0 requests to avoid stale partials? No, cache is fine.
  if (depth === 0 && cache.has(word)) {
    renderData(word, cache.get(word));
    return;
  }

  try {
    // Request HTML from background with timeout
    const fetchPromise = chrome.runtime.sendMessage({ action: 'fetchWordData', word: word });
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), 5000));

    const response = await Promise.race([fetchPromise, timeoutPromise]);

    if (response.error || !response.parseData || !response.parseData.parse || !response.parseData.parse.text) {
      if (depth === 0) renderError(word, "Definition not found");
      return null;
    }

    const result = processParseData(response.actualWord || word, response.parseData, depth);
    result.originalWord = word;
    result.actualWord = response.actualWord || word;

    // If a recursive lemma was found, fetch it
    if (depth === 0 && result.lemma && result.lemma !== word) {
      const baseData = await fetchData(result.lemma, depth + 1);
      // Merge base definition into result
      if (baseData) {
        result.baseDefinition = baseData.definition; // Add base def
        // If the base word has tables and we don't, grab them? 
        if (!result.grammarHtml || result.grammarHtml.length < 50) {
          result.grammarHtml = baseData.grammarHtml;
        }
      }
    }

    if (depth === 0) {
      // If result is effectively empty (e.g. English only was filtered out), handle it
      if (!result.definition && !result.baseDefinition) {
        cache.set(word, null); // Cache as null/ignore
        if (lastHoveredWord === word) {
           tooltip.style.display = 'none';
        }
        // If it was English-only (implied by empty result in auto mode), remove highlight
        unhighlightWord(word);
        return null;
      }

      cache.set(word, result);
      if (lastHoveredWord === word) renderData(word, result);
    }

    return result;
  } catch (err) {
    console.error("Fetch error:", err);
    if (depth === 0) renderError(word, `Error: ${err.message}`);
    return null;
  }
}

function unhighlightWord(word) {
    // Find all marks with this text and revert them
    const marks = document.querySelectorAll('.rl-highlight');
    const targetText = word.toLowerCase();
    marks.forEach(mark => {
        if (mark.textContent.trim().toLowerCase() === targetText) {
            const text = document.createTextNode(mark.textContent);
            mark.parentNode.replaceChild(text, mark);
        }
    });
    // Optional: normalize to merge text nodes, but might be expensive on full body
}

function processParseData(word, parseJson, depth) {
  const html = parseJson.parse.text['*'];
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const container = document.createElement('div'); // For parsing tables

  // Robust language header finding
  const langSectionId = getLangSectionId(currentLang);
  let langHeader = doc.querySelector(`#${langSectionId}`);
  if (langHeader && langHeader.tagName !== 'H2') langHeader = langHeader.closest('h2');

  // Fallback to first available language ONLY if user chose "auto" mode
  // Otherwise, respect their language choice strictly
  if (!langHeader && currentLang === 'auto') {
    const allH2 = Array.from(doc.querySelectorAll('h2'));
    // Find first H2 that is NOT "English"
    const targetH2 = allH2.find(h => {
        // Wiktionary H2 text is usually inside a span.mw-headline, but textContent catches it.
        return !h.textContent.includes('English'); 
    });
    
    if (targetH2) {
      langHeader = targetH2;
    }
  }

  let definitionsHtml = '';
  let lemma = null;

  if (langHeader) {
    let currentElement = langHeader.closest('.mw-heading') || langHeader;
    currentElement = currentElement.nextElementSibling;

    // Accumulate definitions in a list
    const defItems = [];

    // Scan loop
    while (currentElement) {
      // Stop at next H2
      if (currentElement.tagName === 'H2' ||
        (currentElement.classList.contains('mw-heading2') && currentElement.querySelector('h2')) ||
        currentElement.querySelector('h2')) {
        const h2 = currentElement.tagName === 'H2' ? currentElement : currentElement.querySelector('h2');
        if (h2) break;
      }

      // 1. Extract Definitions (Ordered Lists)
      if (currentElement.tagName === 'OL') {
        currentElement.querySelectorAll('li').forEach(li => {
          const text = li.textContent.trim();
          if (text) {
            defItems.push(`<li>${li.innerHTML}</li>`); // Keep HTML for links, but strict cleaning might be needed

            // Look for structural lemma link (only if we haven't found one yet?)
            // We prioritize the first lemma link we find as the "Main" recursive target.
            // e.g. "plural of X".
            if (!lemma) {
              const lemmaLink = li.querySelector('.form-of-definition-link a') ||
                li.querySelector('.use-with-mention .mention a');
              if (lemmaLink) {
                // Strip accents (combining diacritics) from lemma for API lookup
                lemma = lemmaLink.textContent.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
              }
            }
          }
        });
      }

      // 3. Extract Tables
      const tables = [];
      if (currentElement.matches('table')) tables.push(currentElement);
      currentElement.querySelectorAll('table').forEach(t => tables.push(t));

      tables.forEach(t => {
        // Broaden check: Any table that isn't audio/toc/metadata
        const isBad = t.classList.contains('audiotable') || t.closest('.toc') || t.closest('.sister-project');
        // Accept if explicitly inflection/wikitable OR inside a container OR just a table that isn't Bad
        if (!isBad) {
          processAndAppendTable(t, container, word);
        }
      });

      currentElement = currentElement.nextElementSibling;
    }

    if (defItems.length > 0) {
      definitionsHtml = `<ol style="padding-left:20px; margin:0;">${defItems.join('')}</ol>`;
    }
  }

  // Clean definitions HTML links to spans or local actions?
  // For now keep them as links (Wiktionary links will open in new tab if user clicks).
  // But we might want to disable them or internalize them.
  // content.js processAndAppendTable cleans links. We should probably clean definitions too.
  // Let's do a quick pass on definitionsHtml string to replace <a href...> with <span class="rl-link">
  definitionsHtml = definitionsHtml.replace(/<a[^>]*>(.*?)<\/a>/g, '<span style="color:#2563eb;">$1</span>');

  return {
    word: word,
    definition: definitionsHtml, // Now full HTML list
    lemma: lemma,
    grammarHtml: container.innerHTML || '',
    partOfSpeech: ''
  };
}


function getLangSectionId(lang) {
  if (lang === 'auto') return null; // Auto-detect: no specific section, rely on fallback
  const map = { ru: 'Russian', uk: 'Ukrainian', de: 'German', fr: 'French', es: 'Spanish', it: 'Italian', pt: 'Portuguese', pl: 'Polish', nl: 'Dutch', sv: 'Swedish', el: 'Greek', tr: 'Turkish', cs: 'Czech', sk: 'Slovak', hu: 'Hungarian', ro: 'Romanian', bg: 'Bulgarian', sr: 'Serbian', hr: 'Croatian', sl: 'Slovenian', fi: 'Finnish', da: 'Danish', no: 'Norwegian', is: 'Icelandic', lt: 'Lithuanian', lv: 'Latvian', et: 'Estonian', sq: 'Albanian', ca: 'Catalan', eu: 'Basque', cy: 'Welsh', ga: 'Irish', id: 'Indonesian', ms: 'Malay', tl: 'Tagalog', sw: 'Swahili', af: 'Afrikaans', la: 'Latin', grc: 'Ancient_Greek', eo: 'Esperanto', be: 'Belarusian', mk: 'Macedonian', ka: 'Georgian', hy: 'Armenian', az: 'Azerbaijani', kk: 'Kazakh', uz: 'Uzbek' };
  return map[lang] || null;
}

function processAndAppendTable(table, container, targetWord) {
  const t = table.cloneNode(true);
  t.querySelectorAll('.tr, .mention-tr, sup, .reference, .mw-ref, .annotation-paren, style, script').forEach(el => el.remove());
  t.querySelectorAll('a').forEach(a => {
    const span = document.createElement('span');
    span.innerHTML = a.innerHTML;
    a.replaceWith(span);
  });
  t.querySelectorAll('td, th').forEach(cell => {
    cell.innerHTML = cell.innerHTML.replace(/[△▲▽▼¹²³⁴⁵⁶⁷⁸⁹⁰]/g, '').replace(/<a[^>]*>/g, '<span>').replace(/<\/a>/g, '</span>');
    if (cell.textContent.trim() === '' || cell.textContent.trim() === ',') cell.innerHTML = '';
  });

  const cleanTarget = targetWord.replace(/\u0301/g, '').toLowerCase();
  t.querySelectorAll('td').forEach(cell => {
    const cellText = cell.textContent.trim().replace(/\u0301/g, '').toLowerCase();
    const forms = cellText.split(/[,/]/).map(f => f.trim());
    if (forms.includes(cleanTarget)) cell.classList.add('rl-highlight-form');
  });

  container.appendChild(t);
  container.appendChild(document.createElement('br'));
}

function renderLoading(word) { tooltip.innerHTML = `<div style="text-align:center; padding:20px;">Searching for <b>${word}</b>...</div>`; }
function renderError(word, msg) { tooltip.innerHTML = `<div style="border-bottom:1px solid #f3f4f6; padding-bottom:8px;"><div style="font-size:20px; font-weight:800;">${word}</div></div><div style="color:#ef4444; margin-top:10px;">${msg}</div>`; }

function renderData(word, data) {
  // If we recursed, show base definition too!
  // data.definition e.g. "plural of Verhandlung"
  // data.baseDefinition e.g. "negotiation"

  // Determine primary and secondary content
  let primaryDef = data.definition;
  let secondaryDef = '';

  // If we have a base definition (translation), promote it!
  if (data.lemma && data.baseDefinition) {
    primaryDef = data.baseDefinition; // e.g. "territory"
    secondaryDef = data.definition;   // e.g. "inflection of..."
  }

  let defHtml = `<div class="rl-definition" style="font-size:14px; color:#111827;">${primaryDef}</div>`;
  if (secondaryDef) {
    defHtml += `<div class="rl-definition" style="margin-top:4px; color:#6b7280; font-style:italic; font-size:12px;">${secondaryDef}</div>`;
  }

  tooltip.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:start; border-bottom:1px solid #e5e7eb; padding-bottom:8px; margin-bottom:8px;">
      <div>
        <div style="font-size:20px; font-weight:800; color:#111827; display:flex; align-items:center;">
          ${data.actualWord || word}
          ${data.lemma && data.lemma !== (data.actualWord || word) ? `<span style="font-size:11px; color:#6b7280; background:#f3f4f6; padding:1px 6px; border-radius:3px; margin-left:8px;">base: ${data.lemma}</span>` : ''}
        </div>
        ${data.actualWord && data.actualWord !== word ? `<div style="font-size:11px; color:#ef4444; margin-top:2px;">Showing result for <b>${data.actualWord}</b></div>` : ''}
      </div>
      <div style="display:flex; gap:4px;">
        <a href="https://en.wiktionary.org/wiki/${word}" target="_blank" style="font-size:11px; text-decoration:none; color:#3b82f6; border:1px solid #dbeafe; padding:2px 6px; border-radius:4px;">Wiktionary</a>
        <button id="rl-google-btn" style="font-size:11px; color:#374151; background:white; border:1px solid #e5e7eb; padding:2px 6px; border-radius:4px; cursor:pointer;">Google</button>
        <button id="rl-copy-btn" style="font-size:11px; color:#374151; background:white; border:1px solid #e5e7eb; padding:2px 6px; border-radius:4px; cursor:pointer;">Copy</button>
        <button id="rl-save-btn" style="font-size:11px; color:#374151; background:white; border:1px solid #e5e7eb; padding:2px 6px; border-radius:4px; cursor:pointer;">Save</button>
      </div>
    </div>
    ${defHtml}
    <div class="rl-grammar-container">${data.grammarHtml || '<div style="font-size:12px; color:#6b7280;">No grammar tables found.</div>'}</div>
  `;

  document.getElementById('rl-google-btn').addEventListener('click', () => {
    const query = data.lemma || word;
    window.open(`https://www.google.com/search?q=define+${encodeURIComponent(query)}`, '_blank');
  });

  const copyBtn = document.getElementById('rl-copy-btn');
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(data.lemma || word);
    copyBtn.textContent = 'Copied!';
    copyBtn.style.background = '#dcfce7'; // Light green
    copyBtn.style.color = '#166534';
    setTimeout(() => {
        copyBtn.textContent = 'Copy';
        copyBtn.style.background = 'white';
        copyBtn.style.color = '#374151';
    }, 2000);
  });
  
  const saveBtn = document.getElementById('rl-save-btn');
  saveBtn.addEventListener('click', () => {
    const plainDef = (data.lemma && data.baseDefinition ? data.baseDefinition : data.definition)
      .replace(/<[^>]*>/g, '') // Strip HTML tags
      .replace(/\s+/g, ' ')    // Normalize whitespace
      .trim();

    const entry = {
      word: word,
      base: data.lemma || word,
      translation: plainDef
    };

    chrome.runtime.sendMessage({ action: 'saveWord', entry: entry }, (response) => {
      if (response && response.success) {
        saveBtn.textContent = 'Saved!';
        saveBtn.style.background = '#dcfce7'; // Light green
        saveBtn.style.color = '#166534';
        saveBtn.disabled = true;
      } else if (response && response.duplicate) {
        saveBtn.textContent = 'Saved';
        saveBtn.disabled = true;
      }
    });
  });
}

init();