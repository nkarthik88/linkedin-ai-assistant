/**
 * ProPostly — Reddit Panel Controller
 * 3-option Post Generator: Scan Community, From URL, Quick Generate
 */

const REDDIT_API_BASE = "https://api.propostly.com";
const REDDIT_FREE_LIMIT = 5;

/* ─── In-memory state ──────────────────────────────── */
let _communityAnalysis = null; // stored after Scan, used by Generate

/* ─── Helpers ──────────────────────────────────────── */

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
    const email  = await redditGetEmail();
    if (!email) return "free";
    const r = await fetch(`${REDDIT_API_BASE}/api/auth/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, email }),
    });
    if (!r.ok) return "free";
    const d = await r.json();
    return d.plan || "free";
  } catch { return "free"; }
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
    setTimeout(() => { btn.textContent = orig; btn.classList.remove("copied"); }, 2000);
  });
}

function getActiveSubreddit() {
  const activeTab = document.querySelector(".reddit-pg-tab.active")?.dataset.pgTab;
  if (activeTab === "scan") return document.getElementById("reddit-scan-subreddit")?.value?.trim() || "";
  if (activeTab === "url")  return document.getElementById("reddit-url-subreddit")?.value?.trim() || "";
  return document.getElementById("reddit-subreddit")?.value?.trim() || "";
}

/* ─── Usage tracking ───────────────────────────────── */

async function redditGetUsage() {
  const { redditUsage } = await chrome.storage.local.get("redditUsage");
  if (!redditUsage) return {};
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
  if ((counts[feature] || 0) >= REDDIT_FREE_LIMIT) {
    redditShowUpgrade(feature);
    return false;
  }
  return true;
}

function redditShowUpgrade(feature) {
  const labels = {
    post_generator:  "Post Generator",
    subreddit_finder:"Subreddit Finder",
    comment_reply:   "Comment Reply",
  };
  const desc = document.getElementById("reddit-upgrade-desc");
  if (desc) desc.textContent = `You've used all ${REDDIT_FREE_LIMIT} free Reddit uses for "${labels[feature] || feature}" this month.`;
  redditShowView("reddit-view-upgrade");
}

/* ─── API calls ────────────────────────────────────── */

async function redditCallApi(endpoint, payload) {
  const userId = await redditGetUserId();
  const email  = await redditGetEmail();
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

/* ─── Safety card ──────────────────────────────────── */

function renderSafetyCard(container) {
  const card = document.createElement("div");
  card.className = "reddit-safety-card";
  card.innerHTML = `
    <div class="safety-card-title">📋 Before you post</div>
    <ul class="safety-list">
      <li>✅ Read the full post before copying</li>
      <li>⏰ Max 2 posts per day in any subreddit</li>
      <li>💬 Comment on others' posts first to build karma</li>
      <li>🔗 No links for first 3 months in a new sub</li>
      <li>📊 Build karma before any self-promotion</li>
      <li>📋 Always copy and paste manually — never auto-post</li>
    </ul>
  `;
  container.appendChild(card);
}

/* ─── Results renderers ────────────────────────────── */

function renderRedditPosts(posts) {
  const container = document.getElementById("reddit-results-container");
  const title = document.getElementById("reddit-results-title");
  title.textContent = "Your 3 Post Options";
  container.innerHTML = "";

  posts.forEach((post, i) => {
    const card = document.createElement("div");
    card.className = "reddit-post-card";

    const score = post.antiBanScore ?? null;
    const scoreClass = score === null ? "" : score <= 30 ? "safe" : score <= 60 ? "risky" : "danger";
    const scoreEmoji = score === null ? "" : score <= 30 ? "✅" : score <= 60 ? "⚠️" : "⛔";
    const scoreLabel = score === null ? "" : score <= 30 ? "Safe to post" : score <= 60 ? "Risky" : "Don't post";
    const scoreBadge = score !== null
      ? `<div class="reddit-anti-ban-badge ${scoreClass}">${scoreEmoji} ${scoreLabel} (${score}/100)</div>`
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
        <button class="reddit-copy-btn" data-copy="body"  data-idx="${i}">📋 Copy Body</button>
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
      const idx  = parseInt(btn.dataset.idx);
      const post = posts[idx];
      redditCopyText(btn.dataset.copy === "title" ? post.title : post.body, btn);
    });
  });

  // Viral buttons
  container.querySelectorAll(".reddit-viral-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const idx       = parseInt(btn.dataset.idx);
      const post      = posts[idx];
      const resultBox = document.getElementById(`reddit-viral-result-${idx}`);
      const origText  = btn.textContent;
      btn.textContent = "🔥 Rewriting…";
      btn.disabled    = true;
      resultBox.hidden = false;
      resultBox.innerHTML = `<div class="viral-loading">🔥 Rewriting for Reddit virality… ⏳</div>`;
      try {
        const draft    = `${post.title}\n\n${post.body}`;
        const subreddit = getActiveSubreddit();
        const data     = await redditCallApi("viral", { draft, subreddit });
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
      btn.disabled    = false;
    });
  });

  renderSafetyCard(container);
  redditShowView("reddit-view-results");
}

function renderTextVariations(variations, titleText) {
  const container = document.getElementById("reddit-results-container");
  const title     = document.getElementById("reddit-results-title");
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

  renderSafetyCard(container);
  redditShowView("reddit-view-results");
}

function renderSubreddits(subs, niche) {
  const container = document.getElementById("reddit-results-container");
  const title     = document.getElementById("reddit-results-title");
  title.textContent = `Subreddits for: ${niche.substring(0, 40)}${niche.length > 40 ? "…" : ""}`;
  container.innerHTML = "";

  subs.forEach((sub) => {
    const promoClass = sub.promoAllowed === "YES" ? "sub-badge-promo-yes"
      : sub.promoAllowed === "NO" ? "sub-badge-promo-no" : "sub-badge-promo-rules";
    const promoLabel = sub.promoAllowed === "YES" ? "✓ Promo OK"
      : sub.promoAllowed === "NO" ? "✗ No Promo" : "⚠ Check Rules";

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
      // Pre-fill Quick tab subreddit
      const subInput = document.getElementById("reddit-subreddit");
      if (subInput) subInput.value = sub.name;
      // Switch to Quick tab
      document.querySelectorAll(".reddit-pg-tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".reddit-pg-panel").forEach((p) => p.classList.remove("active"));
      document.querySelector('[data-pg-tab="quick"]')?.classList.add("active");
      document.getElementById("reddit-pg-quick")?.classList.add("active");
      redditShowView("reddit-view-post_generator");
    });
    container.appendChild(card);
  });

  redditSaveSubSearch(niche);
  redditShowView("reddit-view-results");
}

function renderCommunityAnalysis(data) {
  const el = (id) => document.getElementById(id);

  el("reddit-analysis-likes").innerHTML = (data.likes || []).length
    ? `<div class="analysis-row analysis-likes">
        <span class="analysis-icon">✅</span>
        <div><strong>Community likes:</strong> ${escapeHtml((data.likes || []).join(", "))}</div>
       </div>`
    : "";

  el("reddit-analysis-avoid").innerHTML = (data.avoid || []).length
    ? `<div class="analysis-row analysis-avoid">
        <span class="analysis-icon">⚠️</span>
        <div><strong>Avoid:</strong> ${escapeHtml((data.avoid || []).join(", "))}</div>
       </div>`
    : "";

  el("reddit-analysis-tone").innerHTML = data.tone
    ? `<div class="analysis-row analysis-tone">
        <span class="analysis-icon">📝</span>
        <div><strong>Best tone:</strong> ${escapeHtml(data.tone)}</div>
       </div>`
    : "";

  el("reddit-analysis-rules").innerHTML = (data.rules || []).length
    ? `<div class="analysis-row analysis-rules">
        <span class="analysis-icon">📋</span>
        <div><strong>Key rules:</strong> ${escapeHtml((data.rules || []).join(" • "))}</div>
       </div>`
    : "";
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ─── Subreddit search history ─────────────────────── */

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
  const list    = document.getElementById("reddit-sub-history-list");
  const section = document.getElementById("reddit-sub-history");
  if (!list || !section) return;
  const history = Array.isArray(redditSubHistory) ? redditSubHistory : [];
  if (!history.length) { section.hidden = true; return; }
  section.hidden = false;
  list.innerHTML = history
    .map((h) => `<div class="reddit-sub-history-item" data-niche="${escapeHtml(h)}">${escapeHtml(h)}</div>`)
    .join("");
  list.querySelectorAll(".reddit-sub-history-item").forEach((el) => {
    el.addEventListener("click", () => {
      document.getElementById("reddit-niche").value = el.dataset.niche;
    });
  });
}

/* ─── Option A: Scan Community ─────────────────────── */

async function handleScanCommunity() {
  const subredditRaw = document.getElementById("reddit-scan-subreddit")?.value.trim() || "";
  const subreddit    = subredditRaw.replace(/^r\//, "");
  const statusEl     = document.getElementById("reddit-scan-status");
  const btn          = document.getElementById("reddit-scan-btn");

  if (!subreddit) {
    statusEl.textContent = "⚠ Enter a subreddit name first.";
    statusEl.hidden = false;
    return;
  }

  btn.disabled    = true;
  btn.textContent = "🔍 Scanning…";
  statusEl.textContent = `Opening r/${subreddit} in background…`;
  statusEl.hidden = false;

  let topPosts = [];
  let rules    = "";

  try {
    const tab = await chrome.tabs.create({
      url: `https://www.reddit.com/r/${subreddit}/top/?t=month`,
      active: false,
    });

    // Wait for page to finish loading (max 10 s)
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 10000);
      const listener = (tabId, info) => {
        if (tabId === tab.id && info.status === "complete") {
          clearTimeout(timeout);
          chrome.tabs.onUpdated.removeListener(listener);
          setTimeout(resolve, 1500); // let JS-rendered content paint
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });

    statusEl.textContent = `Reading top posts in r/${subreddit}…`;

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const posts = [];
        const rulesArr = [];

        // New Reddit — shreddit-post custom elements
        const shredditPosts = document.querySelectorAll("shreddit-post");
        if (shredditPosts.length > 0) {
          shredditPosts.forEach((p) => {
            const title = p.getAttribute("post-title")
              || p.querySelector('[slot="title"]')?.textContent?.trim() || "";
            const score = parseInt(p.getAttribute("score")
              || p.querySelector("faceplate-number")?.getAttribute("number") || "0") || 0;
            if (title) posts.push({ title, score, type: p.getAttribute("post-type") || "text" });
          });
        } else {
          // Old Reddit fallback
          document.querySelectorAll(".thing.link").forEach((p) => {
            const title = p.querySelector(".title a.title")?.textContent?.trim() || "";
            const score = parseInt(p.querySelector(".score.unvoted")?.textContent || "0") || 0;
            if (title) posts.push({ title, score, type: p.classList.contains("self") ? "text" : "link" });
          });
        }

        // Sidebar rules — try multiple selectors
        const ruleSels = [
          "community-rules-item", "[id*='rule'] li", ".md ul li",
          "[data-testid*='rule']", ".communityRulesExpander li",
        ];
        ruleSels.forEach((sel) => {
          document.querySelectorAll(sel).forEach((r) => {
            const text = r.textContent?.trim();
            if (text && text.length > 5 && text.length < 300) rulesArr.push(text);
          });
        });

        return {
          posts: posts.slice(0, 25),
          rules: [...new Set(rulesArr)].slice(0, 8).join(" | "),
        };
      },
    });

    const scraped = results?.[0]?.result;
    topPosts = scraped?.posts || [];
    rules    = scraped?.rules || "";

    await chrome.tabs.remove(tab.id).catch(() => {});

  } catch {
    // Silently fall back — AI will analyse without scraped data
    statusEl.textContent = `⚠ Couldn't read the page directly — using AI knowledge of r/${subreddit}.`;
  }

  statusEl.textContent = "Analysing community patterns…";

  try {
    const data = await redditCallApi("analyze-community", {
      subreddit: `r/${subreddit}`,
      topPosts: topPosts.length ? topPosts : [{ title: "No posts scraped", score: 0 }],
      rules,
    });

    _communityAnalysis = { ...data, subreddit: `r/${subreddit}` };

    renderCommunityAnalysis(data);
    document.getElementById("reddit-scan-analysis").hidden = false;
    document.getElementById("reddit-scan-step1").style.display = "none";
    statusEl.hidden = true;

  } catch (err) {
    statusEl.textContent = "⚠ Analysis failed: " + err.message;
  }

  btn.disabled    = false;
  btn.textContent = "🔍 Scan Community";
}

async function handleScanGenerate(e) {
  e.preventDefault();
  if (!(await redditCheckLimit("post_generator"))) return;

  const topic     = document.getElementById("reddit-scan-topic")?.value.trim();
  const subreddit = document.getElementById("reddit-scan-subreddit")?.value.trim();
  if (!topic) return;

  redditShowLoading("Generating posts tuned for your community…");
  try {
    const data = await redditCallApi("generate", { topic, subreddit, analysisContext: _communityAnalysis });
    await redditIncrementUsage("post_generator");
    renderRedditPosts(data.posts || []);
  } catch (err) {
    redditShowView("reddit-view-post_generator");
    alert("Error: " + err.message);
  }
}

/* ─── Option B: From URL ───────────────────────────── */

async function handleUrlGenerate(e) {
  e.preventDefault();
  if (!(await redditCheckLimit("post_generator"))) return;

  const url       = document.getElementById("reddit-url-input")?.value.trim();
  const subreddit = document.getElementById("reddit-url-subreddit")?.value.trim();
  if (!url) return;

  redditShowLoading("Fetching URL and generating posts…");
  try {
    const data = await redditCallApi("from-url", { url, subreddit });
    await redditIncrementUsage("post_generator");
    renderRedditPosts(data.posts || []);
  } catch (err) {
    redditShowView("reddit-view-post_generator");
    alert("Error: " + err.message);
  }
}

/* ─── Option C: Quick Generate ─────────────────────── */

async function handlePostGenerator(e) {
  e.preventDefault();
  if (!(await redditCheckLimit("post_generator"))) return;

  const topic      = document.getElementById("reddit-topic").value.trim();
  const subreddit  = document.getElementById("reddit-subreddit").value.trim();
  const template   = document.querySelector(".reddit-template-chip.active")?.dataset.template || "Lesson";
  const isPromoting = document.getElementById("reddit-promo-toggle")?.dataset.promoting === "yes";

  redditShowLoading("Generating 3 Reddit posts…");
  try {
    const data = await redditCallApi("generate", { topic, subreddit, template, isPromoting });
    await redditIncrementUsage("post_generator");
    renderRedditPosts(data.posts || []);
  } catch (err) {
    redditShowView("reddit-view-post_generator");
    alert("Error: " + err.message);
  }
}

/* ─── Subreddit Finder ─────────────────────────────── */

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

/* ─── Comment Reply ────────────────────────────────── */

async function handleCommentReply(e) {
  e.preventDefault();
  if (!(await redditCheckLimit("comment_reply"))) return;

  const commentText = document.getElementById("reddit-comment-text").value.trim();
  const postContext = document.getElementById("reddit-post-context").value.trim();
  const persona     = document.querySelector(".reddit-persona-chip.active")?.dataset.persona || "mentor";

  const loadingText = persona === "witty" ? "Crafting witty replies…"
    : persona === "curious" ? "Generating curious replies…"
    : "Generating helpful replies…";

  redditShowLoading(loadingText);
  try {
    const data = await redditCallApi("reply", { commentText, postContext, persona });
    await redditIncrementUsage("comment_reply");
    const personaLabel = persona === "witty" ? "😄 Witty Replies" : persona === "curious" ? "🤔 Curious Replies" : "🎓 Mentor Replies";
    renderTextVariations(data.variations || [], personaLabel);
  } catch (err) {
    redditShowView("reddit-view-comment_reply");
    alert("Error: " + err.message);
  }
}

/* ─── Read from Reddit page ────────────────────────── */

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
        const sel = window.getSelection()?.toString().trim();
        if (sel && sel.length > 10) return sel;
        const shreddit = document.querySelector("shreddit-comment p");
        if (shreddit) return shreddit.innerText || shreddit.textContent || "";
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

/* ─── Platform Switcher ────────────────────────────── */

function initPlatformSwitcher() {
  const linkedinPanel = document.querySelector(".main:not(.reddit-main)");
  const redditPanel   = document.getElementById("reddit-panel");
  const accountBar    = document.getElementById("account-bar");

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

/* ─── Post Generator Tabs ──────────────────────────── */

function initPostGeneratorTabs() {
  document.querySelectorAll(".reddit-pg-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".reddit-pg-tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".reddit-pg-panel").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(`reddit-pg-${tab.dataset.pgTab}`)?.classList.add("active");
    });
  });
}

/* ─── Template chips ───────────────────────────────── */

function initTemplateChips() {
  document.querySelectorAll(".reddit-template-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".reddit-template-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
    });
  });
}

/* ─── Persona chips (Comment Reply) ───────────────────── */

function initPersonaChips() {
  document.querySelectorAll(".reddit-persona-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".reddit-persona-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
    });
  });
}

/* ─── Promo toggle ─────────────────────────────────── */

function initPromoToggle() {
  const btn = document.getElementById("reddit-promo-toggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const isYes = btn.dataset.promoting === "yes";
    btn.dataset.promoting = isYes ? "no" : "yes";
    btn.textContent = isYes ? "NO" : "YES";
    btn.classList.toggle("promo-yes", !isYes);
  });
}

/* ─── Feature nav ──────────────────────────────────── */

function initRedditFeatureNav() {
  document.querySelectorAll(".reddit-feature-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      redditShowView(`reddit-view-${btn.dataset.redditFeature}`);
    });
  });

  // All back buttons (feature views + results) → always go to Reddit home grid
  document.querySelectorAll("[data-reddit-back]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      redditShowView("reddit-view-home");
    });
  });

  document.getElementById("reddit-upgrade-back")?.addEventListener("click", (e) => {
    e.preventDefault();
    redditShowView("reddit-view-home");
  });

  document.getElementById("reddit-upgrade-btn")?.addEventListener("click", async () => {
    const errEl = document.getElementById("reddit-upgrade-error");
    try {
      const userId = await redditGetUserId();
      const email  = await redditGetEmail();
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

/* ─── Form listeners ───────────────────────────────── */

function initFormListeners() {
  document.getElementById("reddit-form-post_generator")?.addEventListener("submit", handlePostGenerator);
  document.getElementById("reddit-form-scan-generate")?.addEventListener("submit", handleScanGenerate);
  document.getElementById("reddit-form-url-generate")?.addEventListener("submit", handleUrlGenerate);
  document.getElementById("reddit-form-subreddit_finder")?.addEventListener("submit", handleSubredditFinder);
  document.getElementById("reddit-form-comment_reply")?.addEventListener("submit", handleCommentReply);

  document.getElementById("reddit-scan-btn")?.addEventListener("click", handleScanCommunity);

  document.getElementById("reddit-scan-reset")?.addEventListener("click", () => {
    _communityAnalysis = null;
    document.getElementById("reddit-scan-analysis").hidden = true;
    document.getElementById("reddit-scan-step1").style.display = "";
    document.getElementById("reddit-scan-subreddit").value = "";
  });
}

/* ─── Content script messages ──────────────────────── */

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "REDDIT_DRAFT_REPLY") {
    document.querySelectorAll(".platform-tab").forEach((t) => t.classList.remove("active"));
    document.querySelector('[data-platform="reddit"]')?.classList.add("active");
    const li = document.querySelector(".main:not(.reddit-main)");
    if (li) li.hidden = true;
    const ab = document.getElementById("account-bar");
    if (ab) ab.hidden = true;
    document.getElementById("reddit-panel").hidden = false;
    redditShowView("reddit-view-comment_reply");
    const textarea = document.getElementById("reddit-comment-text");
    if (textarea && msg.commentText) textarea.value = msg.commentText;
  }
});

/* ─── Fingerprint send (anti-bypass) ───────────────── */

async function redditSendFingerprint() {
  try {
    const email = await redditGetEmail();
    if (!email) return;
    const userId = await redditGetUserId();
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

/* ─── Init ──────────────────────────────────────────── */

initPlatformSwitcher();
initPostGeneratorTabs();
initTemplateChips();
initPromoToggle();
initPersonaChips();
initRedditFeatureNav();
initFormListeners();
redditRenderSubHistory();
redditSendFingerprint();
