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
  // Try contenteditable inside shadow DOM (shreddit)
  const shadowHost = composer.querySelector("[contenteditable]");
  if (shadowHost) return shadowHost.innerText || shadowHost.textContent || "";

  // Try textarea
  const textarea = composer.querySelector("textarea");
  if (textarea) return textarea.value || "";

  // Walk up to find nearby comment text (the parent comment being replied to)
  let el = composer.parentElement;
  for (let i = 0; i < 6 && el; i++) {
    const p = el.querySelector("p, [data-testid='comment'], .md");
    if (p) return p.innerText || p.textContent || "";
    el = el.parentElement;
  }
  return "";
}

function processNewComposers() {
  // New Reddit shreddit-composer
  document.querySelectorAll("shreddit-composer").forEach(injectButton);

  // Standard comment forms
  document
    .querySelectorAll("form[id*='comment'], .commentarea form, .usertext-edit")
    .forEach(injectButton);
}

// Initial pass
processNewComposers();

// Watch for dynamically added composers (Reddit is a SPA)
const observer = new MutationObserver(() => {
  processNewComposers();
});

observer.observe(document.body, { childList: true, subtree: true });
