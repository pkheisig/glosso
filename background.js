// background.js

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['savedWords'], (result) => {
    if (!result.savedWords) {
      chrome.storage.local.set({ savedWords: [] });
    }
  });
  chrome.storage.sync.get(['language'], (result) => {
    if (!result.language) chrome.storage.sync.set({ language: 'ru' });
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchWordData') {
    chrome.storage.sync.get(['language'], (result) => {
      const lang = result.language || 'ru';
      handleFetch(request.word, lang).then(sendResponse);
    });
    return true;
  }
  if (request.action === 'saveWord') {
    chrome.storage.local.get('savedWords', (result) => {
      const words = result.savedWords || [];
      const exists = words.some(w => w.base === request.entry.base);
      if (exists) {
        sendResponse({ success: false, duplicate: true });
      } else {
        words.push(request.entry);
        chrome.storage.local.set({ savedWords: words });
        sendResponse({ success: true });
      }
    });
    return true;
  }
  if (request.action === 'getLanguage') {
    chrome.storage.sync.get(['language'], (result) => {
      sendResponse({ language: result.language || 'ru' });
    });
    return true;
  }
});

function generateRussianForms(word) {
  const forms = [word];
  const endings = [
    ['ящимися', 'ться'], ['ящимся', 'ться'], ['ящиеся', 'ться'], ['ящийся', 'ться'],
    ['ющимися', 'ться'], ['ющимся', 'ться'], ['ющиеся', 'ться'], ['ющийся', 'ться'],
    ['ившимися', 'ться'], ['ившимся', 'ться'], ['ившиеся', 'ться'], ['ившийся', 'ться'],
    ['ащимися', 'ть'], ['ащимся', 'ть'], ['ащиеся', 'ть'], ['ащийся', 'ть'],
    ['ённых', 'ённый'], ['енных', 'енный'], ['анных', 'анный'], ['янных', 'янный'],
    ['ённым', 'ённый'], ['енным', 'енный'], ['анным', 'анный'], ['янным', 'янный'],
    ['ённой', 'ённый'], ['енной', 'енный'], ['анной', 'анный'], ['янной', 'янный'],
    ['ённом', 'ённый'], ['енном', 'енный'], ['анном', 'анный'], ['янном', 'янный'],
    ['ённую', 'ённый'], ['енную', 'енный'], ['анную', 'анный'], ['янную', 'янный'],
    ['енными', 'енный'], ['анными', 'анный'], ['ённые', 'ённый'], ['енные', 'енный'],
    ['ыми', 'ый'], ['ими', 'ий'], ['ому', 'ый'], ['ему', 'ий'],
    ['ого', 'ый'], ['его', 'ий'], ['ой', 'ый'], ['ей', 'ий'],
    ['ую', 'ый'], ['юю', 'ий'], ['ые', 'ый'], ['ие', 'ий'],
    ['ых', 'ый'], ['их', 'ий'], ['ом', 'ий'], ['ом', 'ый'],
    ['ам', 'а'], ['ям', 'я'], ['ов', ''], ['ев', ''], ['ей', 'ь'],
    ['ами', 'а'], ['ями', 'я'], ['ах', 'а'], ['ях', 'я'],
    ['ишь', 'ить'], ['ешь', 'ать'], ['ёшь', 'ть'],
    ['ит', 'ить'], ['ет', 'ать'], ['ёт', 'ть'],
    ['им', 'ить'], ['ем', 'ать'], ['ём', 'ть'],
    ['ите', 'ить'], ['ете', 'ать'], ['ёте', 'ть'],
    ['ят', 'ить'], ['ют', 'ать'], ['ут', 'ть'],
    ['ил', 'ить'], ['ал', 'ать'], ['ял', 'ять'], ['ел', 'еть'],
    ['ила', 'ить'], ['ала', 'ать'], ['яла', 'ять'], ['ела', 'еть'],
    ['или', 'ить'], ['али', 'ать'], ['яли', 'ять'], ['ели', 'еть'],
    ['ло', 'ть'], ['ли', 'ть'], ['ла', 'ть'],
    ['а', ''], ['у', ''], ['е', ''], ['и', ''], ['ы', ''], ['й', '']
  ];
  for (const [end, repl] of endings) {
    if (word.endsWith(end) && word.length > end.length + 2) {
      forms.push(word.slice(0, -end.length) + repl);
    }
  }
  return [...new Set(forms)];
}

async function searchWiktionary(word) {
  const url = `https://en.wiktionary.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(word)}&srlimit=5&format=json&origin=*`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data?.query?.search || []).map(r => r.title.toLowerCase());
}

async function handleFetch(word, lang) {
  const cleanWord = word.replace(/\u0301/g, '').toLowerCase();
  let translation = "";
  let lemma = cleanWord;
  let partOfSpeech = "";

  async function tryFetchDef(w) {
    const res = await fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(w)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.[lang] || null;
  }

  let entries = await tryFetchDef(cleanWord);
  if (!entries) entries = await tryFetchDef(cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1));

  if (!entries && lang === 'ru') {
    const candidates = generateRussianForms(cleanWord);
    for (const candidate of candidates) {
      if (candidate === cleanWord) continue;
      entries = await tryFetchDef(candidate);
      if (entries) { lemma = candidate; break; }
    }
  }

  if (!entries) {
    const searchResults = await searchWiktionary(cleanWord);
    for (const candidate of searchResults) {
      entries = await tryFetchDef(candidate);
      if (entries) { lemma = candidate; break; }
    }
  }

  if (entries) {
    // Iterate through all entries to find the best translation and lemma
    for (const entry of entries) {
      if (entry.definitions?.length > 0) {
        let defText = entry.definitions[0].definition.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]*>?/gm, '');

        // If we haven't found a translation yet, take the first valid one
        if (!translation) {
          translation = defText;
          partOfSpeech = entry.partOfSpeech || "";
          // If it's a participle, the "translation" might be "Past participle of..." 
          // We might want to keep looking for a better translation? 
          // But for now, let's just make sure we capture the lemma.
        }

        // Revert to broader regex to catch "indicative of", "subjunctive of" etc.
        // But exclude common false positives like "all" (from "first of all")
        const lemmaMatch = defText.match(/\bof\s+([a-zA-Zа-яА-ЯёЁ\u0301\-]+)/);
        if (lemmaMatch && lemmaMatch[1].length > 1) {
          const candidate = lemmaMatch[1].replace(/\u0301/g, '').toLowerCase();
          const invalidLemmas = ['all', 'it', 'us', 'them', 'him', 'her', 'me', 'you', 'one', 'this', 'that'];
          if (!invalidLemmas.includes(candidate)) {
            lemma = candidate;
            break;
          }
        }
      }
    }
  }

  if (lemma !== cleanWord) {
    const lemmaRes = await fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(lemma)}`);
    if (lemmaRes.ok) {
      const lemmaData = await lemmaRes.json();
      if (lemmaData?.[lang]) {
        let deepLemma = null;
        let bestDef = "";

        // First pass: Checking if this lemma is itself a form of something else (e.g. participle -> verb)
        for (const entry of lemmaData[lang]) {
          if (entry.definitions?.length > 0) {
            const def = entry.definitions[0].definition
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
              .replace(/<[^>]*>?/gm, '');

            if (!bestDef) bestDef = def; // Keep the first definition found (e.g. "combined")

            // Look for deep root
            const deepMatch = def.match(/\bof\s+([a-zA-Zа-яА-ЯёЁ\u0301\-]+)/);
            if (deepMatch && deepMatch[1].length > 1) {
              const candidate = deepMatch[1].replace(/\u0301/g, '').toLowerCase();
              const invalidLemmas = ['all', 'it', 'us', 'them', 'him', 'her', 'me', 'you', 'one', 'this', 'that', 'the', 'a', 'an', 'some', 'any', 'these', 'those'];
              if (!invalidLemmas.includes(candidate) && candidate !== lemma) {
                deepLemma = candidate;
                // Don't break immediately, prioritize verbs? No, just finding one is enough.
                break;
              }
            }
          }
        }

        // Deep recursion if finding a root
        if (deepLemma) {
          const deepRes = await fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(deepLemma)}`);
          if (deepRes.ok) {
            const deepData = await deepRes.json();
            if (deepData?.[lang]) {
              for (const entry of deepData[lang]) {
                if (entry.definitions?.length > 0) {
                  const deepDef = entry.definitions[0].definition
                    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                    .replace(/<[^>]*>?/gm, '');

                  // Update to the deep root
                  lemma = deepLemma;
                  bestDef = deepDef;
                  break;
                }
              }
            }
          }
        }

        const lemmaDef = bestDef;
        if (!translation) {
          translation = lemmaDef;
          // We might want to update partOfSpeech to the deep root's POS too? omitted for safety.
        } else if (translation !== lemmaDef && translation.includes(' of ')) {
          if (lemmaDef && lemmaDef.trim().length > 0) {
            translation += `<br><small>[${lemma}: ${lemmaDef.trim()}]</small>`;
          }
        }

      }
    }
  }



  // Fetch grammar tables for the lemma if found, otherwise the original word
  const targetForGrammar = lemma && lemma.length > 1 ? lemma : cleanWord;
  const parseUrl = `https://en.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(targetForGrammar)}&format=json&prop=text&disableeditsection=1&origin=*`;
  let grammarHtml = "";

  const parseRes = await fetch(parseUrl);
  if (parseRes.ok) {
    const parseData = await parseRes.json();
    if (parseData?.parse?.text) {
      grammarHtml = parseData.parse.text['*'];
    }
  }

  return { translation, grammarHtml, lemma, partOfSpeech, lang };
}
