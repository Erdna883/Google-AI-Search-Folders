chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "GET_PAGE_CAPTURE") {
    return;
  }

  sendResponse({
    capture: {
      title: getTitle(),
      query: getQuery(),
      aiMode: hasAiSignals(),
      summary: getSummary(),
    },
  });
});

function getTitle() {
  const heading = document.querySelector("h1");
  if (heading?.textContent?.trim()) {
    return heading.textContent.trim();
  }

  return document.title || "Google search";
}

function getQuery() {
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
}

function hasAiSignals() {
  const selectors = [
    "[data-attrid='title']",
    "[data-md='61']",
    "[data-init-vis='false']",
    "div[aria-label*='AI']",
    "div[data-hveid] g-section-with-header",
  ];

  return selectors.some((selector) => document.querySelector(selector));
}

function getSummary() {
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
}
