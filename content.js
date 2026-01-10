// content.js
let hideTimeout = null;
let showTimeout = null;
let lastHoveredWord = null;
const cache = new Map();
let currentLang = 'ru';

const langPatterns = {
  // Cyrillic
  ru: { regex: /[а-яА-ЯёЁ\-]{2,}/g, test: /[а-яА-ЯёЁ]/ },
  uk: { regex: /[а-яА-ЯёЁіїєґІЇЄҐ\-]{2,}/g, test: /[іїєґІЇЄҐ]/ },
  be: { regex: /[а-яА-ЯёЁіўІЎ\-]{2,}/g, test: /[іўІЎ]/ },
  bg: { regex: /[а-яА-Я\-]{2,}/g, test: /[а-яА-Я]/ },
  sr: { regex: /[а-яА-ЯђјљњћџЂЈЉЊЋЏ\-]{2,}/g, test: /[ђјљњћџ]/i },
  mk: { regex: /[а-яА-ЯѓѕјљњќџЃЅЈЉЊЌЏ\-]{2,}/g, test: /[ѓѕќџ]/i },
  mn: { regex: /[а-яА-ЯөүӨҮ\-]{2,}/g, test: /[өүӨҮ]/ },
  kk: { regex: /[а-яА-ЯәғқңөұүһіӘҒҚҢӨҰҮҺІ\-]{2,}/g, test: /[әғқңұүһі]/i },
  // Latin with diacritics - Remove strict test requirement for common languages
  // Added \u00AD (soft hyphen) to character sets to fix broken word boundaries
  de: { regex: /[a-zA-ZäöüÄÖÜß\-\u00AD]{2,}/g, test: /[a-zA-ZäöüÄÖÜß]/ },
  fr: { regex: /[a-zA-ZàâäéèêëïîôùûüÿçœæÀÂÄÉÈÊËÏÎÔÙÛÜŸÇŒÆ\-\u00AD]{2,}/g, test: /[a-zA-Z]/ },
  es: { regex: /[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ¿¡\-\u00AD]{2,}/g, test: /[a-zA-Z]/ },
  it: { regex: /[a-zA-ZàèéìíîòóùúÀÈÉÌÍÎÒÓÙÚ\-\u00AD]{2,}/g, test: /[a-zA-Z]/ },
  pt: { regex: /[a-zA-ZàáâãçéêíóôõúÀÁÂÃÇÉÊÍÓÔÕÚ\-\u00AD]{2,}/g, test: /[a-zA-Z]/ },
  pl: { regex: /[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ\-\u00AD]{2,}/g, test: /[a-zA-Ząćęłńóśźż]/ },
  cs: { regex: /[a-zA-ZáčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ\-\u00AD]{2,}/g, test: /[a-zA-Z]/ },
  sk: { regex: /[a-zA-ZáäčďéíĺľňóôŕšťúýžÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ\-\u00AD]{2,}/g, test: /[a-zA-Z]/ },
  hu: { regex: /[a-zA-ZáéíóöőúüűÁÉÍÓÖŐÚÜŰ\-\u00AD]{2,}/g, test: /[a-zA-Z]/ },
  ro: { regex: /[a-zA-ZăâîșțĂÂÎȘȚ\-\u00AD]{2,}/g, test: /[a-zA-Z]/ },
  hr: { regex: /[a-zA-ZčćđšžČĆĐŠŽ\-\u00AD]{2,}/g, test: /[a-zA-Z]/ },
  sl: { regex: /[a-zA-ZčšžČŠŽ\-\u00AD]{2,}/g, test: /[a-zA-Z]/ },
  nl: { regex: /[a-zA-Z\-\u00AD]{2,}/g, test: /[a-zA-Z]/ },
  sv: { regex: /[a-zA-ZåäöÅÄÖ\-\u00AD]{2,}/g, test: /[a-zA-ZåäöÅÄÖ]/ },
  da: { regex: /[a-zA-ZæøåÆØÅ\-\u00AD]{2,}/g, test: /[a-zA-ZæøåÆØÅ]/ },
  no: { regex: /[a-zA-ZæøåÆØÅ\-\u00AD]{2,}/g, test: /[a-zA-ZæøåÆØÅ]/ },
  fi: { regex: /[a-zA-ZäöÄÖ\-\u00AD]{2,}/g, test: /[a-zA-ZäöÄÖ]/ },
  is: { regex: /[a-zA-ZáðéíóúýþæöÁÐÉÍÓÚÝÞÆÖ\-\u00AD]{2,}/g, test: /[a-zA-Z]/ },
  lt: { regex: /[a-zA-ZąčęėįšųūžĄČĘĖĮŠŲŪŽ\-\u00AD]{2,}/g, test: /[a-zA-Z]/ },
  lv: { regex: /[a-zA-ZāčēģīķļņšūžĀČĒĢĪĶĻŅŠŪŽ\-\u00AD]{2,}/g, test: /[a-zA-Z]/ },
  et: { regex: /[a-zA-ZäöõüšžÄÖÕÜŠŽ\-\u00AD]{2,}/g, test: /[a-zA-Z]/ },
  sq: { regex: /[a-zA-ZçëÇË\-\u00AD]{2,}/g, test: /[a-zA-Z]/ },
  ca: { regex: /[a-zA-ZàçèéíïòóúüÀÇÈÉÍÏÒÓÚÜ·\-\u00AD]{2,}/g, test: /[a-zA-Z]/ },
  eu: { regex: /[a-zA-Z\-\u00AD]{2,}/g, test: /[a-zA-Z]/ },
  cy: { regex: /[a-zA-ZâêîôûŵŷÂÊÎÔÛŴŶ\-\u00AD]{2,}/g, test: /[a-zA-Z]/ },
  ga: { regex: /[a-zA-ZáéíóúÁÉÍÓÚ\-\u00AD]{2,}/g, test: /[a-zA-Z]/ },
  tr: { regex: /[a-zA-ZçğıöşüÇĞİÖŞÜ\-\u00AD]{2,}/g, test: /[a-zA-Z]/ },
  az: { regex: /[a-zA-ZçəğıöşüÇƏĞİÖŞÜ\-\u00AD]{2,}/g, test: /[a-zA-Z]/ },
  vi: { regex: /[a-zA-Zàáạảãăắằẳẵặâấầẩẫậèéẹẻẽêếềểễệìíịỉĩòóọỏõôốồổỗộơớờởỡợùúụủũưứừửữựỳýỵỷỹđ\-\u00AD]{2,}/g, test: /[a-zA-Zàáạảãăắằẳẵặâấầẩẫậ]/ },
  id: { regex: /[a-zA-Z\-\u00AD]{2,}/g, test: /[a-zA-Z]/ },
  ms: { regex: /[a-zA-Z\-\u00AD]{2,}/g, test: /[a-zA-Z]/ },
  tl: { regex: /[a-zA-Z\-\u00AD]{2,}/g, test: /[a-zA-Z]/ },
  sw: { regex: /[a-zA-Z\-\u00AD]{2,}/g, test: /[a-zA-Z]/ },
  af: { regex: /[a-zA-ZêëïôûÊËÏÔÛ\-\u00AD]{2,}/g, test: /[a-zA-Z]/ },
  eo: { regex: /[a-zA-ZĉĝĥĵŝŭĈĜĤĴŜŬ\-\u00AD]{2,}/g, test: /[a-zA-Z]/ },
  la: { regex: /[a-zA-Z\-\u00AD]{2,}/g, test: /[a-zA-Z]/ },
  // Greek
  el: { regex: /[α-ωΑ-Ωά-ώ\-]{2,}/g, test: /[α-ωΑ-Ω]/ },
  grc: { regex: /[α-ωΑ-Ωά-ώ\-]{2,}/g, test: /[α-ωΑ-Ω]/ },
  // Asian
  ja: { regex: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]{1,}/g, test: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/ },
  zh: { regex: /[\u4E00-\u9FFF]{1,}/g, test: /[\u4E00-\u9FFF]/ },
  ko: { regex: /[\uAC00-\uD7AF\u1100-\u11FF]{1,}/g, test: /[\uAC00-\uD7AF]/ },
  th: { regex: /[\u0E00-\u0E7F]{2,}/g, test: /[\u0E00-\u0E7F]/ },
  km: { regex: /[\u1780-\u17FF]{2,}/g, test: /[\u1780-\u17FF]/ },
  my: { regex: /[\u1000-\u109F]{2,}/g, test: /[\u1000-\u109F]/ },
  lo: { regex: /[\u0E80-\u0EFF]{2,}/g, test: /[\u0E80-\u0EFF]/ },
  // South Asian
  hi: { regex: /[\u0900-\u097F]{2,}/g, test: /[\u0900-\u097F]/ },
  bn: { regex: /[\u0980-\u09FF]{2,}/g, test: /[\u0980-\u09FF]/ },
  ta: { regex: /[\u0B80-\u0BFF]{2,}/g, test: /[\u0B80-\u0BFF]/ },
  te: { regex: /[\u0C00-\u0C7F]{2,}/g, test: /[\u0C00-\u0C7F]/ },
  pa: { regex: /[\u0A00-\u0A7F]{2,}/g, test: /[\u0A00-\u0A7F]/ },
  ne: { regex: /[\u0900-\u097F]{2,}/g, test: /[\u0900-\u097F]/ },
  si: { regex: /[\u0D80-\u0DFF]{2,}/g, test: /[\u0D80-\u0DFF]/ },
  // Semitic/RTL
  ar: { regex: /[\u0600-\u06FF]{2,}/g, test: /[\u0600-\u06FF]/ },
  he: { regex: /[\u0590-\u05FF]{2,}/g, test: /[\u0590-\u05FF]/ },
  fa: { regex: /[\u0600-\u06FF\u0750-\u077F]{2,}/g, test: /[\u0600-\u06FF]/ },
  ur: { regex: /[\u0600-\u06FF]{2,}/g, test: /[\u0600-\u06FF]/ },
  // Caucasian
  ka: { regex: /[\u10A0-\u10FF]{2,}/g, test: /[\u10A0-\u10FF]/ },
  hy: { regex: /[\u0530-\u058F]{2,}/g, test: /[\u0530-\u058F]/ },
  // Sanskrit
  sa: { regex: /[\u0900-\u097F]{2,}/g, test: /[\u0900-\u097F]/ }
};

const tooltip = document.createElement('div');
tooltip.id = 'word-lookup-tooltip';
Object.assign(tooltip.style, {
  position: 'absolute', display: 'none', zIndex: '2147483647', pointerEvents: 'auto',
  backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '10px',
  boxShadow: '0 12px 30px rgba(0, 0, 0, 0.15)', padding: '18px', width: '400px',
  maxHeight: '500px', overflowY: 'auto', color: '#1f2937',
  fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '14px', lineHeight: '1.6'
});
document.body.appendChild(tooltip);

const style = document.createElement('style');
style.textContent = `
  .rl-highlight-form { background-color: #fef08a !important; font-weight: bold; }
  .word-lookup-mark { 
    background-color: transparent; 
    text-decoration: underline; 
    text-decoration-style: dotted;
    text-decoration-color: #999;
    text-underline-offset: 3px;
    cursor: default; 
    color: inherit;
  }
  .word-lookup-mark:hover { 
    text-decoration-style: solid; 
    text-decoration-color: #000;
  }
  #word-lookup-tooltip table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; border: 1px solid #e5e7eb; background: white; }
  #word-lookup-tooltip th, #word-lookup-tooltip td { border: 1px solid #e5e7eb; padding: 3px 5px; text-align: center; color: #1f2937; }
  #word-lookup-tooltip th { background-color: #f3f4f6; font-weight: 600; }
  #word-lookup-tooltip a { color: #2563eb; text-decoration: none; }
  #word-lookup-tooltip a:hover { text-decoration: underline; }
  #word-lookup-tooltip span, #word-lookup-tooltip strong, #word-lookup-tooltip i, #word-lookup-tooltip b { color: inherit; }
  #word-lookup-tooltip .tr { display: none !important; }
  .NavFrame { border: 1px solid #e5e7eb; margin-bottom: 10px; display: block !important; }
  .NavHead { background: #f3f4f6; padding: 4px; font-weight: bold; font-size: 11px; display: block !important; }
  .NavContent { display: block !important; }
  .NavToggle { display: none !important; }
`;
document.head.appendChild(style);

tooltip.addEventListener('mouseenter', () => {
  if (hideTimeout) clearTimeout(hideTimeout);
  if (showTimeout) clearTimeout(showTimeout);
});
tooltip.addEventListener('mouseleave', () => startHideTimer());

let showGrammar = true;

function init() {
  chrome.runtime.sendMessage({ action: 'getLanguage' }, (response) => {
    currentLang = response?.language || 'ru';
    // We can't easily get other sync settings via simple messaging without updating background.js helper,
    // so we'll just check storage directly if possible or update background helper.
    // Actually, background.js doesn't have a 'getSettings' helper yet.
    // Let's add a listener for storage changes to update on the fly.
    highlightWords(document.body);
  });

  chrome.storage.sync.get(['showGrammar'], (result) => {
    showGrammar = result.showGrammar !== false;
  });

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
      if (changes.language) {
        currentLang = changes.language.newValue;
        // Re-highlighting might be expensive, but necessary if lang changes
        location.reload();
      }
      if (changes.showGrammar) {
        showGrammar = changes.showGrammar.newValue;
      }
    }
  });

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) { if (node.nodeType === 1) highlightWords(node); }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function highlightWords(root) {
  const pattern = langPatterns[currentLang] || langPatterns.ru;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.parentElement || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT'].includes(node.parentElement.tagName) ||
      node.parentElement.closest('#word-lookup-tooltip') || node.parentElement.closest('.word-lookup-mark')) continue;
    nodes.push(node);
  }

  for (const node of nodes) {
    const text = node.nodeValue;
    if (!pattern.test.test(text)) continue;
    let match;
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let hasMatch = false;
    pattern.regex.lastIndex = 0;
    while ((match = pattern.regex.exec(text)) !== null) {
      hasMatch = true;
      const word = match[0];
      fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
      const mark = document.createElement('mark');
      mark.className = 'word-lookup-mark';
      mark.textContent = word;
      const cleanLookupWord = word.replace(/\u00AD/g, '');
      mark.addEventListener('mouseenter', (e) => handleInteraction(e, cleanLookupWord));
      mark.addEventListener('mouseleave', startHideTimer);
      fragment.appendChild(mark);
      lastIndex = pattern.regex.lastIndex;
    }
    if (hasMatch && node.parentNode) {
      fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
      node.replaceWith(fragment);
    }
  }
}

function handleInteraction(e, word) {
  // Disable hover lookup if text is manually selected
  if (!window.getSelection().isCollapsed) return;
  if (hideTimeout) clearTimeout(hideTimeout);
  if (showTimeout) clearTimeout(showTimeout);
  const isVisible = tooltip.style.display === 'block';
  const isSameWord = lastHoveredWord === word;
  if (isVisible && !isSameWord) {
    showTimeout = setTimeout(() => showWord(e, word), 200);
  } else {
    showWord(e, word);
  }
}

function showWord(e, word) {
  lastHoveredWord = word;
  const rect = e.target.getBoundingClientRect();
  positionTooltip(rect);
  tooltip.style.display = 'block';
  if (cache.has(word)) renderData(word, cache.get(word));
  else { renderLoading(word); fetchData(word); }
}

function startHideTimer() {
  if (hideTimeout) clearTimeout(hideTimeout);
  if (showTimeout) clearTimeout(showTimeout);
  hideTimeout = setTimeout(() => { tooltip.style.display = 'none'; }, 600);
}

function positionTooltip(targetRect) {
  let left = targetRect.left + window.scrollX;
  let top = targetRect.bottom + 10 + window.scrollY;
  if (left + 400 > window.innerWidth + window.scrollX) left = window.innerWidth + window.scrollX - 420;
  tooltip.style.left = `${Math.max(10, left)}px`;
  tooltip.style.top = `${top}px`;
}

function fetchData(word) {
  chrome.runtime.sendMessage({ action: 'fetchWordData', word: word }, (response) => {
    if (lastHoveredWord !== word) return;
    if (response && !response.error) {
      const processed = processRawHtml(response, word);
      cache.set(word, processed);
      renderData(word, processed);
    } else {
      renderError(word, response?.error || "Lookup failed.");
    }
  });
}

function processRawHtml(data, originalWord) {
  let translation = data.translation || '';
  translation = translation.replace(/\s*\([^)]*[a-zA-Z][^)]*\)/g, '');

  if (!data.grammarHtml || !showGrammar) {
    return { translation: translation, grammarHtml: '', lemma: data.lemma, partOfSpeech: data.partOfSpeech };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(data.grammarHtml, 'text/html');
  const container = document.createElement('div');

  const langSectionId = getLangSectionId(currentLang);
  // Find the language header (e.g. "Russian", "German")
  // Find the language header (e.g. "Russian", "German")
  let langHeader = doc.querySelector(`#${langSectionId}`);
  if (langHeader && langHeader.tagName !== 'H2') {
    langHeader = langHeader.closest('h2');
  }

  if (langHeader) {
    // Determine the start element (could be the h2 or its wrapper)
    let currentElement = langHeader.closest('.mw-heading') || langHeader;
    currentElement = currentElement.nextElementSibling;

    while (currentElement) {
      // Check if we reached the next language section (h2 or mw-heading2)
      if (currentElement.tagName === 'H2' ||
        (currentElement.classList.contains('mw-heading2') && currentElement.querySelector('h2')) ||
        currentElement.querySelector('h2')) {
        // Stop if we hit a new H2 (language) header
        // Be careful not to stop at H3/H4 (subsections)
        const h2 = currentElement.tagName === 'H2' ? currentElement : currentElement.querySelector('h2');
        if (h2) break;
      }

      // Look for tables in this element and its children
      // We look for ANY table that looks like a grammar table
      const tables = [];
      if (currentElement.matches('table')) tables.push(currentElement);
      currentElement.querySelectorAll('table').forEach(t => tables.push(t));

      tables.forEach(t => {
        // Filter relevant tables based on classes or context
        // German tables often use 'inflection-table'. French 'wikitable'.
        // We accept: .inflection-table, .wikitable, tables inside .NavFrame, .vsSwitcher, .mw-collapsible
        const isValid = t.matches('.inflection-table, .wikitable') ||
          t.closest('.inflection-table-wrapper, .NavFrame, .vsSwitcher, .mw-collapsible');

        if (isValid) {
          processAndAppendTable(t, container, originalWord);
        }
      });

      currentElement = currentElement.nextElementSibling;
    }
  }

  return {
    translation: translation,
    grammarHtml: container.innerHTML || '',
    lemma: data.lemma,
    partOfSpeech: data.partOfSpeech
  };
}

function getLangSectionId(lang) {
  const map = { ru: 'Russian', uk: 'Ukrainian', de: 'German', fr: 'French', es: 'Spanish', it: 'Italian', pt: 'Portuguese', pl: 'Polish', nl: 'Dutch', sv: 'Swedish', el: 'Greek', ja: 'Japanese', zh: 'Chinese', ko: 'Korean', ar: 'Arabic', he: 'Hebrew' };
  return map[lang] || 'Russian';
}

function processAndAppendTable(table, container, targetWord) {
  const t = table.cloneNode(true);

  // Clean up unwanted elements but preserve structure
  // Removed .latn from removal list as it might conflict with main text in some languages (e.g. Spanish uses .Latn)
  t.querySelectorAll('.tr, .mention-tr, sup, .reference, .mw-ref, .annotation-paren, style, script').forEach(el => el.remove());

  // Convert links to spans but keep their HTML content
  t.querySelectorAll('a').forEach(a => {
    const span = document.createElement('span');
    span.innerHTML = a.innerHTML;
    a.replaceWith(span);
  });

  t.querySelectorAll('td, th').forEach(cell => {
    // Clean text noise but preserve HTML (like breaks or spans)
    // We only remove specific noise characters from the HTML
    cell.innerHTML = cell.innerHTML
      .replace(/[△▲▽▼¹²³⁴⁵⁶⁷⁸⁹⁰]/g, '')
      .replace(/<a[^>]*>/g, '<span>') // safety fallback
      .replace(/<\/a>/g, '</span>');

    // Remove "empty" cells that only contain whitespace or comma
    const textContent = cell.textContent.trim();
    if (textContent === '' || textContent === ',') {
      cell.innerHTML = '';
    }
  });

  const cleanTarget = targetWord.replace(/\u0301/g, '').toLowerCase();

  // Highlight
  t.querySelectorAll('td').forEach(cell => {
    // Check against text content for matching
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
  const baseHtml = data.lemma && data.lemma !== word.toLowerCase()
    ? `<span style="font-size:11px; color:#6b7280; background:#f3f4f6; padding:1px 6px; border-radius:3px; margin-left:8px;">base: ${data.lemma}</span>`
    : '';

  const wiktionaryLink = `https://en.wiktionary.org/wiki/${encodeURIComponent(data.lemma || word)}#${getLangSectionId(currentLang)}`;

  tooltip.innerHTML = `
    <div style="margin-bottom:${showGrammar ? '12px' : '0'}; border-bottom:${showGrammar ? '1px solid #f3f4f6' : 'none'}; padding-bottom:${showGrammar ? '8px' : '0'};">
      <div style="display:flex; align-items:baseline; gap:8px; flex-wrap:wrap;">
        <div style="font-size:20px; font-weight:800;">${word}</div>
        ${baseHtml}
        <div style="margin-left:auto; display:flex; gap:6px;">
          <a href="${wiktionaryLink}" target="_blank" style="font-size:10px; padding:2px 8px; border:1px solid #d1d5db; border-radius:4px; background:#fff; cursor:pointer; color:#374151; text-decoration:none;">Wiktionary</a>
          <button id="rl-copy-btn" style="font-size:10px; padding:2px 8px; border:1px solid #d1d5db; border-radius:4px; background:#fff; cursor:pointer;">Copy</button>
          <button id="rl-save-btn" style="font-size:10px; padding:2px 8px; border:1px solid #d1d5db; border-radius:4px; background:#fff; cursor:pointer;">Save</button>
        </div>
      </div>
      <div style="font-size:15px; color:#374151; font-style:italic; margin-top:4px;">${data.translation || 'No translation found'}</div>
    </div>
    ${showGrammar ? `<div class="rl-grammar-container">${data.grammarHtml || '<div style="font-size:12px; color:#6b7280;">No grammar tables found.</div>'}</div>` : ''}
  `;

  document.getElementById('rl-copy-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(data.lemma || word);
    document.getElementById('rl-copy-btn').textContent = 'Copied!';
    setTimeout(() => document.getElementById('rl-copy-btn').textContent = 'Copy', 1500);
  });

  document.getElementById('rl-save-btn').addEventListener('click', () => {
    const btn = document.getElementById('rl-save-btn');
    btn.textContent = '...';
    const entry = { word: word, base: data.lemma || word, translation: data.translation || '', date: new Date().toISOString() };
    chrome.runtime.sendMessage({ action: 'saveWord', entry: entry }, (response) => {
      btn.textContent = response?.duplicate ? 'Already saved' : 'Saved!';
      setTimeout(() => btn.textContent = 'Save', 1500);
    });
  });
}

// Add selection listener for manual lookup
document.addEventListener('mouseup', (e) => {
  // Don't trigger if clicking inside tooltip
  if (e.target.closest('#word-lookup-tooltip')) return;

  const selection = window.getSelection();
  const text = selection.toString().trim().replace(/\u00AD/g, '');

  if (text.length > 1 && text.length < 50) {
    // Determine position from selection range
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Artificial event-like object for positioning
    // We want the tooltip below the selection
    const mockRect = {
      left: rect.left,
      bottom: rect.bottom,
      right: rect.right,
      width: rect.width,
      height: rect.height
    };

    // Function to calculate position (reusing existing logic slightly modified or creating new)
    // We can just reuse positionTooltip logic if we pass the rect
    lastHoveredWord = text;
    positionTooltip(mockRect);
    tooltip.style.display = 'block';

    if (cache.has(text)) renderData(text, cache.get(text));
    else { renderLoading(text); fetchData(text); }
  }
});

init();