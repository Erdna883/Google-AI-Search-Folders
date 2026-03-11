const STORAGE_KEY = "aiSearchFolders";

const els = {
  newFolderBtn: document.getElementById("new-folder-btn"),
  exportBtn: document.getElementById("export-btn"),
  importInput: document.getElementById("import-input"),
  searchInput: document.getElementById("search-input"),
  folderFilter: document.getElementById("folder-filter"),
  typeFilter: document.getElementById("type-filter"),
  foldersCount: document.getElementById("folders-count"),
  entriesCount: document.getElementById("entries-count"),
  aiCount: document.getElementById("ai-count"),
  emptyState: document.getElementById("empty-state"),
  results: document.getElementById("results"),
  folderTemplate: document.getElementById("folder-template"),
  entryTemplate: document.getElementById("entry-template"),
};

let state = [];

init().catch((error) => {
  console.error(error);
});

async function init() {
  state = await loadFolders();
  wireEvents();
  render();
}

function wireEvents() {
  els.newFolderBtn.addEventListener("click", async () => {
    const name = prompt("Folder name");
    if (!name) {
      return;
    }

    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }

    if (state.some((folder) => folder.name.toLowerCase() === trimmed.toLowerCase())) {
      alert("Folder already exists.");
      return;
    }

    state.unshift(createFolder(trimmed));
    await saveFolders(state);
    render();
  });

  els.exportBtn.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ai-search-folders-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  });

  els.importInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    const parsed = JSON.parse(text);
    const imported = migrateFolders(parsed);
    if (!Array.isArray(imported)) {
      throw new Error("Import file must be an array.");
    }

    state = mergeFolders(state, imported);
    await saveFolders(state);
    els.importInput.value = "";
    render();
  });

  els.searchInput.addEventListener("input", render);
  els.folderFilter.addEventListener("change", render);
  els.typeFilter.addEventListener("change", render);
}

function render() {
  renderCounts();
  renderFolderFilter();
  renderResults();
}

function renderCounts() {
  els.foldersCount.textContent = String(state.length);
  els.entriesCount.textContent = String(state.reduce((sum, folder) => sum + folder.entries.length, 0));
  els.aiCount.textContent = String(
    state.reduce((sum, folder) => sum + folder.entries.filter((entry) => entry.aiMode).length, 0)
  );
}

function renderFolderFilter() {
  const previous = els.folderFilter.value || "all";
  els.folderFilter.innerHTML = '<option value="all">All folders</option>';

  for (const folder of state) {
    const option = document.createElement("option");
    option.value = folder.id;
    option.textContent = folder.name;
    els.folderFilter.append(option);
  }

  els.folderFilter.value = state.some((folder) => folder.id === previous) ? previous : "all";
}

function renderResults() {
  const filtered = filterFolders(state, {
    search: els.searchInput.value.trim().toLowerCase(),
    folderId: els.folderFilter.value,
    type: els.typeFilter.value,
  });

  els.results.innerHTML = "";
  els.emptyState.classList.toggle("hidden", filtered.length > 0);

  for (const folder of filtered) {
    const folderNode = els.folderTemplate.content.firstElementChild.cloneNode(true);
    folderNode.querySelector(".folder-kicker").textContent = `${folder.entries.length} entries`;
    folderNode.querySelector(".folder-title").textContent = folder.name;

    folderNode.querySelector(".rename-folder").addEventListener("click", async () => {
      const next = prompt("Rename folder", folder.name);
      if (!next) {
        return;
      }

      const trimmed = next.trim();
      if (!trimmed) {
        return;
      }

      const target = state.find((candidate) => candidate.id === folder.id);
      if (!target) {
        return;
      }

      target.name = trimmed;
      await saveFolders(state);
      render();
    });

    folderNode.querySelector(".delete-folder").addEventListener("click", async () => {
      if (!confirm(`Delete folder "${folder.name}" and all entries?`)) {
        return;
      }

      state = state.filter((candidate) => candidate.id !== folder.id);
      await saveFolders(state);
      render();
    });

    const entriesNode = folderNode.querySelector(".entries");
    for (const entry of folder.entries) {
      const entryNode = els.entryTemplate.content.firstElementChild.cloneNode(true);
      entryNode.querySelector(".entry-badge").textContent = entry.aiMode ? "AI capture" : "Search page";

      const title = entryNode.querySelector(".entry-title");
      title.href = entry.url;
      title.textContent = entry.title;

      entryNode.querySelector(".entry-query").textContent = entry.query ? `Query: ${entry.query}` : "";
      entryNode.querySelector(".entry-summary").textContent = entry.summary || "";
      entryNode.querySelector(".entry-meta").textContent = `${new Date(entry.savedAt).toLocaleString()} • ${entry.url}`;

      entryNode.querySelector(".copy-link").addEventListener("click", async () => {
        await navigator.clipboard.writeText(entry.url);
      });

      const moveSelect = entryNode.querySelector(".move-entry");
      populateMoveOptions(moveSelect, folder.id);
      moveSelect.addEventListener("change", async () => {
        if (!moveSelect.value || moveSelect.value === folder.id) {
          return;
        }

        moveEntry(entry.id, folder.id, moveSelect.value);
        await saveFolders(state);
        render();
      });

      entryNode.querySelector(".delete-entry").addEventListener("click", async () => {
        const target = state.find((candidate) => candidate.id === folder.id);
        if (!target) {
          return;
        }

        target.entries = target.entries.filter((candidate) => candidate.id !== entry.id);
        await saveFolders(state);
        render();
      });

      entriesNode.append(entryNode);
    }

    els.results.append(folderNode);
  }
}

function populateMoveOptions(select, currentFolderId) {
  select.innerHTML = '<option value="">Move to...</option>';
  for (const folder of state) {
    if (folder.id === currentFolderId) {
      continue;
    }

    const option = document.createElement("option");
    option.value = folder.id;
    option.textContent = folder.name;
    select.append(option);
  }
}

function moveEntry(entryId, fromFolderId, toFolderId) {
  const fromFolder = state.find((folder) => folder.id === fromFolderId);
  const toFolder = state.find((folder) => folder.id === toFolderId);
  if (!fromFolder || !toFolder) {
    return;
  }

  const entry = fromFolder.entries.find((candidate) => candidate.id === entryId);
  if (!entry) {
    return;
  }

  if (toFolder.entries.some((candidate) => candidate.url === entry.url)) {
    fromFolder.entries = fromFolder.entries.filter((candidate) => candidate.id !== entryId);
    return;
  }

  fromFolder.entries = fromFolder.entries.filter((candidate) => candidate.id !== entryId);
  toFolder.entries.unshift(entry);
}

function filterFolders(folders, filters) {
  return folders
    .filter((folder) => filters.folderId === "all" || folder.id === filters.folderId)
    .map((folder) => ({
      ...folder,
      entries: folder.entries.filter((entry) => matchesEntry(folder, entry, filters)),
    }))
    .filter((folder) => folder.entries.length > 0 || (!filters.search && filters.folderId !== "all" && folder.id === filters.folderId));
}

function matchesEntry(folder, entry, filters) {
  if (filters.type === "ai" && !entry.aiMode) {
    return false;
  }

  if (filters.type === "standard" && entry.aiMode) {
    return false;
  }

  if (!filters.search) {
    return true;
  }

  const haystack = [
    folder.name,
    entry.title,
    entry.query,
    entry.summary,
    entry.url,
  ].join(" ").toLowerCase();

  return haystack.includes(filters.search);
}

function createFolder(name) {
  return {
    id: crypto.randomUUID(),
    name,
    entries: [],
    createdAt: new Date().toISOString(),
  };
}

function mergeFolders(existing, imported) {
  const next = structuredClone(existing);

  for (const folder of imported) {
    const match = next.find((candidate) => candidate.name.toLowerCase() === folder.name.toLowerCase());
    if (!match) {
      next.push(folder);
      continue;
    }

    for (const entry of folder.entries) {
      if (!match.entries.some((candidate) => candidate.url === entry.url)) {
        match.entries.push(entry);
      }
    }
  }

  return next;
}

async function loadFolders() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return migrateFolders(data[STORAGE_KEY]);
}

function migrateFolders(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.map((folder) => ({
    id: folder.id || crypto.randomUUID(),
    name: String(folder.name || "Untitled"),
    createdAt: folder.createdAt || new Date().toISOString(),
    entries: Array.isArray(folder.entries)
      ? folder.entries
          .map((entry) => ({
            id: entry.id || crypto.randomUUID(),
            title: String(entry.title || "Google search"),
            url: String(entry.url || ""),
            query: String(entry.query || ""),
            aiMode: Boolean(entry.aiMode),
            summary: String(entry.summary || ""),
            savedAt: entry.savedAt || new Date().toISOString(),
          }))
          .filter((entry) => entry.url)
      : [],
  }));
}

async function saveFolders(folders) {
  await chrome.storage.local.set({ [STORAGE_KEY]: folders });
}
