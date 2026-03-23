const STORAGE_KEY = "aiSearchFolders";
const MANAGER_URL = chrome.runtime.getURL("src/manager.html");
const GOOGLE_AI_SEARCH_URL = "https://www.google.com/search?udm=50";

const els = {
  openGoogleAiBtn: document.getElementById("open-google-ai-btn"),
  openLibraryBtn: document.getElementById("open-library-btn"),
  newFolderBtn: document.getElementById("new-folder-btn"),
  newFolderPanel: document.getElementById("new-folder-panel"),
  newFolderInput: document.getElementById("new-folder-input"),
  createFolderBtn: document.getElementById("create-folder-btn"),
  cancelFolderBtn: document.getElementById("cancel-folder-btn"),
  folderSelect: document.getElementById("folder-select"),
  saveCurrentBtn: document.getElementById("save-current-btn"),
  folderList: document.getElementById("folder-list"),
  status: document.getElementById("status"),
  currentTitle: document.getElementById("current-title"),
  currentQuery: document.getElementById("current-query"),
  currentMeta: document.getElementById("current-meta"),
  statsGrid: document.getElementById("stats-grid"),
  folderTemplate: document.getElementById("folder-template"),
  entryTemplate: document.getElementById("entry-template"),
};

let state = [];
let currentCapture = null;

init().catch((err) => {
  setStatus(`Initialization error: ${String(err)}`);
});

async function init() {
  state = await loadFolders();
  currentCapture = await getCurrentCapture();
  render();
  wireEvents();
}

function wireEvents() {
  els.openGoogleAiBtn.addEventListener("click", async () => {
    await chrome.tabs.create({ url: GOOGLE_AI_SEARCH_URL });
  });

  els.openLibraryBtn.addEventListener("click", async () => {
    await chrome.tabs.create({ url: MANAGER_URL });
  });

  els.newFolderBtn.addEventListener("click", () => {
    els.newFolderPanel.classList.remove("hidden");
    els.newFolderInput.focus();
  });

  els.cancelFolderBtn.addEventListener("click", () => {
    els.newFolderPanel.classList.add("hidden");
    els.newFolderInput.value = "";
  });

  els.createFolderBtn.addEventListener("click", async () => {
    const name = els.newFolderInput.value.trim();
    if (!name) {
      setStatus("Folder name cannot be empty.");
      return;
    }

    if (state.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
      setStatus("Folder already exists.");
      return;
    }

    const folder = {
      id: crypto.randomUUID(),
      name,
      entries: [],
      createdAt: new Date().toISOString(),
    };

    state.unshift(folder);
    await saveFolders(state);
    els.newFolderInput.value = "";
    els.newFolderPanel.classList.add("hidden");
    render();
    setStatus(`Created folder "${name}".`);
  });

  els.saveCurrentBtn.addEventListener("click", async () => {
    if (!state.length) {
      setStatus("Create a folder first.");
      return;
    }

    const folderId = els.folderSelect.value;
    const folder = state.find((f) => f.id === folderId);
    if (!folder) {
      setStatus("Selected folder not found.");
      return;
    }

    const capture = currentCapture || await getCurrentCapture();
    if (!capture || !capture.url || !isGoogleSearchUrl(capture.url)) {
      setStatus("Open a Google search/AI page to save it.");
      return;
    }

    const duplicate = folder.entries.find((e) => e.url === capture.url);
    if (duplicate) {
      setStatus("This page is already saved in that folder.");
      return;
    }

    folder.entries.unshift(buildEntryFromCapture(capture));

    await saveFolders(state);
    currentCapture = capture;
    render();
    setStatus("Saved current tab.");
  });
}

function render() {
  renderCurrentCapture();
  renderStats();
  renderFolderSelect();
  renderFolders();
}

function renderCurrentCapture() {
  if (!currentCapture) {
    els.currentTitle.textContent = "Open a Google AI result";
    els.currentQuery.textContent = "No query detected yet.";
    els.currentMeta.textContent = "Capture details appear here when a supported tab is active.";
    return;
  }

  els.currentTitle.textContent = currentCapture.title || "Google search";
  els.currentQuery.textContent = currentCapture.query
    ? `Query: ${currentCapture.query}`
    : "Google page detected without a query string.";
  els.currentMeta.textContent = currentCapture.aiMode
    ? "AI overview signals detected on the page."
    : "Standard Google result page detected.";
}

function renderStats() {
  const folderCount = state.length;
  const entryCount = state.reduce((total, folder) => total + folder.entries.length, 0);
  const aiCount = state.reduce((total, folder) => {
    return total + folder.entries.filter((entry) => entry.aiMode).length;
  }, 0);

  els.statsGrid.innerHTML = "";
  for (const stat of [
    { label: "Folders", value: folderCount },
    { label: "Saved pages", value: entryCount },
    { label: "AI captures", value: aiCount },
  ]) {
    const node = document.createElement("article");
    node.className = "stat-card";
    node.innerHTML = `<span class="stat-value">${stat.value}</span><span class="stat-label">${stat.label}</span>`;
    els.statsGrid.append(node);
  }
}

function renderFolderSelect() {
  els.folderSelect.innerHTML = "";

  if (!state.length) {
    const option = document.createElement("option");
    option.textContent = "No folders yet";
    option.value = "";
    els.folderSelect.append(option);
    els.folderSelect.disabled = true;
    els.saveCurrentBtn.disabled = true;
    return;
  }

  els.folderSelect.disabled = false;
  els.saveCurrentBtn.disabled = false;

  for (const folder of state) {
    const option = document.createElement("option");
    option.value = folder.id;
    option.textContent = folder.name;
    els.folderSelect.append(option);
  }
}

function renderFolders() {
  els.folderList.innerHTML = "";

  for (const folder of state) {
    const node = els.folderTemplate.content.firstElementChild.cloneNode(true);
    const details = node.querySelector("details");
    node.querySelector(".folder-name").textContent = folder.name;
    node.querySelector(".folder-count").textContent = `${folder.entries.length} saved`;

    const renameBtn = node.querySelector(".rename-folder");
    renameBtn.addEventListener("click", async () => {
      const next = prompt("Rename folder", folder.name);
      if (!next) {
        return;
      }

      const trimmed = next.trim();
      if (!trimmed) {
        setStatus("Folder name cannot be empty.");
        return;
      }

      if (state.some((f) => f.id !== folder.id && f.name.toLowerCase() === trimmed.toLowerCase())) {
        setStatus("A folder with that name already exists.");
        return;
      }

      folder.name = trimmed;
      await saveFolders(state);
      render();
      setStatus("Folder renamed.");
    });

    const deleteFolderBtn = node.querySelector(".delete-folder");
    deleteFolderBtn.addEventListener("click", async () => {
      const confirmed = confirm(`Delete folder "${folder.name}" and all saved entries?`);
      if (!confirmed) {
        return;
      }

      state = state.filter((f) => f.id !== folder.id);
      await saveFolders(state);
      render();
      setStatus("Folder deleted.");
    });

    const list = node.querySelector(".entry-list");
    for (const entry of folder.entries) {
      const entryNode = els.entryTemplate.content.firstElementChild.cloneNode(true);
      const link = entryNode.querySelector(".entry-link");
      link.href = entry.url;
      link.title = entry.title;
      link.textContent = entry.title;
      entryNode.querySelector(".entry-meta").textContent = formatEntryMeta(entry);

      entryNode.querySelector(".copy-link").addEventListener("click", async () => {
        await navigator.clipboard.writeText(entry.url);
        setStatus("Link copied.");
      });

      const deleteEntryBtn = entryNode.querySelector(".delete-entry");
      deleteEntryBtn.addEventListener("click", async () => {
        folder.entries = folder.entries.filter((e) => e.id !== entry.id);
        await saveFolders(state);
        render();
        details.open = true;
        setStatus("Entry removed.");
      });

      list.append(entryNode);
    }

    els.folderList.append(node);
  }
}

function isGoogleSearchUrl(url) {
  try {
    const parsed = new URL(url);
    if (!isGoogleHostname(parsed.hostname)) {
      return false;
    }

    return parsed.pathname.startsWith("/search") || parsed.pathname.startsWith("/travel") || parsed.pathname.startsWith("/finance") || parsed.searchParams.has("q");
  } catch {
    return false;
  }
}

async function loadFolders() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const raw = data[STORAGE_KEY];
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.map((folder) => ({
    id: folder.id || crypto.randomUUID(),
    name: String(folder.name || "Untitled"),
    entries: Array.isArray(folder.entries)
      ? folder.entries.map((entry) => ({
          id: entry.id || crypto.randomUUID(),
          title: String(entry.title || "Google search"),
          url: String(entry.url || ""),
          query: String(entry.query || ""),
          aiMode: Boolean(entry.aiMode),
          summary: String(entry.summary || ""),
          savedAt: entry.savedAt || new Date().toISOString(),
        })).filter((entry) => entry.url)
      : [],
    createdAt: folder.createdAt || new Date().toISOString(),
  }));
}

async function saveFolders(folders) {
  await chrome.storage.local.set({ [STORAGE_KEY]: folders });
}

function setStatus(message) {
  els.status.textContent = message;
}

async function getCurrentCapture() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id || !tab.url || !isGoogleSearchUrl(tab.url)) {
    return null;
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_CAPTURE" });
    if (response?.capture) {
      return normalizeCapture(response.capture, tab);
    }
  } catch {
    // Some Google variants are outside the static content-script match list.
  }

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageCapture,
    });

    if (result?.result) {
      return normalizeCapture(result.result, tab);
    }
  } catch {
    return normalizeCapture(null, tab);
  }

  return normalizeCapture(null, tab);
}

function isGoogleHostname(hostname) {
  return /(^|\.)google\.[a-z.]+$/i.test(hostname);
}

function extractPageCapture() {
  const getTitle = () => {
    const heading = document.querySelector("h1");
    if (heading?.textContent?.trim()) {
      return heading.textContent.trim();
    }

    return document.title || "Google search";
  };

  const getQuery = () => {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get("q");
    if (fromUrl) {
      return fromUrl.trim();
    }

    const searchBox = document.querySelector("textarea[name='q'], input[name='q']");
    if (searchBox instanceof HTMLInputElement || searchBox instanceof HTMLTextAreaElement) {
      return searchBox.value.trim();
    }

    return "";
  };

  const hasAiSignals = () => {
    const selectors = [
      "[data-attrid='title']",
      "[data-md='61']",
      "[data-init-vis='false']",
      "div[aria-label*='AI']",
      "div[data-hveid] g-section-with-header",
    ];

    return selectors.some((selector) => document.querySelector(selector));
  };

  const getSummary = () => {
    const candidates = [
      "[data-attrid='wa:/description']",
      "[data-sncf='1']",
      "div[role='heading'] + div span",
      "div[data-tts='answers'] span",
    ];

    for (const selector of candidates) {
      const node = document.querySelector(selector);
      const text = node?.textContent?.trim();
      if (text) {
        return text.slice(0, 280);
      }
    }

    return "";
  };

  return {
    title: getTitle(),
    query: getQuery(),
    aiMode: hasAiSignals(),
    summary: getSummary(),
  };
}

function normalizeCapture(capture, tab) {
  const url = tab.url || "";
  const parsed = new URL(url);
  const query = capture?.query || parsed.searchParams.get("q") || "";

  return {
    url,
    title: capture?.title || tab.title || "Google search",
    query,
    aiMode: Boolean(capture?.aiMode),
    summary: capture?.summary || "",
  };
}

function buildEntryFromCapture(capture) {
  return {
    id: crypto.randomUUID(),
    title: capture.title || "Google search",
    url: capture.url,
    query: capture.query || "",
    aiMode: Boolean(capture.aiMode),
    summary: capture.summary || "",
    savedAt: new Date().toISOString(),
  };
}

function formatEntryMeta(entry) {
  const parts = [];
  if (entry.query) {
    parts.push(`Q: ${entry.query}`);
  }
  if (entry.aiMode) {
    parts.push("AI overview");
  }
  parts.push(new Date(entry.savedAt).toLocaleDateString());
  return parts.join(" • ");
}
