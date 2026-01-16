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
  theme: 'dark'
};

var $ = function (id) { return document.getElementById(id); };

// Storage abstraction - uses chrome.storage if available, else localStorage
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
  storage.get(['flashcardDecks', 'flashcardSettings'], function (result) {
    state.decks = result.flashcardDecks || [];
    var settings = result.flashcardSettings || {};
    state.termFirst = settings.termFirst !== false;
    state.theme = settings.theme || 'dark';
    renderDeckList();
    updateTheme();

    if (state.decks.length > 0 && !state.activeDeckId) {
      selectDeck(state.decks[0].id);
    }
  });
}

function saveDecks() {
  storage.set({ flashcardDecks: state.decks });
}

function saveSettings() {
  storage.set({ flashcardSettings: { termFirst: state.termFirst, theme: state.theme } });
}

function bindEvents() {
  // CSV file input
  $('csvInput').addEventListener('change', handleCSVFile);

  // Theme toggle
  $('toggleTheme').addEventListener('click', toggleTheme);

  // Mode toggle
  $('modeFlashcard').addEventListener('click', function () { setMode('flashcard'); });
  $('modeList').addEventListener('click', function () { setMode('list'); });

  // Toolbar buttons
  $('shuffleBtn').addEventListener('click', shuffleCards);
  $('flipDirection').addEventListener('click', toggleDirection);
  $('editDeck').addEventListener('click', openEditModal);

  // Flashcard controls
  $('flashcard').addEventListener('click', flipCard);
  $('prevBtn').addEventListener('click', prevCard);
  $('nextBtn').addEventListener('click', nextCard);
  $('starBtn').addEventListener('click', toggleStar);

  // List mode
  $('searchInput').addEventListener('input', function (e) {
    state.searchQuery = e.target.value;
    renderList();
  });
  $('revealAllBtn').addEventListener('click', revealAll);

  // Edit modal
  $('addCardBtn').addEventListener('click', addCardRow);
  $('deleteDeck').addEventListener('click', deleteDeck);
  $('saveChanges').addEventListener('click', saveEdit);

  // CSV modal
  $('cancelCsv').addEventListener('click', function () { closeModal('csvModal'); });
  $('confirmCsv').addEventListener('click', confirmCSVImport);
  $('termColumn').addEventListener('change', updateCSVPreview);
  $('defColumn').addEventListener('change', updateCSVPreview);

  // Modal close buttons and backdrops
  document.querySelectorAll('.modal-close').forEach(function (btn) {
    btn.addEventListener('click', function () {
      closeModal(btn.dataset.close);
    });
  });
  document.querySelectorAll('.modal-backdrop').forEach(function (backdrop) {
    backdrop.addEventListener('click', function () {
      var modal = backdrop.parentElement;
      modal.style.display = 'none';
    });
  });

  // Keyboard
  document.addEventListener('keydown', handleKeyboard);
}

function openModal(id) {
  $(id).style.display = 'flex';
}

function closeModal(id) {
  $(id).style.display = 'none';
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  updateTheme();
  saveSettings();
}

function updateTheme() {
  document.body.dataset.theme = state.theme;
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
  if (lines.length < 2) {
    alert('CSV file is empty or has no data rows');
    return;
  }

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
        definition: row[defIdx] || '',
        starred: false
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
    var isActive = d.id === state.activeDeckId;
    return '<div class="deck-item' + (isActive ? ' active' : '') + '" data-id="' + d.id + '">' +
      '<span class="deck-name">' + escapeHtml(d.name) + '</span>' +
      '<span class="deck-count">' + d.cards.length + '</span>' +
      '</div>';
  }).join('');

  list.querySelectorAll('.deck-item').forEach(function (el) {
    el.addEventListener('click', function () {
      selectDeck(el.dataset.id);
    });
  });
}

function selectDeck(id) {
  state.activeDeckId = id;
  state.currentIndex = 0;
  state.isFlipped = false;
  state.revealedIds = new Set();
  state.searchQuery = '';
  $('searchInput').value = '';

  renderDeckList();

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
  return state.decks.find(function (d) { return d.id === state.activeDeckId; });
}

function getActiveCards() {
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

  $('starBtn').classList.toggle('starred', card.starred);
  $('starBtn').textContent = card.starred ? '★' : '☆';
}

function flipCard() {
  state.isFlipped = !state.isFlipped;
  $('flashcard').classList.toggle('flipped', state.isFlipped);
}

function nextCard() {
  var cards = getActiveCards();
  if (state.currentIndex < cards.length - 1) {
    state.currentIndex++;
    state.isFlipped = false;
    updateFlashcard();
  }
}

function prevCard() {
  if (state.currentIndex > 0) {
    state.currentIndex--;
    state.isFlipped = false;
    updateFlashcard();
  }
}

function toggleStar() {
  var deck = getActiveDeck();
  if (!deck || !deck.cards[state.currentIndex]) return;
  deck.cards[state.currentIndex].starred = !deck.cards[state.currentIndex].starred;
  saveDecks();
  updateFlashcard();
  renderList();
}

function shuffleCards() {
  var deck = getActiveDeck();
  if (!deck) return;
  for (var i = deck.cards.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = deck.cards[i];
    deck.cards[i] = deck.cards[j];
    deck.cards[j] = temp;
  }
  state.currentIndex = 0;
  state.isFlipped = false;
  saveDecks();
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

  list.innerHTML = cards.map(function (c) {
    var isRevealed = state.revealedIds.has(c.id);
    return '<div class="list-card" data-id="' + c.id + '">' +
      '<span class="list-star' + (c.starred ? ' starred' : '') + '">★</span>' +
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
  var deck = getActiveDeck();
  if (!deck) return;
  var card = deck.cards.find(function (c) { return c.id === id; });
  if (card) {
    card.starred = !card.starred;
    saveDecks();
    renderList();
    updateFlashcard();
  }
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
  deck.cards.push({ id: Date.now().toString(), term: '', definition: '', starred: false });
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
  if (editOpen || csvOpen) {
    if (e.code === 'Escape') {
      if (editOpen) closeModal('editModal');
      if (csvOpen) closeModal('csvModal');
    }
    return;
  }

  if (state.mode === 'flashcard' && getActiveCards().length > 0) {
    if (e.code === 'Space' || e.code === 'Enter') {
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
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
