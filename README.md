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

## Installation
This extension does not require a build step or package installation.

### 1. Get the code
Clone the repository:

```bash
git clone https://github.com/Erdna883/Google-AI-Search-Folders.git
cd Google-AI-Search-Folders
```

Or download the project as a ZIP and extract it locally.

### 2. Load the extension in Chrome
1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `Google-AI-Search-Folders` project folder.

### 3. Start using it
1. Open a Google search or Google AI results page.
2. Click the extension icon.
3. Create a folder and save the current page.

## Notes
- The extension currently saves Google pages (`google.com` / `www.google.com`) with search-like URLs.
- AI detection is heuristic-based because Google changes markup often. If selectors drift, the fallback still saves the tab URL/title.
- The full manager page is available from the popup via **Open Library** or directly through the extension's options page.
