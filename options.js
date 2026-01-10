document.getElementById('save').addEventListener('click', () => {
    const lang = document.getElementById('language').value;
    const url = document.getElementById('sheetUrl').value;
    chrome.storage.sync.set({ language: lang, sheetUrl: url }, () => {
        document.getElementById('status').style.display = 'inline';
        setTimeout(() => document.getElementById('status').style.display = 'none', 2000);
    });
});

chrome.storage.sync.get(['language', 'sheetUrl'], (result) => {
    if (result.language) document.getElementById('language').value = result.language;
    if (result.sheetUrl) document.getElementById('sheetUrl').value = result.sheetUrl;
});
