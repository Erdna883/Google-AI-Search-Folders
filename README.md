# Google AI Search Folders (Chrome Extension)

A lightweight extension to organize Google AI/search pages into folders, like chat folders.

## Features
- Create, rename, and delete folders.
- Save the current Google search tab into a selected folder.
- Remove saved entries.
- Open saved searches directly from the popup.
- Detect lightweight metadata from Google pages, including query text and AI-overview signals.
- Use a full library page for search, filtering, moving entries between folders, and cleanup.
- Export and import your saved folders as JSON.
- Data is stored in `chrome.storage.local`.

## Install (Developer Mode)
1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.

## Notes
- The extension currently saves Google pages (`google.com` / `www.google.com`) with search-like URLs.
- AI detection is heuristic-based because Google changes markup often. If selectors drift, the fallback still saves the tab URL/title.
- The full manager page is available from the popup via **Open Library** or directly through the extension's options page.
