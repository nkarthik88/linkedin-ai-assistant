/**
 * ProPostly Reddit content script.
 * Injects "🟠 Draft AI Reply" buttons into Reddit comment composers.
 * Handles both new Reddit (shreddit) and old.reddit.com.
 */

const BUTTON_CLASS = "propostly-reddit-btn";

function injectButton(composer) {
  if (composer.querySelector(`.${BUTTON_CLASS}`)) return;

  const btn = document.createElement("button");
  btn.className = BUTTON_CLASS;
  btn.textContent = "🟠 Draft AI Reply";
  btn.title = "Open ProPostly to draft an AI reply";
  btn.type = "button";
  btn.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin: 6px 0;
    padding: 6px 12px;
    background: #FF4500;
    color: #fff;
    border: none;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    z-index: 9999;
  `;

  btn.addEventListener("click", () => {
    const text = readCommentText(composer);
    chrome.runtime.sendMessage({
      type: "REDDIT_DRAFT_REPLY",
      commentText: text,
    });
  });

  composer.insertAdjacentElement("beforebegin", btn);
}

function readCommentText(composer) {
  const shadowHost = composer.querySelector("[contenteditable]");
  if (shadowHost) return shadowHost.innerText || shadowHost.textContent || "";

  const textarea = composer.querySelector("textarea");
  if (textarea) return textarea.value || "";

  let el = composer.parentElement;
  for (let i = 0; i < 6 && el; i++) {
    const p = el.querySelector("p, [data-testid='comment'], .md");
    if (p) return p.innerText || p.textContent || "";
    el = el.parentElement;
  }
  return "";
}

// Process only newly added nodes — not the entire DOM
function processNewNodes(addedNodes) {
  addedNodes.forEach((node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    // Check if the added node itself is a composer
    if (
      node.matches("shreddit-composer, form[id*='comment'], .commentarea form, .usertext-edit")
    ) {
      injectButton(node);
    }

    // Check children of the added node
    node.querySelectorAll(
      "shreddit-composer, form[id*='comment'], .commentarea form, .usertext-edit"
    ).forEach(injectButton);
  });
}

function processAllComposers() {
  document.querySelectorAll(
    "shreddit-composer, form[id*='comment'], .commentarea form, .usertext-edit"
  ).forEach(injectButton);
}

// Initial pass
processAllComposers();

// Target the comment container specifically — not document.body
const TARGET_SELECTORS = [
  "#comment-tree",         // new Reddit shreddit
  ".commentarea",          // old Reddit
  "[data-scrim-type='comment-thread']",
  "main",                  // fallback
];

const targetNode = TARGET_SELECTORS.reduce(
  (found, sel) => found || document.querySelector(sel),
  null
) || document.body;

const OBS_CONFIG = { childList: true, subtree: true };

const observer = new MutationObserver((mutations) => {
  // Disconnect immediately to prevent recursive re-triggering
  observer.disconnect();

  // Use requestIdleCallback — only runs when main thread is free
  requestIdleCallback(() => {
    mutations.forEach((mutation) => {
      // Only process if nodes were actually added
      if (mutation.addedNodes.length > 0) {
        processNewNodes(mutation.addedNodes);
      }
    });

    // Reconnect after processing is done
    observer.observe(targetNode, OBS_CONFIG);
  });
});

observer.observe(targetNode, OBS_CONFIG);
