/**
 * ProPostly — Reddit Panel Controller
 * Manages platform switching and all 5 Reddit features.
 */

const REDDIT_API_BASE = "https://api.propostly.com";
const REDDIT_FREE_LIMIT = 5;

/* ── Helpers ────────────────────────────────────────── */

async function redditGetUserId() {
  const { userId } = await chrome.storage.local.get("userId");
  if (userId) return userId;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ userId: id });
  return id;
}

async function redditGetEmail() {
  const { upgradeEmail } = await chrome.storage.local.get("upgradeEmail");
  return upgradeEmail || "";
}

async function redditGetPlan() {
  try {
    const userId = await redditGetUserId();
    const email = await redditGetEmail();
    if (!email) return "free";
    const r = await fetch(`${REDDIT_API_BASE}/api/auth/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, email }),
    });
    if (!r.ok) return "free";
    const d = await r.json();
    return d.plan || "free";
  } catch {
    return "free";
  }
}

function redditShowView(id) {
  document.querySelectorAll(".reddit-view").forEach((v) => v.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

function redditShowLoading(text = "Generating with AI…") {
  document.getElementById("reddit-loading-text").textContent = text;
  redditShowView("reddit-view-loading");
}

function redditCopyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = "✓ Copied!";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = orig;
      btn.classList.remove("copied");
    }, 2000);
  });
}

/* ── Usage tracking ─────────────────────────────────── */

async function redditGetUsage() {
  const { redditUsage } = await chrome.storage.local.get("redditUsage");
  if (!redditUsage) return {};
  // Reset if new month
  const now = new Date();
  const key = `${now.getFullYear()}-${now.getMonth()}`;
  if (redditUsage.monthKey !== key) return {};
  return redditUsage;
}

async function redditIncrementUsage(feature) {
  const now = new Date();
  const key = `${now.getFullYear()}-${now.getMonth()}`;
  const current = await redditGetUsage();
  const counts = current.counts || {};
  counts[feature] = (counts[feature] || 0) + 1;
  await chrome.storage.local.set({ redditUsage: { monthKey: key, counts } });
  return counts[feature];
}

async function redditCheckLimit(feature) {
  const plan = await redditGetPlan();
  if (plan === "pro" || plan === "plus" || plan === "reddit_pro") return true;
  const usage = await redditGetUsage();
  const counts = usage.counts || {};
  const used = counts[feature] || 0;
  if (used >= REDDIT_FREE_LIMIT) {
    redditShowUpgrade(feature);
    return false;
  }
  return true;
}

function redditShowUpgrade(feature) {
  const labels = {
    post_generator: "Post Generator",
    subreddit_finder: "Subreddit Finder",
    comment_reply: "Comment Reply",
  };
  const desc = document.getElementById("reddit-upgrade-desc");
  if (desc) {
    desc.textContent = `You've used all ${REDDIT_FREE_LIMIT} free Reddit uses for "${labels[feature] || feature}" this month.`;
  }
  redditShowView("reddit-view-upgrade");
}

/* ── API calls ──────────────────────────────────────── */

async function redditCallApi(endpoint, payload) {
  const userId = await redditGetUserId();
  const email = await redditGetEmail();
  const r = await fetch(`${REDDIT_API_BASE}/api/reddit/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, email, ...payload }),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(txt || `Server error ${r.status}`);
  }
  return r.json();
}

/* ── Results renderers ──────────────────────────────── */

function renderRedditPosts(posts) {
  const container = document.getElementById("reddit-results-container");
  const title = document.getElementById("reddit-results-title");
  title.textContent = "Your 3 Post Options";
  container.innerHTML = "";

  posts.forEach((post, i) => {
    const card = document.createElement("div");
    card.className = "reddit-post-card";

    const score = post.antiBanScore ?? null;
    const scoreClass =
      score === null ? "" : score <= 30 ? "safe" : score <= 60 ? "risky" : "danger";
    const scoreEmoji =
      score === null ? "" : score <= 30 ? "✅" : score <= 60 ? "⚠️" : "⛔";
    const scoreBadge =
      score !== null
        ? `<div class="reddit-anti-ban-badge ${scoreClass}">${scoreEmoji} Anti-Ban: ${score}/100${score > 60 ? " — Risky, revise!" : ""}</div>`
        : "";

    card.innerHTML = `
      <div class="reddit-post-card-header">
        <span class="reddit-post-num">Option ${i + 1}</span>
        ${scoreBadge}
      </div>
      <div class="reddit-post-title-label">TITLE</div>
      <div class="reddit-post-title-text" id="reddit-post-title-${i}">${escapeHtml(post.title)}</div>
      <div class="reddit-post-title-label">BODY</div>
      <div class="reddit-post-body-text" id="reddit-post-body-${i}">${escapeHtml(post.body)}</div>
      <button class="reddit-post-expand-btn" data-idx="${i}">Show more ▾</button>
      <div class="reddit-post-actions">
        <button class="reddit-copy-btn" data-copy="title" data-idx="${i}">📋 Copy Title</button>
        <button class="reddit-copy-btn" data-copy="body" data-idx="${i}">📋 Copy Body</button>
        <button class="reddit-viral-btn" data-idx="${i}">🔥 Make it Viral</button>
      </div>
      <div class="reddit-viral-result" id="reddit-viral-result-${i}" hidden></div>
    `;

    container.appendChild(card);
  });

  // Expand buttons
  container.querySelectorAll(".reddit-post-expand-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const bodyEl = document.getElementById(`reddit-post-body-${btn.dataset.idx}`);
      bodyEl.classList.toggle("expanded");
      btn.textContent = bodyEl.classList.contains("expanded") ? "Show less ▴" : "Show more ▾";
    });
  });

  // Copy buttons
  container.querySelectorAll(".reddit-copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.idx);
      const post = posts[idx];
      const text = btn.dataset.copy === "title" ? post.title : post.body;
      redditCopyText(text, btn);
    });
  });

  // Viral buttons
  container.querySelectorAll(".reddit-viral-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const idx = parseInt(btn.dataset.idx);
      const post = posts[idx];
      const resultBox = document.getElementById(`reddit-viral-result-${idx}`);
      const origText = btn.textContent;
      btn.textContent = "🔥 Rewriting…";
      btn.disabled = true;
      resultBox.hidden = false;
      resultBox.innerHTML = `<div class="viral-loading">🔥 Rewriting for Reddit virality… ⏳</div>`;
      try {
        const draft = `${post.title}\n\n${post.body}`;
        const data = await redditCallApi("viral", { draft, subreddit: document.getElementById("reddit-subreddit")?.value?.trim() || "" });
        const viralText = data.post || "";
        resultBox.innerHTML = `
          <div class="viral-label">🔥 Viral Version</div>
          <div class="viral-text">${escapeHtml(viralText)}</div>
          <div class="viral-actions">
            <button type="button" class="reddit-copy-viral-btn">📋 Copy Viral</button>
          </div>
        `;
        resultBox.querySelector(".reddit-copy-viral-btn").addEventListener("click", (e) => {
          redditCopyText(viralText, e.currentTarget);
        });
      } catch (err) {
        resultBox.innerHTML = `<div class="viral-error">⚠ ${escapeHtml(err.message)}</div>`;
      }
      btn.textContent = origText;
      btn.disabled = false;
    });
  });

  redditShowView("reddit-view-results");
}

function renderTextVariations(variations, titleText) {
  const container = document.getElementById("reddit-results-container");
  const title = document.getElementById("reddit-results-title");
  title.textContent = titleText;
  container.innerHTML = "";

  variations.forEach((text, i) => {
    const card = document.createElement("div");
    card.className = "reddit-post-card";
    card.innerHTML = `
      <div class="reddit-post-card-header">
        <span class="reddit-post-num">Option ${i + 1}</span>
      </div>
      <div class="reddit-post-body-text expanded">${escapeHtml(text)}</div>
      <div class="reddit-post-actions">
        <button class="reddit-copy-btn" data-idx="${i}">📋 Copy</button>
      </div>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll(".reddit-copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      redditCopyText(variations[parseInt(btn.dataset.idx)], btn);
    });
  });

  redditShowView("reddit-view-results");
}

function renderSubreddits(subs, niche) {
  const container = document.getElementById("reddit-results-container");
  const title = document.getElementById("reddit-results-title");
  title.textContent = `Subreddits for: ${niche.substring(0, 40)}${niche.length > 40 ? "…" : ""}`;
  container.innerHTML = "";

  subs.forEach((sub) => {
    const promoClass =
      sub.promoAllowed === "YES"
        ? "sub-badge-promo-yes"
        : sub.promoAllowed === "NO"
        ? "sub-badge-promo-no"
        : "sub-badge-promo-rules";
    const promoLabel =
      sub.promoAllowed === "YES"
        ? "✓ Promo OK"
        : sub.promoAllowed === "NO"
        ? "✗ No Promo"
        : "⚠ Check Rules";

    const card = document.createElement("div");
    card.className = "subreddit-card";
    card.innerHTML = `
      <div class="subreddit-name">${escapeHtml(sub.name)}</div>
      <div class="subreddit-members">${escapeHtml(sub.members || "")}</div>
      <div class="subreddit-meta">
        <span class="sub-badge ${promoClass}">${promoLabel}</span>
        ${sub.vibe ? `<span class="sub-badge sub-badge-vibe">${escapeHtml(sub.vibe)}</span>` : ""}
      </div>
      ${sub.bestTime ? `<div class="sub-best-time">⏰ Best time: ${escapeHtml(sub.bestTime)}</div>` : ""}
      <div class="sub-click-hint">Click to use in Post Generator →</div>
    `;

    card.addEventListener("click", () => {
      // Pre-fill Post Generator with this subreddit
      const subInput = document.getElementById("reddit-subreddit");
      if (subInput) subInput.value = sub.name;
      redditShowView("reddit-view-post_generator");
    });

    container.appendChild(card);
  });

  // Save to recent searches
  redditSaveSubSearch(niche);

  redditShowView("reddit-view-results");
}


function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ── Subreddit search history ───────────────────────── */

async function redditSaveSubSearch(niche) {
  const { redditSubHistory } = await chrome.storage.local.get("redditSubHistory");
  const history = Array.isArray(redditSubHistory) ? redditSubHistory : [];
  const filtered = history.filter((h) => h !== niche);
  filtered.unshift(niche);
  await chrome.storage.local.set({ redditSubHistory: filtered.slice(0, 5) });
  redditRenderSubHistory();
}

async function redditRenderSubHistory() {
  const { redditSubHistory } = await chrome.storage.local.get("redditSubHistory");
  const list = document.getElementById("reddit-sub-history-list");
  const section = document.getElementById("reddit-sub-history");
  if (!list || !section) return;
  const history = Array.isArray(redditSubHistory) ? redditSubHistory : [];
  if (!history.length) { section.hidden = true; return; }
  section.hidden = false;
  list.innerHTML = history
    .map(
      (h) =>
        `<div class="reddit-sub-history-item" data-niche="${escapeHtml(h)}">${escapeHtml(h)}</div>`
    )
    .join("");
  list.querySelectorAll(".reddit-sub-history-item").forEach((el) => {
    el.addEventListener("click", () => {
      document.getElementById("reddit-niche").value = el.dataset.niche;
    });
  });
}

/* ── Feature form handlers ──────────────────────────── */

async function handlePostGenerator(e) {
  e.preventDefault();
  if (!(await redditCheckLimit("post_generator"))) return;

  const topic = document.getElementById("reddit-topic").value.trim();
  const subreddit = document.getElementById("reddit-subreddit").value.trim();
  const activeChip = document.querySelector(".reddit-tone-chip.active");
  const tone = activeChip ? activeChip.dataset.tone : "Story";

  redditShowLoading("Generating 3 Reddit posts…");

  try {
    const data = await redditCallApi("generate", { topic, subreddit, tone });
    await redditIncrementUsage("post_generator");
    renderRedditPosts(data.posts || []);
  } catch (err) {
    redditShowView("reddit-view-post_generator");
    alert("Error: " + err.message);
  }
}

async function handleSubredditFinder(e) {
  e.preventDefault();
  if (!(await redditCheckLimit("subreddit_finder"))) return;

  const niche = document.getElementById("reddit-niche").value.trim();
  redditShowLoading("Finding subreddits…");

  try {
    const data = await redditCallApi("subreddits", { niche });
    await redditIncrementUsage("subreddit_finder");
    renderSubreddits(data.subreddits || [], niche);
  } catch (err) {
    redditShowView("reddit-view-subreddit_finder");
    alert("Error: " + err.message);
  }
}

async function handleCommentReply(e) {
  e.preventDefault();
  if (!(await redditCheckLimit("comment_reply"))) return;

  const commentText = document.getElementById("reddit-comment-text").value.trim();
  const postContext = document.getElementById("reddit-post-context").value.trim();
  redditShowLoading("Generating 3 karma-building replies…");

  try {
    const data = await redditCallApi("reply", { commentText, postContext });
    await redditIncrementUsage("comment_reply");
    renderTextVariations(data.variations || [], "3 Reddit Replies");
  } catch (err) {
    redditShowView("reddit-view-comment_reply");
    alert("Error: " + err.message);
  }
}


/* ── Read from Reddit page ──────────────────────────── */

document.getElementById("reddit-read-page-btn")?.addEventListener("click", async () => {
  const statusEl = document.getElementById("reddit-read-status");
  statusEl.textContent = "Reading from Reddit…";
  statusEl.hidden = false;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url?.includes("reddit.com")) {
      statusEl.textContent = "⚠ Not on Reddit — go to a Reddit comment thread first.";
      return;
    }
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Try to get selected text first
        const sel = window.getSelection()?.toString().trim();
        if (sel && sel.length > 10) return sel;

        // Try shreddit comment bodies
        const shreddit = document.querySelector("shreddit-comment p");
        if (shreddit) return shreddit.innerText || shreddit.textContent || "";

        // Try old reddit
        const md = document.querySelector(".comment .md p");
        if (md) return md.innerText || md.textContent || "";

        return "";
      },
    });
    const text = results?.[0]?.result?.trim() || "";
    if (text) {
      document.getElementById("reddit-comment-text").value = text;
      statusEl.textContent = "✓ Comment loaded!";
    } else {
      statusEl.textContent = "⚠ Couldn't find comment text — please paste manually.";
    }
  } catch {
    statusEl.textContent = "⚠ Error reading page — paste the comment manually.";
  }
});

/* ── Platform Switcher ──────────────────────────────── */

function initPlatformSwitcher() {
  const linkedinPanel = document.querySelector(".main:not(.reddit-main)");
  const redditPanel = document.getElementById("reddit-panel");
  const accountBar = document.getElementById("account-bar");
  const header = document.querySelector(".header");

  document.querySelectorAll(".platform-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".platform-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      const subheading = document.getElementById("header-user-name");
      if (tab.dataset.platform === "reddit") {
        linkedinPanel.hidden = true;
        if (accountBar) accountBar.hidden = true;
        redditPanel.hidden = false;
        if (subheading) subheading.textContent = "AI-powered content for Reddit";
      } else {
        linkedinPanel.hidden = false;
        if (accountBar) accountBar.hidden = false;
        redditPanel.hidden = true;
        if (subheading) subheading.textContent = "AI-powered content for your LinkedIn";
      }
    });
  });
}

/* ── Tone chips ─────────────────────────────────────── */

function initToneChips() {
  document.querySelectorAll(".reddit-tone-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".reddit-tone-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
    });
  });
}

/* ── Feature nav ────────────────────────────────────── */

function initRedditFeatureNav() {
  document.querySelectorAll(".reddit-feature-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      redditShowView(`reddit-view-${btn.dataset.redditFeature}`);
    });
  });

  document.querySelectorAll("[data-reddit-back]").forEach((btn) => {
    btn.addEventListener("click", () => redditShowView("reddit-view-home"));
  });

  // Upgrade back button
  document.getElementById("reddit-upgrade-back")?.addEventListener("click", () => {
    redditShowView("reddit-view-home");
  });

  // Upgrade button
  document.getElementById("reddit-upgrade-btn")?.addEventListener("click", async () => {
    const errEl = document.getElementById("reddit-upgrade-error");
    try {
      const userId = await redditGetUserId();
      const email = await redditGetEmail();
      if (!email) {
        errEl.textContent = "Please set your email in the Account section first.";
        errEl.hidden = false;
        return;
      }
      const r = await fetch(`${REDDIT_API_BASE}/api/payments/create-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email, plan: "reddit_pro" }),
      });
      const d = await r.json();
      if (d.url) {
        chrome.tabs.create({ url: d.url });
      } else {
        errEl.textContent = d.error || "Could not start checkout.";
        errEl.hidden = false;
      }
    } catch (err) {
      errEl.textContent = "Error: " + err.message;
      errEl.hidden = false;
    }
  });
}

/* ── Form listeners ─────────────────────────────────── */

function initFormListeners() {
  document.getElementById("reddit-form-post_generator")?.addEventListener("submit", handlePostGenerator);
  document.getElementById("reddit-form-subreddit_finder")?.addEventListener("submit", handleSubredditFinder);
  document.getElementById("reddit-form-comment_reply")?.addEventListener("submit", handleCommentReply);
}

/* ── Listen for content script messages ────────────── */

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "REDDIT_DRAFT_REPLY") {
    // Switch to Reddit panel and pre-fill comment reply
    document.querySelectorAll(".platform-tab").forEach((t) => t.classList.remove("active"));
    document.querySelector('[data-platform="reddit"]').classList.add("active");
    document.querySelector(".main:not(.reddit-main)").hidden = true;
    document.getElementById("account-bar").hidden = true;
    document.getElementById("reddit-panel").hidden = false;

    redditShowView("reddit-view-comment_reply");
    const textarea = document.getElementById("reddit-comment-text");
    if (textarea && msg.commentText) textarea.value = msg.commentText;
  }
});

/* ── Fingerprint send (anti-bypass) ─────────────────────────────────────── */

async function redditSendFingerprint() {
  try {
    const email = await redditGetEmail();
    if (!email) return;
    const userId = await redditGetUserId();
    // generateBrowserFingerprint is defined in popup.js (loaded before this script)
    const deviceFingerprint = typeof generateBrowserFingerprint === "function"
      ? await generateBrowserFingerprint()
      : "";
    if (!deviceFingerprint) return;
    await fetch(`${REDDIT_API_BASE}/api/auth/register-extension`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, email, deviceFingerprint }),
    });
  } catch { /* non-fatal */ }
}

/* ── Init ───────────────────────────────────────────── */

// Run immediately — DOMContentLoaded has already fired by the time this script loads
initPlatformSwitcher();
initToneChips();
initRedditFeatureNav();
initFormListeners();
redditRenderSubHistory();
redditSendFingerprint();
