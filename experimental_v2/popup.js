var popularLangs = [
    { code: 'es', name: 'Spanish' }, { code: 'fr', name: 'French' }, { code: 'de', name: 'German' },
    { code: 'ru', name: 'Russian' }, { code: 'pt', name: 'Portuguese' }, { code: 'it', name: 'Italian' },
    { code: 'nl', name: 'Dutch' }, { code: 'pl', name: 'Polish' },
    { code: 'tr', name: 'Turkish' },
    { code: 'sv', name: 'Swedish' }, { code: 'el', name: 'Greek' },
    { code: 'uk', name: 'Ukrainian' }
];

var allLangs = [
    ...popularLangs,
    { code: 'cs', name: 'Czech' }, { code: 'sk', name: 'Slovak' }, { code: 'hu', name: 'Hungarian' },
    { code: 'ro', name: 'Romanian' }, { code: 'bg', name: 'Bulgarian' }, { code: 'sr', name: 'Serbian' },
    { code: 'hr', name: 'Croatian' }, { code: 'sl', name: 'Slovenian' }, { code: 'fi', name: 'Finnish' },
    { code: 'da', name: 'Danish' }, { code: 'no', name: 'Norwegian' }, { code: 'is', name: 'Icelandic' },
    { code: 'lt', name: 'Lithuanian' }, { code: 'lv', name: 'Latvian' }, { code: 'et', name: 'Estonian' },
    { code: 'sq', name: 'Albanian' }, { code: 'ca', name: 'Catalan' }, { code: 'eu', name: 'Basque' },
    { code: 'cy', name: 'Welsh' }, { code: 'ga', name: 'Irish' },
    { code: 'id', name: 'Indonesian' }, { code: 'ms', name: 'Malay' }, { code: 'tl', name: 'Tagalog' },
    { code: 'sw', name: 'Swahili' }, { code: 'af', name: 'Afrikaans' }, { code: 'la', name: 'Latin' },
    { code: 'grc', name: 'Ancient Greek' }, { code: 'eo', name: 'Esperanto' },
    { code: 'be', name: 'Belarusian' }, { code: 'mk', name: 'Macedonian' }, { code: 'ka', name: 'Georgian' },
    { code: 'hy', name: 'Armenian' }, { code: 'az', name: 'Azerbaijani' }, { code: 'kk', name: 'Kazakh' },
    { code: 'uz', name: 'Uzbek' }
].sort((a, b) => a.name.localeCompare(b.name));

var showAll = false;
var currentLang = 'ru';

var langSelected = document.getElementById('langSelected');
var langText = document.getElementById('langText');
var langDropdown = document.getElementById('langDropdown');
var langSearch = document.getElementById('langSearch');
var langList = document.getElementById('langList');
var langMore = document.getElementById('langMore');

function renderLangs(filter) {
    var list = showAll ? allLangs : popularLangs;
    if (filter) {
        list = allLangs.filter(l => l.name.toLowerCase().includes(filter.toLowerCase()));
    }
    langList.innerHTML = list.map(l =>
        '<div class="lang-item' + (l.code === currentLang ? ' selected' : '') + '" data-code="' + l.code + '">' + l.name + '</div>'
    ).join('');
    langMore.style.display = (showAll || filter) ? 'none' : 'block';
    langMore.textContent = 'Show all ' + allLangs.length + ' languages...';
}

langSelected.addEventListener('click', function () {
    langDropdown.classList.toggle('open');
    if (langDropdown.classList.contains('open')) {
        langSearch.value = '';
        renderLangs();
        langSearch.focus();
    }
});

langSearch.addEventListener('input', function () {
    renderLangs(langSearch.value);
});

langList.addEventListener('click', function (e) {
    if (e.target.classList.contains('lang-item')) {
        var code = e.target.dataset.code;
        var lang = allLangs.find(l => l.code === code);
        if (lang) {
            currentLang = code;
            langText.textContent = lang.name;
            chrome.storage.sync.set({ language: code });
            langDropdown.classList.remove('open');
        }
    }
});

langMore.addEventListener('click', function () {
    showAll = true;
    renderLangs();
});

document.addEventListener('click', function (e) {
    if (!document.getElementById('langPicker').contains(e.target)) {
        langDropdown.classList.remove('open');
    }
});

chrome.storage.sync.get(['language', 'showGrammar'], function (result) {
    if (result.language) {
        currentLang = result.language;
        var lang = allLangs.find(l => l.code === result.language);
        if (lang) langText.textContent = lang.name;
    }
    // Default to true if undefined
    document.getElementById('showGrammar').checked = (result.showGrammar !== false);
});

document.getElementById('showGrammar').addEventListener('change', function (e) {
    chrome.storage.sync.set({ showGrammar: e.target.checked });
});

function loadWords() {
    chrome.storage.local.get(['savedWords'], function (result) {
        var words = result.savedWords || [];
        var list = document.getElementById('wordList');
        var count = document.getElementById('count');
        if (words.length === 0) {
            list.innerHTML = '<div class="empty">No words saved yet</div>';
            count.textContent = '';
            return;
        }
        count.textContent = words.length + ' words';
        list.innerHTML = words.slice().reverse().map(function (w) {
            return '<div class="word-item"><span class="word-text">' + w.base + '</span><span class="word-trans">' + (w.translation || '') + '</span></div>';
        }).join('');
    });
}

document.getElementById('export').addEventListener('click', function () {
    chrome.storage.local.get(['savedWords'], function (result) {
        var words = result.savedWords || [];
        if (words.length === 0) { alert('No words to export'); return; }
        var csv = words.map(function (w) {
            return '"' + w.base + '","' + (w.translation || '').replace(/"/g, '""') + '"';
        }).join('\n');
        var blob = new Blob([csv], { type: 'text/csv' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'words.csv';
        a.click();
    });
});

document.getElementById('clear').addEventListener('click', function () {
    if (confirm('Delete all saved words?')) {
        chrome.storage.local.set({ savedWords: [] }, loadWords);
    }
});

loadWords();
