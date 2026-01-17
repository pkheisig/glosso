// Glosso Flashcards

var state = {
  decks: [],
  activeDeckId: null,
  currentIndex: 0,
  isFlipped: false,
  termFirst: true,
  mode: 'flashcard',
  searchQuery: '',
  revealedIds: new Set(),
  theme: 'dark',
  themeName: 'indigo',
  // Favorites
  starredCardKeys: new Set(),
  starredCardsData: [],
  studyingFavorites: false,
  savedDeckId: null,
  // Typing mode
  typingMode: false,
  userTypingInput: '',
  isCorrect: false
};

var $ = function (id) { return document.getElementById(id); };

var storage = {
  get: function (keys, callback) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(keys, callback);
    } else {
      var result = {};
      keys.forEach(function (key) {
        var val = localStorage.getItem(key);
        if (val) result[key] = JSON.parse(val);
      });
      callback(result);
    }
  },
  set: function (data, callback) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(data, callback);
    } else {
      Object.keys(data).forEach(function (key) {
        localStorage.setItem(key, JSON.stringify(data[key]));
      });
      if (callback) callback();
    }
  }
};

document.addEventListener('DOMContentLoaded', function () {
  loadState();
  bindEvents();
  updateTheme();
});

function loadState() {
  storage.get(['flashcardDecks', 'flashcardSettings', 'flashcardFavorites'], function (result) {
    state.decks = result.flashcardDecks || [];
    var settings = result.flashcardSettings || {};
    state.termFirst = settings.termFirst !== false;
    state.theme = settings.theme || 'dark';
    state.themeName = settings.themeName || 'indigo';

    // Load favorites
    var fav = result.flashcardFavorites || {};
    state.starredCardKeys = new Set(fav.keys || []);
    state.starredCardsData = fav.cards || [];

    renderDeckList();
    updateTheme();
    updateFavoritesDeck();

    if (state.decks.length > 0 && !state.activeDeckId) {
      selectDeck(state.decks[0].id);
    }
  });
}

function saveDecks() {
  storage.set({ flashcardDecks: state.decks });
}

function saveSettings() {
  storage.set({ flashcardSettings: { termFirst: state.termFirst, theme: state.theme, themeName: state.themeName } });
}

function saveFavorites() {
  storage.set({ flashcardFavorites: { keys: Array.from(state.starredCardKeys), cards: state.starredCardsData } });
}

function cardKey(card) {
  return card.term + '|' + card.definition;
}

function isStarred(card) {
  return state.starredCardKeys.has(cardKey(card));
}

function bindEvents() {
  $('csvInput').addEventListener('change', handleCSVFile);
  $('toggleTheme').addEventListener('click', toggleTheme);
  $('modeFlashcard').addEventListener('click', function () { setMode('flashcard'); });
  $('modeList').addEventListener('click', function () { setMode('list'); });
  $('shuffleBtn').addEventListener('click', shuffleCards);
  $('flipDirection').addEventListener('click', toggleDirection);
  $('editDeck').addEventListener('click', openEditModal);
  $('flashcard').addEventListener('click', flipCard);
  $('prevBtn').addEventListener('click', prevCard);
  $('nextBtn').addEventListener('click', nextCard);
  $('starBtn').addEventListener('click', function (e) { e.stopPropagation(); toggleStar(); });
  $('searchInput').addEventListener('input', function (e) {
    state.searchQuery = e.target.value;
    renderList();
  });
  $('revealAllBtn').addEventListener('click', revealAll);
  $('shuffleListBtn').addEventListener('click', shuffleListMode);
  $('resetListBtn').addEventListener('click', resetListMode);
  $('addCardBtn').addEventListener('click', addCardRow);
  $('deleteDeck').addEventListener('click', deleteDeck);
  $('saveChanges').addEventListener('click', saveEdit);
  $('cancelCsv').addEventListener('click', function () { closeModal('csvModal'); });
  $('confirmCsv').addEventListener('click', confirmCSVImport);
  $('termColumn').addEventListener('change', updateCSVPreview);
  $('defColumn').addEventListener('change', updateCSVPreview);
  $('settingsBtn').addEventListener('click', function () { openModal('settingsModal'); });
  $('typingToggle').addEventListener('click', toggleTypingMode);
  $('typingInput').addEventListener('input', function (e) {
    state.userTypingInput = e.target.value;
    checkTypingAnswer();
  });

  // Theme picker
  document.querySelectorAll('.theme-circle').forEach(function (el) {
    el.addEventListener('click', function () {
      setThemeName(el.dataset.theme);
    });
  });

  // Favorites deck
  $('favoritesDeck').addEventListener('click', function () {
    if (state.starredCardKeys.size > 0) loadFavorites();
  });

  // Modal close buttons and backdrops
  document.querySelectorAll('.modal-close').forEach(function (btn) {
    btn.addEventListener('click', function () {
      closeModal(btn.dataset.close);
    });
  });
  document.querySelectorAll('.modal-backdrop').forEach(function (backdrop) {
    backdrop.addEventListener('click', function () {
      backdrop.parentElement.style.display = 'none';
    });
  });

  document.addEventListener('keydown', handleKeyboard);
}

function openModal(id) { $(id).style.display = 'flex'; }
function closeModal(id) { $(id).style.display = 'none'; }

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  updateTheme();
  saveSettings();
}

function setThemeName(name) {
  state.themeName = name;
  updateTheme();
  saveSettings();
  document.querySelectorAll('.theme-circle').forEach(function (el) {
    el.classList.toggle('active', el.dataset.theme === name);
  });
}

function updateTheme() {
  document.body.dataset.theme = state.theme;
  document.body.dataset.accent = state.themeName;
  document.querySelectorAll('.theme-circle').forEach(function (el) {
    el.classList.toggle('active', el.dataset.theme === state.themeName);
  });
}

// Favorites
function updateFavoritesDeck() {
  var count = state.starredCardKeys.size;
  $('favoritesCount').textContent = count;
  $('favoritesDeck').classList.toggle('empty', count === 0);
  $('favoritesDeck').classList.toggle('active', state.studyingFavorites);
}

function loadFavorites() {
  if (state.starredCardsData.length === 0) return;

  if (!state.studyingFavorites && state.activeDeckId) {
    state.savedDeckId = state.activeDeckId;
  }

  state.studyingFavorites = true;
  state.activeDeckId = null;
  state.currentIndex = 0;
  state.isFlipped = false;
  state.revealedIds = new Set();

  renderDeckList();
  updateFavoritesDeck();

  $('emptyState').style.display = 'none';
  $('studyArea').style.display = 'flex';
  $('deckTitle').textContent = 'Favorites';
  $('cardCount').textContent = '(' + state.starredCardsData.length + ' cards)';
  updateFlashcard();
  renderList();
}

function exitFavorites() {
  state.studyingFavorites = false;
  if (state.savedDeckId) {
    selectDeck(state.savedDeckId);
    state.savedDeckId = null;
  } else if (state.decks.length > 0) {
    selectDeck(state.decks[0].id);
  } else {
    $('emptyState').style.display = 'flex';
    $('studyArea').style.display = 'none';
    renderDeckList();
    updateFavoritesDeck();
  }
}

// Typing Mode
function toggleTypingMode() {
  state.typingMode = !state.typingMode;
  $('typingToggle').classList.toggle('active', state.typingMode);
  $('typingArea').style.display = state.typingMode ? 'flex' : 'none';
  state.userTypingInput = '';
  state.isCorrect = false;
  $('typingInput').value = '';
  $('correctFeedback').style.display = 'none';
  if (state.typingMode) $('typingInput').focus();
}

function checkTypingAnswer() {
  var cards = getActiveCards();
  if (cards.length === 0) return;
  var card = cards[state.currentIndex];
  if (!card) return;

  var target = state.termFirst ? card.definition : card.term;
  var input = state.userTypingInput.trim().toLowerCase();
  var correct = target.trim().toLowerCase();

  state.isCorrect = input === correct;
  $('correctFeedback').style.display = state.isCorrect ? 'block' : 'none';
}

// CSV Import
var csvData = null;

function handleCSVFile(e) {
  var file = e.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function (evt) {
    parseCSVForImport(evt.target.result, file.name);
  };
  reader.readAsText(file);
  e.target.value = '';
}

function parseCSVForImport(content, filename) {
  var lines = content.split(/\r?\n/).filter(function (l) { return l.trim(); });
  if (lines.length < 2) { alert('CSV file is empty or has no data rows'); return; }

  var rows = lines.map(function (line) {
    var parts = [];
    var current = '';
    var inQuotes = false;
    for (var i = 0; i < line.length; i++) {
      var char = line[i];
      if (char === '"') { inQuotes = !inQuotes; }
      else if (char === ',' && !inQuotes) { parts.push(current.trim()); current = ''; }
      else { current += char; }
    }
    parts.push(current.trim());
    return parts;
  });

  csvData = { headers: rows[0], rows: rows.slice(1) };
  $('csvDeckName').value = filename.replace(/\.(csv|txt)$/i, '');

  var termSelect = $('termColumn');
  var defSelect = $('defColumn');
  termSelect.innerHTML = '';
  defSelect.innerHTML = '';

  csvData.headers.forEach(function (h, i) {
    termSelect.innerHTML += '<option value="' + i + '">' + escapeHtml(h) + '</option>';
    defSelect.innerHTML += '<option value="' + i + '">' + escapeHtml(h) + '</option>';
  });

  if (csvData.headers.length > 1) defSelect.selectedIndex = 1;
  updateCSVPreview();
  openModal('csvModal');
}

function updateCSVPreview() {
  if (!csvData) return;
  var termIdx = parseInt($('termColumn').value) || 0;
  var defIdx = parseInt($('defColumn').value) || 0;
  var preview = csvData.rows.slice(0, 5).map(function (row) {
    return (row[termIdx] || '') + ' → ' + (row[defIdx] || '');
  }).join('\n');
  $('csvPreview').textContent = preview + (csvData.rows.length > 5 ? '\n...' : '');
}

function confirmCSVImport() {
  var name = $('csvDeckName').value.trim();
  if (!name) { alert('Please enter a deck name'); return; }

  var termIdx = parseInt($('termColumn').value) || 0;
  var defIdx = parseInt($('defColumn').value) || 0;

  var deck = {
    id: Date.now().toString(),
    name: name,
    cards: csvData.rows.map(function (row) {
      return {
        id: Date.now().toString() + Math.random(),
        term: row[termIdx] || '',
        definition: row[defIdx] || ''
      };
    }).filter(function (c) { return c.term || c.definition; }),
    created: Date.now()
  };

  state.decks.push(deck);
  saveDecks();
  renderDeckList();
  selectDeck(deck.id);
  closeModal('csvModal');
  csvData = null;
}

// Deck List
function renderDeckList() {
  var list = $('deckList');
  if (state.decks.length === 0) {
    list.innerHTML = '<div class="empty-state">No decks yet</div>';
    return;
  }

  list.innerHTML = state.decks.map(function (d) {
    var isActive = d.id === state.activeDeckId && !state.studyingFavorites;
    return '<div class="deck-item' + (isActive ? ' active' : '') + '" data-id="' + d.id + '">' +
      '<span class="deck-name">' + escapeHtml(d.name) + '</span>' +
      '<span class="deck-count">' + d.cards.length + '</span>' +
      '</div>';
  }).join('');

  list.querySelectorAll('.deck-item').forEach(function (el) {
    el.addEventListener('click', function () {
      if (state.studyingFavorites) exitFavorites();
      selectDeck(el.dataset.id);
    });
  });
}

function selectDeck(id) {
  state.activeDeckId = id;
  state.studyingFavorites = false;
  state.currentIndex = 0;
  state.isFlipped = false;
  state.revealedIds = new Set();
  state.searchQuery = '';
  state.userTypingInput = '';
  state.isCorrect = false;
  $('searchInput').value = '';
  if (state.typingMode) {
    $('typingInput').value = '';
    $('correctFeedback').style.display = 'none';
  }

  renderDeckList();
  updateFavoritesDeck();

  var deck = getActiveDeck();
  if (deck && deck.cards.length > 0) {
    $('emptyState').style.display = 'none';
    $('studyArea').style.display = 'flex';
    $('deckTitle').textContent = deck.name;
    $('cardCount').textContent = '(' + deck.cards.length + ' cards)';
    updateFlashcard();
    renderList();
  } else if (deck) {
    $('emptyState').style.display = 'none';
    $('studyArea').style.display = 'flex';
    $('deckTitle').textContent = deck.name;
    $('cardCount').textContent = '(0 cards)';
  }
}

function getActiveDeck() {
  if (state.studyingFavorites) return null;
  return state.decks.find(function (d) { return d.id === state.activeDeckId; });
}

function getActiveCards() {
  if (state.studyingFavorites) return state.starredCardsData;
  var deck = getActiveDeck();
  return deck ? deck.cards : [];
}

function getFilteredCards() {
  var cards = getActiveCards();
  if (!state.searchQuery) return cards;
  var q = state.searchQuery.toLowerCase();
  return cards.filter(function (c) {
    return c.term.toLowerCase().includes(q) || c.definition.toLowerCase().includes(q);
  });
}

// Study Modes
function setMode(mode) {
  state.mode = mode;
  $('modeFlashcard').classList.toggle('active', mode === 'flashcard');
  $('modeList').classList.toggle('active', mode === 'list');
  $('flashcardMode').style.display = mode === 'flashcard' ? 'flex' : 'none';
  $('listMode').style.display = mode === 'list' ? 'flex' : 'none';
  if (mode === 'list') renderList();
}

// Flashcard Mode
function updateFlashcard() {
  var cards = getActiveCards();
  if (cards.length === 0) return;

  var card = cards[state.currentIndex];
  if (!card) return;

  var front = state.termFirst ? card.term : card.definition;
  var back = state.termFirst ? card.definition : card.term;

  $('cardFront').textContent = front;
  $('cardBack').textContent = back;
  $('flashcard').classList.toggle('flipped', state.isFlipped);

  $('prevBtn').disabled = state.currentIndex === 0;
  $('nextBtn').disabled = state.currentIndex === cards.length - 1;

  var progress = ((state.currentIndex + 1) / cards.length) * 100;
  $('progressFill').style.width = progress + '%';
  $('progressText').textContent = (state.currentIndex + 1) + ' / ' + cards.length;

  var starred = isStarred(card);
  $('starBtn').classList.toggle('starred', starred);
  $('starBtn').textContent = starred ? '★' : '☆';
}

function flipCard() {
  if (state.typingMode) return;
  state.isFlipped = !state.isFlipped;
  $('flashcard').classList.toggle('flipped', state.isFlipped);
}

function nextCard() {
  var cards = getActiveCards();
  if (state.currentIndex < cards.length - 1) {
    state.currentIndex++;
    state.isFlipped = false;
    state.userTypingInput = '';
    state.isCorrect = false;
    if (state.typingMode) {
      $('typingInput').value = '';
      $('correctFeedback').style.display = 'none';
    }
    updateFlashcard();
  }
}

function prevCard() {
  if (state.currentIndex > 0) {
    state.currentIndex--;
    state.isFlipped = false;
    state.userTypingInput = '';
    state.isCorrect = false;
    if (state.typingMode) {
      $('typingInput').value = '';
      $('correctFeedback').style.display = 'none';
    }
    updateFlashcard();
  }
}

function toggleStar() {
  var cards = getActiveCards();
  if (cards.length === 0) return;
  var card = cards[state.currentIndex];
  if (!card) return;

  var key = cardKey(card);
  if (state.starredCardKeys.has(key)) {
    state.starredCardKeys.delete(key);
    state.starredCardsData = state.starredCardsData.filter(function (c) { return cardKey(c) !== key; });
  } else {
    state.starredCardKeys.add(key);
    state.starredCardsData.push({ id: Date.now().toString(), term: card.term, definition: card.definition });
  }

  saveFavorites();
  updateFlashcard();
  updateFavoritesDeck();
  renderList();
}

function shuffleCards() {
  var cards = getActiveCards();
  if (cards.length === 0) return;

  for (var i = cards.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = cards[i];
    cards[i] = cards[j];
    cards[j] = temp;
  }

  state.currentIndex = 0;
  state.isFlipped = false;

  if (!state.studyingFavorites) saveDecks();
  updateFlashcard();
  renderList();
}

function toggleDirection() {
  state.termFirst = !state.termFirst;
  saveSettings();
  updateFlashcard();
  renderList();
}

// List Mode
function renderList() {
  var cards = getFilteredCards();
  var list = $('cardList');

  if (cards.length === 0) {
    list.innerHTML = '<div class="empty-state">No cards</div>';
    return;
  }

  list.innerHTML = cards.map(function (c, idx) {
    var isRevealed = state.revealedIds.has(c.id);
    var starred = isStarred(c);
    return '<div class="list-card" data-id="' + c.id + '" data-idx="' + idx + '">' +
      '<span class="list-star' + (starred ? ' starred' : '') + '">★</span>' +
      '<span class="list-term">' + escapeHtml(state.termFirst ? c.term : c.definition) + '</span>' +
      '<span class="list-divider"></span>' +
      '<span class="list-def' + (isRevealed ? '' : ' blurred') + '">' +
      escapeHtml(state.termFirst ? c.definition : c.term) +
      '</span>' +
      '</div>';
  }).join('');

  list.querySelectorAll('.list-star').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleStarById(el.parentElement.dataset.id);
    });
  });

  list.querySelectorAll('.list-def').forEach(function (el) {
    el.addEventListener('click', function () {
      toggleReveal(el.parentElement.dataset.id);
    });
  });
}

function toggleStarById(id) {
  var cards = getActiveCards();
  var card = cards.find(function (c) { return c.id === id; });
  if (!card) return;

  var key = cardKey(card);
  if (state.starredCardKeys.has(key)) {
    state.starredCardKeys.delete(key);
    state.starredCardsData = state.starredCardsData.filter(function (c) { return cardKey(c) !== key; });
  } else {
    state.starredCardKeys.add(key);
    state.starredCardsData.push({ id: Date.now().toString(), term: card.term, definition: card.definition });
  }

  saveFavorites();
  updateFavoritesDeck();
  renderList();
  updateFlashcard();
}

function toggleReveal(id) {
  if (state.revealedIds.has(id)) {
    state.revealedIds.delete(id);
  } else {
    state.revealedIds.add(id);
  }
  renderList();
}

function revealAll() {
  getFilteredCards().forEach(function (c) { state.revealedIds.add(c.id); });
  renderList();
}

function shuffleListMode() {
  var cards = getActiveCards();
  for (var i = cards.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = cards[i];
    cards[i] = cards[j];
    cards[j] = temp;
  }
  state.revealedIds = new Set();
  if (!state.studyingFavorites) saveDecks();
  renderList();
}

function resetListMode() {
  state.revealedIds = new Set();
  renderList();
}

// Edit Modal
function openEditModal() {
  var deck = getActiveDeck();
  if (!deck) return;
  $('editDeckName').value = deck.name;
  renderCardEditor();
  openModal('editModal');
}

function renderCardEditor() {
  var deck = getActiveDeck();
  if (!deck) return;

  var editor = $('cardEditor');
  editor.innerHTML = deck.cards.map(function (c, i) {
    return '<div class="card-edit-row" data-index="' + i + '">' +
      '<input type="text" value="' + escapeHtml(c.term) + '" placeholder="Term" class="term-input">' +
      '<input type="text" value="' + escapeHtml(c.definition) + '" placeholder="Definition" class="def-input">' +
      '<span class="delete-card">×</span>' +
      '</div>';
  }).join('');

  editor.querySelectorAll('.delete-card').forEach(function (el) {
    el.addEventListener('click', function () {
      var idx = parseInt(el.parentElement.dataset.index);
      deck.cards.splice(idx, 1);
      renderCardEditor();
    });
  });
}

function addCardRow() {
  var deck = getActiveDeck();
  if (!deck) return;
  deck.cards.push({ id: Date.now().toString(), term: '', definition: '' });
  renderCardEditor();
}

function saveEdit() {
  var deck = getActiveDeck();
  if (!deck) return;

  deck.name = $('editDeckName').value.trim() || 'Untitled';

  var rows = $('cardEditor').querySelectorAll('.card-edit-row');
  rows.forEach(function (row, i) {
    if (deck.cards[i]) {
      deck.cards[i].term = row.querySelector('.term-input').value;
      deck.cards[i].definition = row.querySelector('.def-input').value;
    }
  });

  deck.cards = deck.cards.filter(function (c) { return c.term || c.definition; });

  saveDecks();
  renderDeckList();
  $('deckTitle').textContent = deck.name;
  $('cardCount').textContent = '(' + deck.cards.length + ' cards)';
  updateFlashcard();
  renderList();
  closeModal('editModal');
}

function deleteDeck() {
  if (!confirm('Delete this deck?')) return;
  state.decks = state.decks.filter(function (d) { return d.id !== state.activeDeckId; });
  state.activeDeckId = null;
  saveDecks();
  renderDeckList();
  $('emptyState').style.display = 'flex';
  $('studyArea').style.display = 'none';
  closeModal('editModal');
}

// Keyboard
function handleKeyboard(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

  var editOpen = $('editModal').style.display !== 'none';
  var csvOpen = $('csvModal').style.display !== 'none';
  var settingsOpen = $('settingsModal').style.display !== 'none';
  if (editOpen || csvOpen || settingsOpen) {
    if (e.code === 'Escape') {
      if (editOpen) closeModal('editModal');
      if (csvOpen) closeModal('csvModal');
      if (settingsOpen) closeModal('settingsModal');
    }
    return;
  }

  var cards = getActiveCards();

  if (state.mode === 'flashcard' && cards.length > 0) {
    if ((e.code === 'Space' || e.code === 'Enter') && !state.typingMode) {
      e.preventDefault();
      flipCard();
    }
    if (e.code === 'ArrowRight') {
      e.preventDefault();
      nextCard();
    }
    if (e.code === 'ArrowLeft') {
      e.preventDefault();
      prevCard();
    }
  }

  if (state.mode === 'list' && cards.length > 0) {
    var filtered = getFilteredCards();
    if (e.code === 'ArrowDown') {
      e.preventDefault();
      handleListArrowDown(filtered);
    }
    if (e.code === 'ArrowUp') {
      e.preventDefault();
      handleListArrowUp(filtered);
    }
  }
}

var listSelectedIdx = -1;

function handleListArrowDown(cards) {
  if (cards.length === 0) return;

  if (listSelectedIdx >= 0 && listSelectedIdx < cards.length) {
    var currentCard = cards[listSelectedIdx];
    if (!state.revealedIds.has(currentCard.id)) {
      state.revealedIds.add(currentCard.id);
      renderList();
      highlightListCard(listSelectedIdx);
      return;
    }
  }

  listSelectedIdx = Math.min(listSelectedIdx + 1, cards.length - 1);
  if (listSelectedIdx < 0) listSelectedIdx = 0;
  renderList();
  highlightListCard(listSelectedIdx);
}

function handleListArrowUp(cards) {
  if (cards.length === 0) return;

  if (listSelectedIdx >= 0 && listSelectedIdx < cards.length) {
    var currentCard = cards[listSelectedIdx];
    state.revealedIds.delete(currentCard.id);
  }

  listSelectedIdx = Math.max(listSelectedIdx - 1, 0);
  renderList();
  highlightListCard(listSelectedIdx);
}

function highlightListCard(idx) {
  document.querySelectorAll('.list-card').forEach(function (el, i) {
    el.classList.toggle('selected', i === idx);
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
