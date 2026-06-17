/**
 * ProPostly — Reddit Panel Controller
 * 3-option Post Generator: Scan Community, From URL, Quick Generate
 */

const REDDIT_API_BASE = "https://api.propostly.com";
const REDDIT_FREE_LIMIT = 5;

// All fetch calls go through the background service worker so the side panel's
// renderer thread is never blocked by long-running AI generation requests.
function bgFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "BG_FETCH", url, options, timeout: 20000 },
      (response) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }
        if (!response || response.error) {
          return reject(new Error((response && response.error) || "BG_FETCH failed"));
        }
        // Mimic a minimal fetch Response interface
        resolve({
          ok: response.ok,
          status: response.status,
          json: () => { try { return Promise.resolve(JSON.parse(response.text)); } catch (e) { return Promise.reject(e); } },
          text: () => Promise.resolve(response.text),
        });
      }
    );
  });
}

/* ─── In-memory state ──────────────────────────────── */
let _communityAnalysis   = null; // stored after Scan, used by Generate
let _fromSubredditFinder = false; // true when Post Generator launched from Finder

/* ─── Helpers ──────────────────────────────────────── */

async function redditGetUserId() {
  const { userId } = await chrome.storage.local.get("userId");
  if (userId) return userId;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ userId: id });
  return id;
}

async function redditGetEmail() {
  const { canonicalEmail, upgradeEmail } = await chrome.storage.local.get(["canonicalEmail", "upgradeEmail"]);
  return canonicalEmail || upgradeEmail || "";
}

async function redditGetPlan() {
  try {
    const userId = await redditGetUserId();
    if (!userId) return "free";
    const r = await bgFetch(
      `${REDDIT_API_BASE}/api/usage/status?userId=${encodeURIComponent(userId)}`
    );
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

// Map frontend feature names to backend feature_usage keys and their limits
const FEATURE_LIMIT_MAP = {
  post_generator:   { key: "reddit_post",      limit: 5 },
  subreddit_finder: { key: "reddit_subreddit", limit: 3 },
  comment_reply:    { key: "reddit_reply",      limit: 5 },
};

async function redditCheckLimit(feature) {
  const plan = await redditGetPlan();
  if (plan === "pro" || plan === "plus" || plan === "reddit_pro" || plan === "bundle") return true;

  const mapping = FEATURE_LIMIT_MAP[feature];
  if (!mapping) return true; // unknown feature — allow

  // Use backend-sourced feature_usage cached by refreshRedditCounters
  const { cachedFeatureUsage } = await chrome.storage.local.get("cachedFeatureUsage");
  const featureUsage = cachedFeatureUsage || {};
  const info = featureUsage[mapping.key];
  const used = info && typeof info === "object" ? (Number(info.used) || 0) : (Number(info) || 0);
  const remaining = info && typeof info === "object" && typeof info.remaining === "number"
    ? info.remaining
    : Math.max(0, mapping.limit - used);

  if (remaining <= 0) {
    redditShowUpgrade(feature);
    return false;
  }
  return true;
}

function redditShowUpgrade(feature, fromLimit = false) {
  // Always hide back button — user must upgrade, no escape
  const backBtn = document.getElementById("reddit-upgrade-back");
  if (backBtn) backBtn.hidden = true;
  const descEl = document.getElementById("reddit-upgrade-desc");
  if (descEl) descEl._limitSet = false;
  redditShowView("reddit-view-upgrade");
  if (typeof window._renderRedditUpgradeScreen === "function") window._renderRedditUpgradeScreen();
}

/* ─── Reddit account bar ───────────────────────────── */

function applyRedditPlanToBar(plan, tierEl, usageEl) {
  // Hard guard — never write Reddit labels onto the LinkedIn tab
  if (!isRedditTabNowActive()) return;

  const isRedditUnlimited = plan === "reddit_pro" || plan === "bundle";
  const upgradeEl = document.getElementById("reddit-home-upgrade");

  if (plan === "bundle") {
    tierEl.textContent = "Bundle";
    tierEl.className = "tier-badge pro";
    usageEl.textContent = "Bundle · Unlimited Reddit";
  } else if (plan === "reddit_pro") {
    tierEl.textContent = "Reddit Pro";
    tierEl.className = "tier-badge pro";
    usageEl.textContent = "Reddit Pro · Unlimited";
  } else {
    // linkedin_pro, pro, plus, free — all show as free on Reddit tab
    tierEl.textContent = "Free Tier";
    tierEl.className = "tier-badge";
    usageEl.textContent = "Reddit: Free · Upgrade for Reddit Pro";
  }

  // Show upgrade nudge on home screen for non-Reddit-unlimited users
  if (upgradeEl) upgradeEl.style.display = isRedditUnlimited ? "none" : "block";

  const isLinkedInPro = plan === "linkedin_pro" || plan === "pro" || plan === "plus";

  // LinkedIn Pro button — hide for users who already have it
  const linkedinWrap = document.getElementById("reddit-home-upgrade-linkedin-wrap");
  if (linkedinWrap) linkedinWrap.hidden = isLinkedInPro;

  // Save $5 note — hide for LinkedIn Pro users (they show the $10 note instead)
  const saveEl = document.getElementById("reddit-home-upgrade-save");
  if (saveEl) saveEl.hidden = isLinkedInPro;

  // Bundle note for LinkedIn Pro: pay $10 difference
  const noteEl = document.getElementById("reddit-home-upgrade-note");
  if (noteEl) noteEl.hidden = !isLinkedInPro || isRedditUnlimited;

  const bundleBtn = document.getElementById("reddit-home-upgrade-bundle");
  if (bundleBtn) {
    if (isLinkedInPro && !isRedditUnlimited) {
      bundleBtn.innerHTML = '🎯 Bundle — <strong>$10 today</strong>, then $25/mo → <span style="background:#fff;color:#16a34a;font-size:10px;font-weight:700;padding:1px 6px;border-radius:99px;margin-left:4px;">SAVE $5</span>';
    } else {
      bundleBtn.innerHTML = '🎯 Bundle $25/month → <span style="background:#fff;color:#16a34a;font-size:10px;font-weight:700;padding:1px 6px;border-radius:99px;margin-left:4px;">BEST VALUE</span>';
    }
  }
}

function isRedditTabNowActive() {
  return document.querySelector(".platform-tab.active")?.dataset.platform === "reddit";
}

const REDDIT_DEFAULT_LIMITS = { reddit_post: 5, reddit_subreddit: 3, reddit_reply: 5 };

function safeCount(info, defaultLimit) {
  // info can be: undefined, a number, or {used, limit, remaining}
  if (!info && info !== 0) return { used: 0, limit: defaultLimit, left: defaultLimit };
  if (typeof info === "object") {
    const used  = Number(info.used)  || 0;
    const limit = Number(info.limit) || defaultLimit;
    const left  = typeof info.remaining === "number"
      ? Math.max(0, info.remaining)
      : Math.max(0, limit - used);
    return { used, limit, left };
  }
  // plain number
  const used  = Number(info) || 0;
  const limit = defaultLimit;
  return { used, limit, left: Math.max(0, limit - used) };
}

// Map backend feature key → home card's data-reddit-feature value
const FEATURE_KEY_TO_CARD = {
  reddit_post:      "post_generator",
  reddit_subreddit: "subreddit_finder",
  reddit_reply:     "comment_reply",
};

function setCardLocked(featureCardName, locked) {
  const card = document.querySelector(`[data-reddit-feature="${featureCardName}"]`);
  if (!card) return;
  if (locked) {
    card.dataset.locked = "true";
    card.style.opacity = "0.5";
    card.style.cursor = "not-allowed";
  } else {
    delete card.dataset.locked;
    card.style.opacity = "";
    card.style.cursor = "";
  }
}

function renderRedditUsageCounters(featureUsage, plan) {
  const isUnlimited = plan === "reddit_pro" || plan === "bundle";
  const MAP = {
    reddit_post:      "rhc-usage-reddit_post",
    reddit_subreddit: "rhc-usage-reddit_subreddit",
    reddit_reply:     "rhc-usage-reddit_reply",
  };
  for (const [feature, elId] of Object.entries(MAP)) {
    const el = document.getElementById(elId);
    if (!el) continue;
    if (isUnlimited) {
      el.textContent = "Unlimited ✓";
      el.style.color = "#16a34a";
      setCardLocked(FEATURE_KEY_TO_CARD[feature], false);
      continue;
    }
    const { used, limit, left } = safeCount(featureUsage?.[feature], REDDIT_DEFAULT_LIMITS[feature] ?? 5);
    if (left === 0) {
      el.textContent = `${used}/${limit} used · Limit reached 🔒`;
      el.style.color = "#ef4444";
      setCardLocked(FEATURE_KEY_TO_CARD[feature], true);
    } else if (left <= 2) {
      el.textContent = `${left} left of ${limit} free ⚠️`;
      el.style.color = "#f97316";
      setCardLocked(FEATURE_KEY_TO_CARD[feature], false);
    } else {
      el.textContent = `${left} left of ${limit} free`;
      el.style.color = "#6b7280";
      setCardLocked(FEATURE_KEY_TO_CARD[feature], false);
    }
  }
}

async function renderRedditAccountBar() {
  const tierEl  = document.getElementById("tier-label");
  const usageEl = document.getElementById("usage-label");
  if (!tierEl || !usageEl) return;

  // Render from cache immediately — no loading flash, and lock cards right away
  const cached = await chrome.storage.local.get(["userPlan", "isPro", "cachedFeatureUsage"]);
  if (!isRedditTabNowActive()) return;
  const cachedPlan = cached.userPlan || (cached.isPro ? "pro" : "free");
  applyRedditPlanToBar(cachedPlan, tierEl, usageEl);
  // Apply cached feature usage immediately so cards are locked before backend fetch completes
  if (cached.cachedFeatureUsage) {
    renderRedditUsageCounters(cached.cachedFeatureUsage, cachedPlan);
  }

  // Fetch fresh status including Reddit usage counters
  try {
    const userId = await redditGetUserId();
    if (!userId) return;
    const r = await bgFetch(`${REDDIT_API_BASE}/api/usage/status?userId=${encodeURIComponent(userId)}`);
    if (!r.ok) return;
    const status = await r.json();
    if (!isRedditTabNowActive()) return;
    const freshPlan = status.plan || "free";
    // Always cache feature_usage so redditCheckLimit gate stays in sync with backend
    await chrome.storage.local.set({
      userPlan: freshPlan,
      isPro: status.isPro,
      cachedFeatureUsage: status.feature_usage || {},
    });
    if (freshPlan !== cachedPlan) {
      applyRedditPlanToBar(freshPlan, tierEl, usageEl);
    }
    renderRedditUsageCounters(status.feature_usage, freshPlan);
  } catch { /* non-fatal */ }
}

/* ─── API calls ────────────────────────────────────── */

// Refresh usage counters on home screen after a successful API call
async function refreshRedditCounters() {
  try {
    const userId = await redditGetUserId();
    if (!userId) return;
    const r = await bgFetch(`${REDDIT_API_BASE}/api/usage/status?userId=${encodeURIComponent(userId)}`);
    if (!r.ok) return;
    const status = await r.json();
    const plan = status.plan || "free";
    // Cache plan AND feature_usage — redditCheckLimit reads cachedFeatureUsage as authoritative gate
    await chrome.storage.local.set({
      userPlan: plan,
      isPro: status.isPro,
      cachedFeatureUsage: status.feature_usage || {},
    });
    renderRedditUsageCounters(status.feature_usage, plan);
  } catch { /* non-fatal */ }
}

async function redditCallApi(endpoint, payload) {
  const userId = await redditGetUserId();
  const email  = await redditGetEmail();
  const r = await bgFetch(`${REDDIT_API_BASE}/api/reddit/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, email, ...payload }),
  });
  if (r.status === 402) {
    // Usage limit hit — show upgrade screen (no back button — must upgrade)
    const data = await r.json().catch(() => ({}));
    const descEl = document.getElementById("reddit-upgrade-desc");
    if (descEl) {
      descEl.innerHTML = (data.error || "You've used all free Reddit uses this month.") + "<br><small style='color:var(--muted)'>Resets 1st of next month.</small>";
      descEl._limitSet = true; // prevent renderRedditUpgradeScreen overwriting this
    }
    redditShowUpgrade(null, true); // fromLimit=true hides back button
    throw new Error("LIMIT_REACHED");
  }
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(txt || `Server error ${r.status}`);
  }
  const result = await r.json();
  // Refresh counters in background after every successful tracked call
  const tracked = ["generate","from-url","reply","subreddits","viral"];
  if (tracked.some(e => endpoint.startsWith(e))) refreshRedditCounters();
  return result;
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

async function renderSubreddits(subs, niche) {
  const container = document.getElementById("reddit-results-container");
  const title     = document.getElementById("reddit-results-title");
  title.textContent = `Subreddits for: ${niche.substring(0, 40)}${niche.length > 40 ? "…" : ""}`;
  container.innerHTML = "";

  // Check post limit upfront to show correct hint on all cards
  const { cachedFeatureUsage } = await chrome.storage.local.get("cachedFeatureUsage");
  const postInfo = (cachedFeatureUsage || {})["reddit_post"];
  const postUsed = postInfo && typeof postInfo === "object" ? (Number(postInfo.used) || 0) : (Number(postInfo) || 0);
  const postRemaining = postInfo && typeof postInfo === "object" && typeof postInfo.remaining === "number"
    ? postInfo.remaining : Math.max(0, 5 - postUsed);
  const plan = await redditGetPlan();
  const postLocked = !(plan === "reddit_pro" || plan === "bundle") && postRemaining <= 0;

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
      <div class="sub-click-hint" style="${postLocked ? "color:#ef4444;font-weight:600;" : ""}">${postLocked ? "🔒 Post limit reached — upgrade to generate" : "Click to use in Post Generator →"}</div>
    `;
    card.addEventListener("click", async () => {
      // If post generation limit is hit, show blocked message on the card — no popup
      const { cachedFeatureUsage } = await chrome.storage.local.get("cachedFeatureUsage");
      const postInfo = (cachedFeatureUsage || {})["reddit_post"];
      const postUsed = postInfo && typeof postInfo === "object" ? (Number(postInfo.used) || 0) : (Number(postInfo) || 0);
      const postRemaining = postInfo && typeof postInfo === "object" && typeof postInfo.remaining === "number"
        ? postInfo.remaining : Math.max(0, 5 - postUsed);
      const plan = await redditGetPlan();
      const isUnlimited = plan === "reddit_pro" || plan === "bundle";
      if (!isUnlimited && postRemaining <= 0) {
        const hint = card.querySelector(".sub-click-hint");
        if (hint) {
          hint.textContent = "🔒 Post limit reached — upgrade to use";
          hint.style.color = "#ef4444";
          hint.style.fontWeight = "600";
        }
        return;
      }

      // Fill subreddit in Quick tab
      const subInput = document.getElementById("reddit-subreddit");
      if (subInput) subInput.value = sub.name;

      // Switch to Quick tab
      document.querySelectorAll(".reddit-pg-tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".reddit-pg-panel").forEach((p) => p.classList.remove("active"));
      document.querySelector('[data-pg-tab="quick"]')?.classList.add("active");
      document.getElementById("reddit-pg-quick")?.classList.add("active");

      // Show green confirmation banner
      const msg = document.getElementById("reddit-pg-finder-msg");
      if (msg) {
        msg.textContent = `✅ ${sub.name} selected! Just type your topic below.`;
        msg.hidden = false;
      }

      // Track that we came from Subreddit Finder
      _fromSubredditFinder = true;

      redditShowView("reddit-view-post_generator");

      // Focus topic field after render
      setTimeout(() => document.getElementById("reddit-topic")?.focus(), 80);
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
  statusEl.textContent = `Analysing r/${subreddit} with AI…`;
  statusEl.hidden = false;

  // Use AI knowledge directly — no background tab needed (avoids Page Unresponsive crash)
  const topPosts = [];
  const rules    = "";

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

let _generatingPost = false;

async function handleScanGenerate(e) {
  e.preventDefault();
  if (_generatingPost) return;
  _generatingPost = true;
  try {
    const topic     = document.getElementById("reddit-scan-topic")?.value.trim();
    const subreddit = document.getElementById("reddit-scan-subreddit")?.value.trim();
    if (!topic) return;
    if (!(await redditCheckLimit("post_generator"))) return;
    redditShowLoading("Generating posts tuned for your community…");
    const data = await redditCallApi("generate", { topic, subreddit, analysisContext: _communityAnalysis });
    renderRedditPosts(data.posts || []);
  } catch (err) {
    redditShowView("reddit-view-post_generator");
    if (err.message !== "LIMIT_REACHED") console.error("[Reddit] scan generate:", err.message);
  } finally {
    _generatingPost = false;
  }
}

/* ─── Option B: From URL ───────────────────────────── */

async function handleUrlGenerate(e) {
  e.preventDefault();
  if (_generatingPost) return;
  _generatingPost = true;
  try {
    const url       = document.getElementById("reddit-url-input")?.value.trim();
    const subreddit = document.getElementById("reddit-url-subreddit")?.value.trim();
    if (!url) return;
    if (!(await redditCheckLimit("post_generator"))) return;
    redditShowLoading("Fetching URL and generating posts…");
    const data = await redditCallApi("from-url", { url, subreddit });
    renderRedditPosts(data.posts || []);
  } catch (err) {
    redditShowView("reddit-view-post_generator");
    if (err.message !== "LIMIT_REACHED") console.error("[Reddit] url generate:", err.message);
  } finally {
    _generatingPost = false;
  }
}

/* ─── Option C: Quick Generate ─────────────────────── */

async function handlePostGenerator(e) {
  e.preventDefault();
  if (_generatingPost) return;
  _generatingPost = true;
  try {
    const topic      = document.getElementById("reddit-topic").value.trim();
    const subreddit  = document.getElementById("reddit-subreddit").value.trim();
    if (!topic) return;
    if (!(await redditCheckLimit("post_generator"))) return;
    const template   = document.querySelector(".reddit-template-chip.active")?.dataset.template || "Lesson";
    const isPromoting = document.getElementById("reddit-promo-toggle")?.dataset.promoting === "yes";
    redditShowLoading("Generating 3 Reddit posts…");
    const data = await redditCallApi("generate", { topic, subreddit, template, isPromoting });
    renderRedditPosts(data.posts || []);
  } catch (err) {
    redditShowView("reddit-view-post_generator");
    if (err.message !== "LIMIT_REACHED") console.error("[Reddit] quick generate:", err.message);
  } finally {
    _generatingPost = false;
  }
}

/* ─── Subreddit Finder ─────────────────────────────── */

let _findingSubreddits = false;

async function handleSubredditFinder(e) {
  e.preventDefault();
  if (_findingSubreddits) return;
  _findingSubreddits = true; // set synchronously before the first await — prevents double-fire
  try {
    const niche = document.getElementById("reddit-niche").value.trim();
    if (!niche) return;
    if (!(await redditCheckLimit("subreddit_finder"))) return;
    redditShowLoading("Finding subreddits…");
    const data = await redditCallApi("subreddits", { niche });
    renderSubreddits(data.subreddits || [], niche);
  } catch (err) {
    redditShowView("reddit-view-subreddit_finder");
    console.error("[Reddit] subreddit finder:", err.message);
  } finally {
    _findingSubreddits = false;
  }
}

/* ─── Comment Reply ────────────────────────────────── */

let _replyingToComment = false;

async function handleCommentReply(e) {
  e.preventDefault();
  if (_replyingToComment) return;
  _replyingToComment = true; // set synchronously before the first await — prevents double-fire
  try {
    const commentText = document.getElementById("reddit-comment-text").value.trim();
    if (!commentText) {
      const statusEl = document.getElementById("reddit-read-status");
      if (statusEl) { statusEl.textContent = "⚠ Paste the comment you want to reply to first."; statusEl.hidden = false; }
      return;
    }
    if (!(await redditCheckLimit("comment_reply"))) return;
    const postContext = document.getElementById("reddit-post-context").value.trim();
    const persona     = document.querySelector(".reddit-persona-chip.active")?.dataset.persona || "mentor";
    const loadingText = persona === "witty" ? "Crafting witty replies…"
      : persona === "curious" ? "Generating curious replies…"
      : "Generating helpful replies…";
    redditShowLoading(loadingText);
    const data = await redditCallApi("reply", { commentText, postContext, persona });
    const personaLabel = persona === "witty" ? "😄 Witty Replies" : persona === "curious" ? "🤔 Curious Replies" : "🎓 Mentor Replies";
    renderTextVariations(data.variations || [], personaLabel);
  } catch (err) {
    redditShowView("reddit-view-comment_reply");
    console.error("[Reddit] comment reply:", err.message);
  } finally {
    _replyingToComment = false;
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
      const header = document.querySelector(".header");
      if (tab.dataset.platform === "reddit") {
        linkedinPanel.hidden = true;
        redditPanel.hidden = false;
        if (subheading) subheading.textContent = "AI-powered content for Reddit";
        if (header) header.classList.add("header-reddit");
        renderRedditAccountBar();
      } else {
        linkedinPanel.hidden = false;
        redditPanel.hidden = true;
        if (subheading) subheading.textContent = "AI-powered content for your LinkedIn";
        if (header) header.classList.remove("header-reddit");
        // Immediately restore LinkedIn badge from cache before async fetch
        chrome.storage.local.get(["userPlan", "isPro"], (cached) => {
          const tierEl = document.getElementById("tier-label");
          const usageEl = document.getElementById("usage-label");
          if (!tierEl || !usageEl) return;
          const plan = cached.userPlan || "free";
          const isPro = cached.isPro || false;
          if (plan === "bundle") {
            tierEl.textContent = "Bundle"; tierEl.className = "tier-badge pro";
            usageEl.textContent = "Unlimited LinkedIn & Reddit · 25 leads/mo";
          } else if (plan === "linkedin_pro") {
            tierEl.textContent = "LinkedIn Pro"; tierEl.className = "tier-badge pro";
            usageEl.textContent = "Unlimited LinkedIn · 25 leads/mo";
          } else if (plan === "reddit_pro") {
            tierEl.textContent = "Reddit Pro"; tierEl.className = "tier-badge pro";
            usageEl.textContent = "5 uses/feature · Reddit: Unlimited";
          } else if (isPro) {
            tierEl.textContent = "Pro Tier"; tierEl.className = "tier-badge pro";
            usageEl.textContent = "Unlimited access · 25 leads/mo";
          } else {
            tierEl.textContent = "Free Tier"; tierEl.className = "tier-badge";
            usageEl.textContent = "5 uses/feature/month";
          }
        });
        // Refresh from server AND re-run upgrade screen so button states are current
        if (typeof refreshAccountStatus === "function") refreshAccountStatus();
        if (typeof renderLinkedInUpgradeScreen === "function") renderLinkedInUpgradeScreen();
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
  document.querySelectorAll("[data-reddit-feature]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const feature = btn.dataset.redditFeature;
      // If card is locked (limit reached) → block silently, no popup
      if (btn.dataset.locked === "true") return;
      if (feature === "post_generator") {
        _fromSubredditFinder = false;
        const msg = document.getElementById("reddit-pg-finder-msg");
        if (msg) msg.hidden = true;
      }
      redditShowView(`reddit-view-${feature}`);
    });
  });

  // Post Generator back button: go to Subreddit Finder if that's where we came from
  const pgBackBtn = document.getElementById("reddit-pg-back-btn");
  if (pgBackBtn) {
    pgBackBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (_fromSubredditFinder) {
        _fromSubredditFinder = false;
        const msg = document.getElementById("reddit-pg-finder-msg");
        if (msg) msg.hidden = true;
        redditShowView("reddit-view-subreddit_finder");
      } else {
        redditShowView("reddit-view-home");
      }
    });
  }

  // All other back buttons → always go to Reddit home grid
  document.querySelectorAll("[data-reddit-back]:not(#reddit-pg-back-btn)").forEach((btn) => {
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

  // fromPlan: if set, build $10 bundle upgrade URL for existing subscriber
  async function redditStartUpgrade(plan = "reddit_pro", fromPlan = null) {
    const errEl = document.getElementById("reddit-upgrade-error");
    if (errEl) { errEl.textContent = ""; errEl.hidden = true; }
    try {
      const userId = await redditGetUserId();
      const email  = await redditGetEmail();

      // Existing subscriber → Bundle: $10 one-time checkout
      if (fromPlan) {
        const params = new URLSearchParams({ quantity: "1" });
        if (userId) {
          params.set("metadata[user_id]", userId);
          params.set("metadata[userId]", userId);
          params.set("client_reference_id", userId);
        }
        params.set("metadata[upgrade_from]", fromPlan);
        params.set("metadata[upgrade_to]", "bundle");
        chrome.tabs.create({ url: `https://checkout.dodopayments.com/buy/pdt_0NfglmAMcUzd4GiVlnt0H?${params.toString()}`, active: true });
        return;
      }

      // Standard new subscription checkout
      const locale = (typeof navigator !== "undefined" && navigator.language) || "";
      const india  = locale.toUpperCase().endsWith("-IN") ||
                     Intl.DateTimeFormat().resolvedOptions().timeZone === "Asia/Kolkata";
      const r = await bgFetch(`${REDDIT_API_BASE}/api/payments/upgrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email, plan, country: india ? "IN" : undefined, india }),
      });
      const d = await r.json();
      const url = d.checkoutUrl || d.payment_link || d.url;
      const checkoutUrl = url
        || (plan === "bundle"      ? "https://checkout.dodopayments.com/buy/pdt_0Nh23AJmTvBuWAXKsi2ds?quantity=1"
          : plan === "linkedin_pro"? "https://checkout.dodopayments.com/buy/pdt_0NfglmAMcUzd4GiVlnt0H?quantity=1"
          :                          "https://checkout.dodopayments.com/buy/pdt_0Nh1zryt8Ch4KTi9B5yVJ?quantity=1");
      chrome.tabs.create({ url: checkoutUrl, active: true });

      // Poll for plan activation after checkout (up to 3 min, every 10s)
      let pollCount = 0;
      const pollInterval = setInterval(async () => {
        pollCount++;
        try {
          const statusRes = await bgFetch(`${REDDIT_API_BASE}/api/usage/status?userId=${encodeURIComponent(userId)}`);
          if (!statusRes.ok) return;
          const status = await statusRes.json();
          const newPlan = status.plan || "free";
          const isNowUnlimited = newPlan === "reddit_pro" || newPlan === "bundle" || newPlan === "linkedin_pro";
          if (isNowUnlimited) {
            clearInterval(pollInterval);
            await chrome.storage.local.set({
              userPlan: newPlan,
              isPro: Boolean(status.isPro),
              cachedFeatureUsage: status.feature_usage || {},
            });
            // Refresh both bars
            renderRedditAccountBar();
            if (typeof renderLinkedInUpgradeScreen === "function") renderLinkedInUpgradeScreen();
            if (typeof renderAccountStatus === "function" && status) renderAccountStatus(status);
            if (typeof window._renderRedditUpgradeScreen === "function") window._renderRedditUpgradeScreen();
            redditShowView("reddit-view-home");
          } else if (pollCount >= 18) {
            clearInterval(pollInterval);
          }
        } catch { /* ignore poll errors */ }
      }, 10000);

    } catch (err) {
      if (errEl) { errEl.textContent = "Error: " + err.message; errEl.hidden = false; }
    }
  }

  // Dynamically update Reddit upgrade screen based on current plan
  async function renderRedditUpgradeScreen() {
    const cached = await chrome.storage.local.get(["userPlan"]);
    const plan = cached.userPlan || "free";
    const isLinkedInPro = plan === "linkedin_pro" || plan === "pro" || plan === "plus";
    const isRedditPro   = plan === "reddit_pro";

    const redditBtn   = document.getElementById("reddit-upgrade-btn");
    const linkedinBtn = document.getElementById("reddit-upgrade-linkedin-btn");
    const bundleBtn   = document.getElementById("reddit-upgrade-bundle-btn");
    const bundleNote  = document.getElementById("reddit-upgrade-bundle-note");
    const descEl      = document.getElementById("reddit-upgrade-desc");

    // Helper to rewire a button handler
    function wire(btn, handler) {
      if (!btn) return;
      btn.removeEventListener("click", btn._upgradeHandler);
      btn._upgradeHandler = handler;
      btn.addEventListener("click", handler);
    }

    if (isLinkedInPro) {
      // LinkedIn Pro user: Reddit Pro + Bundle $10
      if (redditBtn)   { redditBtn.hidden = false; redditBtn.textContent = "⚡ Reddit Pro — $15/month →"; }
      if (linkedinBtn) linkedinBtn.hidden = true;
      if (bundleBtn)   { bundleBtn.hidden = false; bundleBtn.innerHTML = "⬆️ Bundle — <strong>$10 today</strong>, then $25/mo · Save $5!"; }
      if (bundleNote)  bundleNote.hidden = false;
      if (descEl && !descEl._limitSet) descEl.innerHTML = "✅ Your LinkedIn Pro stays active.<br>Pay only <strong>$10 today</strong> (save $5!), then $25/month.";
      wire(redditBtn,   () => redditStartUpgrade("reddit_pro", null));
      wire(bundleBtn,   () => redditStartUpgrade("bundle", "linkedin_pro"));

    } else if (isRedditPro) {
      // Reddit Pro user: LinkedIn Pro + Bundle $10
      if (redditBtn)   redditBtn.hidden = true;
      if (linkedinBtn) { linkedinBtn.hidden = false; linkedinBtn.textContent = "💼 LinkedIn Pro — $15/month →"; }
      if (bundleBtn)   { bundleBtn.hidden = false; bundleBtn.innerHTML = "⬆️ Bundle — <strong>$10 today</strong>, then $25/mo · Save $5!"; }
      if (bundleNote)  bundleNote.hidden = false;
      if (descEl && !descEl._limitSet) descEl.innerHTML = "✅ Your Reddit Pro stays active.<br>Pay only <strong>$10 today</strong> (save $5!), then $25/month.";
      wire(linkedinBtn, () => redditStartUpgrade("linkedin_pro", null));
      wire(bundleBtn,   () => redditStartUpgrade("bundle", "reddit_pro"));

    } else {
      // Free user: Reddit Pro + LinkedIn Pro + Bundle $25
      if (redditBtn)   { redditBtn.hidden = false; redditBtn.textContent = "⚡ Reddit Pro — $15/month →"; }
      if (linkedinBtn) { linkedinBtn.hidden = false; linkedinBtn.textContent = "💼 LinkedIn Pro — $15/month →"; }
      if (bundleBtn)   { bundleBtn.hidden = false; bundleBtn.innerHTML = '🎯 Bundle — $25/month &nbsp;<span style="background:rgba(255,255,255,0.25);font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px;">BEST VALUE</span>'; }
      if (bundleNote)  bundleNote.hidden = true;
      if (descEl && !descEl._limitSet) descEl.textContent = "You've used all free Reddit uses this month. Resets 1st of next month.";
      wire(redditBtn,   () => redditStartUpgrade("reddit_pro", null));
      wire(linkedinBtn, () => redditStartUpgrade("linkedin_pro", null));
      wire(bundleBtn,   () => redditStartUpgrade("bundle", null));
    }
    // Mark that limit message was already set (don't overwrite 402 error text)
    if (descEl) descEl._limitSet = true;
  }

  // Home screen upgrade nudge buttons
  const STATIC_URLS = {
    linkedin_pro: "https://checkout.dodopayments.com/buy/pdt_0NfglmAMcUzd4GiVlnt0H?quantity=1",
    reddit_pro:   "https://checkout.dodopayments.com/buy/pdt_0Nh1zryt8Ch4KTi9B5yVJ?quantity=1",
    bundle:       "https://checkout.dodopayments.com/buy/pdt_0Nh23AJmTvBuWAXKsi2ds?quantity=1",
  };

  async function redditHomeUpgrade(plan) {
    const cached = await chrome.storage.local.get(["userPlan"]);
    const currentPlan = cached.userPlan || "free";
    const isLinkedInPro = currentPlan === "linkedin_pro" || currentPlan === "pro" || currentPlan === "plus";
    const errEl = document.getElementById("reddit-home-upgrade-error");
    if (errEl) { errEl.textContent = ""; errEl.hidden = true; }

    // For linkedin_pro upgrading to bundle — build $10 checkout URL client-side (no API call)
    if (plan === "bundle" && isLinkedInPro) {
      const userId = await redditGetUserId();
      const params = new URLSearchParams({ quantity: "1" });
      if (userId) {
        params.set("metadata[user_id]", userId);
        params.set("metadata[userId]", userId);
        params.set("client_reference_id", userId);
      }
      params.set("metadata[upgrade_from]", currentPlan);
      params.set("metadata[upgrade_to]", "bundle");
      const checkoutUrl = `https://checkout.dodopayments.com/buy/pdt_0NfglmAMcUzd4GiVlnt0H?${params.toString()}`;
      chrome.tabs.create({ url: checkoutUrl, active: true });
      return;
    }

    // Standard Dodo checkout — used for free users
    chrome.tabs.create({ url: STATIC_URLS[plan] || STATIC_URLS.bundle, active: true });
  }

  document.getElementById("reddit-home-upgrade-linkedin")?.addEventListener("click", () => redditHomeUpgrade("linkedin_pro"));
  document.getElementById("reddit-home-upgrade-pro")?.addEventListener("click", () => redditHomeUpgrade("reddit_pro"));
  document.getElementById("reddit-home-upgrade-bundle")?.addEventListener("click", () => redditHomeUpgrade("bundle"));

  // Expose so redditShowUpgrade() (outer scope) can call it
  window._renderRedditUpgradeScreen = renderRedditUpgradeScreen;

  // Wire upgrade screen buttons immediately on init
  renderRedditUpgradeScreen();
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
    await bgFetch(`${REDDIT_API_BASE}/api/auth/register-extension`, {
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

// Render Reddit-specific account bar if Reddit tab is already active on load
(function () {
  const activeTab = document.querySelector(".platform-tab.active");
  if (activeTab?.dataset.platform === "reddit") renderRedditAccountBar();
})();
