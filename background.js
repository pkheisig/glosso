// background.js (v2 Refactor)
// Minimal proxy to fetch Wiktionary Parse API data to avoid CORS
// and let content.js handle the parsing logic.

// Context Menu for PDF and other contexts
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'wordpeek-lookup',
      title: 'Look up "%s" in Wiktionary',
      contexts: ['selection']
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'wordpeek-lookup' && info.selectionText) {
    const word = info.selectionText.trim();
    chrome.tabs.create({ url: `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}` });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchWordData') {
    handleFetch(request.word).then(sendResponse);
    return true; // Keep channel open
  }
  if (request.action === 'saveWord') {
    handleSave(request.entry).then(sendResponse);
    return true;
  }
  if (request.action === 'getLanguage') {
    chrome.storage.sync.get('language', (data) => {
      sendResponse({ language: data.language || 'auto' });
    });
    return true;
  }
});

async function handleFetch(word) {
  let actualWord = null;
  let data = null;

  try {
    // Timeout handling
    data = await fetchParseWithTimeout(word, 8000);

    // If not found, try lowercase
    if (!data && word !== word.toLowerCase()) {
      data = await fetchParseWithTimeout(word.toLowerCase(), 8000);
      if (data) actualWord = word.toLowerCase();
    }

    // NEW: Fuzzy Search Fallback (OpenSearch)
    // If exact match failed, try to get a "Did you mean?" suggestion
    if (!data) {
      const suggestion = await fetchOpenSearch(word);
      if (suggestion && suggestion !== actualWord) {
        data = await fetchParseWithTimeout(suggestion, 8000);
        if (data) actualWord = suggestion;
      }
    }

    if (!data) {
      return { error: 'No definition found' };
    }

    return { success: true, originalWord: word, actualWord: actualWord, parseData: data };

  } catch (err) {
    console.error("BG Fetch Error:", err);
    return { error: `Network error: ${err.message}` };
  }
}

async function fetchOpenSearch(word) {
  try {
    const url = `https://en.wiktionary.org/w/api.php?action=opensearch&search=${encodeURIComponent(word)}&limit=1&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    // json structure: [searchterm, [suggestion1, ...], [desc...], [link...]]
    if (json[1] && json[1].length > 0) {
      return json[1][0];
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function fetchParseWithTimeout(word, timeoutMs) {
  const url = `https://en.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(word)}&format=json&prop=text|sections&redirects=1`;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) return null; // 404 or other error
    const json = await res.json();
    if (json.error || !json.parse || !json.parse.text) return null;
    return json;
  } catch (e) {
    clearTimeout(id);
    if (e.name === 'AbortError') throw new Error('Timeout');
    throw e;
  }
}

function handleSave(entry) {
  return new Promise(resolve => {
    chrome.storage.local.get({ savedWords: [] }, (result) => {
      const words = result.savedWords;
      if (words.some(w => w.word === entry.word && w.base === entry.base)) {
        resolve({ duplicate: true });
      } else {
        words.push(entry);
        chrome.storage.local.set({ savedWords: words }, () => resolve({ success: true }));
      }
    });
  });
}
