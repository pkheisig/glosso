# Russian Lookup Chrome Extension

A minimalistic, high-performance Chrome extension designed to assist Russian language learners by providing instant translations and detailed grammar information (declension/conjugation) directly in the browser.

## Features

- **Hover-to-Translate**: Hover over any Russian word to instantly see its English translation.
- **Detailed Grammar Tables**: Automatically fetches and displays declension tables for nouns/adjectives and conjugation tables for verbs from Wiktionary.
- **Form Identification**: Automatically identifies and highlights the specific grammatical form of the hovered word (e.g., "3rd person singular, present tense") by highlighting matching cells within the grammar tables.
- **Lemma Detection**: Smart lookup that identifies the base form (lemma) of inflected words to ensure accurate data retrieval.
- **Clean UI**: Minimalistic design with dotted underlines for identified words, using the default system cursor and no distracting background colors.
- **Stress Mark Handling**: Automatically strips Cyrillic stress marks (e.g., "а́") for robust dictionary matching while preserving the original text's appearance.
- **No Transliterations**: Focused purely on Cyrillic and English, stripping out Latin script transliterations for a cleaner experience.

## Technical Implementation

- **Manifest V3**: Built using the latest Chrome Extension standards.
- **Cross-Site Bypass**: Utilizes a background service worker to perform API requests, bypassing Content Security Policy (CSP) restrictions on sites like Wikipedia or news outlets.
- **Dual API Strategy**:
  - **Wiktionary REST API**: Used for fast retrieval of concise English definitions.
  - **Wiktionary Action API**: Used to fetch full page content for extracting complex inflection tables.
- **Efficient DOM Scanning**: Uses `TreeWalker` and `MutationObserver` to identify Russian text efficiently without degrading page performance.
- **Intelligent Parsing**: Custom DOM parsing logic to extract the Russian-specific sections from Wiktionary's multi-language pages.

## Installation

1. Clone or download this repository.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **"Developer mode"** in the top right corner.
4. Click **"Load unpacked"** and select the `russian-lookup` folder.

## Usage

- Once installed, the extension is active on all websites.
- Any Russian word longer than 2 characters will have a subtle dotted underline.
- Simply hover your cursor over a word to see the tooltip.
- The tooltip will show the base form, the translation, and any relevant grammar tables with the matching form highlighted in yellow.

## Development Notes

- **Minimalistic Codebase**: Follows strict simplicity guidelines—no complex frameworks, minimal commenting, and direct procedural logic for readability.
- **Sister Project**: Core hover logic inspired by the `genesymbol-highlighter` project.
