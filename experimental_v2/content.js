// content.js (v2 Refactor)
const tooltip = document.createElement('div');
tooltip.id = 'word-lookup-tooltip';
document.body.appendChild(tooltip);

let cache = new Map();
let hideTimeout, showTimeout;
let lastHoveredWord = null;
let currentLang = 'es'; // Default, updated on init

// Regex patterns (Restricted Unicode: Latin, Cyrillic, Greek)
// Excludes Asian scripts (Han, Kana, etc.) which require special segmentation.
const wordRegex = /[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}\p{M}\u0027\u2019\-\u00AD]{2,}/gu;

// UI Logic
function init() {
  chrome.storage.sync.get(['enabled', 'language'], (data) => {
    if (data.enabled !== false) {
      currentLang = data.language || 'es';

      highlightWords();

      // Listen for manual selection
      document.addEventListener('mouseup', handleSelection);
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (tooltip.style.display === 'block') {
      const rect = tooltip.getBoundingClientRect();
      const pad = 20;
      if (e.clientX < rect.left - pad || e.clientX > rect.right + pad ||
        e.clientY < rect.top - pad || e.clientY > rect.bottom + pad) {
        startHideTimer();
      } else {
        if (hideTimeout) clearTimeout(hideTimeout);
      }
    }
  });
}

function handleSelection(e) {
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

function processParseData(word, parseJson, depth) {
  const html = parseJson.parse.text['*'];
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const container = document.createElement('div'); // For parsing tables

  // Robust language header finding
  const langSectionId = getLangSectionId(currentLang);
  let langHeader = doc.querySelector(`#${langSectionId}`);
  if (langHeader && langHeader.tagName !== 'H2') langHeader = langHeader.closest('h2');

  // Hybrid Fallback: If preferred language not found, use the first available language section.
  // This supports "Auto-Detection" for words that only exist in one language (e.g. Ukrainian "угорського")
  // while preserving preference for ambiguous words (e.g. "die" -> English vs German).
  if (!langHeader) {
    const allH2 = Array.from(doc.querySelectorAll('h2'));
    // Filter out potential non-language headers if necessary (usually H2 is safe on parsing)
    if (allH2.length > 0) {
      langHeader = allH2[0];
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
  const map = { ru: 'Russian', uk: 'Ukrainian', de: 'German', fr: 'French', es: 'Spanish', it: 'Italian', pt: 'Portuguese', pl: 'Polish', nl: 'Dutch', sv: 'Swedish' };
  return map[lang] || 'Russian';
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
        <button id="rl-google-btn" style="font-size:11px; background:white; border:1px solid #e5e7eb; padding:2px 6px; border-radius:4px; cursor:pointer;">Google</button>
        <button id="rl-copy-btn" style="font-size:11px; background:white; border:1px solid #e5e7eb; padding:2px 6px; border-radius:4px; cursor:pointer;">Copy</button>
        <button id="rl-save-btn" style="font-size:11px; background:white; border:1px solid #e5e7eb; padding:2px 6px; border-radius:4px; cursor:pointer;">Save</button>
      </div>
    </div>
    ${defHtml}
    <div class="rl-grammar-container">${data.grammarHtml || '<div style="font-size:12px; color:#6b7280;">No grammar tables found.</div>'}</div>
  `;

  document.getElementById('rl-google-btn').addEventListener('click', () => {
    const query = data.lemma || word;
    window.open(`https://www.google.com/search?q=define+${encodeURIComponent(query)}`, '_blank');
  });

  document.getElementById('rl-copy-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(data.lemma || word);
  });
  document.getElementById('rl-save-btn').addEventListener('click', () => {
    // Save logic...
  });
}

init();