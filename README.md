# Glosso

A Chrome extension for instant definitions from Wiktionary with multi-language support.

## Features

- **Hover-to-Translate**: Hover over any word to see its definition instantly.
- **Multi-Language Support**: Works with 30+ languages including Russian, Ukrainian, Spanish, German, French, Swedish, Greek, and more.
- **Smart Fuzzy Search**: Automatically finds the closest match if the exact word isn't found (great for inflected forms).
- **Auto-Language Detection**: Automatically finds the right language section even if your settings differ.
- **Grammar Tables**: Displays declension/conjugation tables from Wiktionary.
- **Base Form Detection**: Identifies lemmas and fetches their definitions for inflected words.
- **Google Search**: Quick "define X" button for alternative lookups.
- **Save Words**: Build a vocabulary list and export to CSV.

## Supported Languages

Latin script: Spanish, French, German, Portuguese, Italian, Dutch, Polish, Swedish, Turkish, and many more.

Cyrillic script: Russian, Ukrainian, Belarusian, Bulgarian, Serbian, Macedonian.

Greek script: Greek, Ancient Greek.

*Note: CJK languages (Chinese, Japanese, Korean) and Arabic script languages are not supported due to word segmentation requirements.*

## Installation

1. Clone or download this repository.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select this folder.

## Usage

- Words are automatically underlined on all websites.
- Hover to see definitions and grammar tables.
- Click **Save** to add words to your vocabulary list.
- Click **Google** to search for the definition on Google.
- Access saved words and settings from the extension popup.

## Technical Notes

- Manifest V3
- Background service worker for API requests
- Wiktionary Parse API with redirect and fuzzy search fallback
- Universal Unicode regex for word detection
