/**
 * ProPostly — Reddit Panel Controller
 * 3-option Post Generator: Scan Community, From URL, Quick Generate
 */

const REDDIT_API_BASE = "https://api.propostly.com";
const REDDIT_FREE_LIMIT = 5;

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
  const { upgradeEmail } = await chrome.storage.local.get("upgradeEmail");
  return upgradeEmail || "";
}

async function redditGetPlan() {
  try {
    const userId = await redditGetUserId();
    if (!userId) return "free";
    const r = await fetch(
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
  if (plan === "pro" || plan === "plus" || plan === "reddit_pro" || plan === "bundle") return true;
  const usage = await redditGetUsage();
  const counts = usage.counts || {};
  if ((counts[feature] || 0) >= REDDIT_FREE_LIMIT) {
    redditShowUpgrade(feature);
    return false;
  }
  return true;
}

function redditShowUpgrade(feature, fromLimit = false) {
  const backBtn = document.getElementById("reddit-upgrade-back");
  if (backBtn) backBtn.hidden = fromLimit; // hide back when forced by limit
  const descEl = document.getElementById("reddit-upgrade-desc");
  if (descEl) descEl._limitSet = false; // allow renderRedditUpgradeScreen to reset desc
  redditShowView("reddit-view-upgrade");
  if (typeof renderRedditUpgradeScreen === "function") renderRedditUpgradeScreen();
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

  // Update Bundle button text for LinkedIn Pro users — they pay $10 difference, not $25
  const isLinkedInPro = plan === "linkedin_pro" || plan === "pro" || plan === "plus";
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
      continue;
    }
    const { used, limit, left } = safeCount(featureUsage?.[feature], REDDIT_DEFAULT_LIMITS[feature] ?? 5);
    if (left === 0) {
      el.textContent = `${used}/${limit} used · Limit reached 🔒`;
      el.style.color = "#ef4444";
    } else if (left <= 2) {
      el.textContent = `${left} left of ${limit} free ⚠️`;
      el.style.color = "#f97316";
    } else {
      el.textContent = `${left} left of ${limit} free`;
      el.style.color = "#6b7280";
    }
  }
}

async function renderRedditAccountBar() {
  const tierEl  = document.getElementById("tier-label");
  const usageEl = document.getElementById("usage-label");
  if (!tierEl || !usageEl) return;

  // Render from cache immediately — no loading flash
  const cached = await chrome.storage.local.get(["userPlan", "isPro"]);
  if (!isRedditTabNowActive()) return;
  const cachedPlan = cached.userPlan || (cached.isPro ? "pro" : "free");
  applyRedditPlanToBar(cachedPlan, tierEl, usageEl);

  // Fetch fresh status including Reddit usage counters
  try {
    const userId = await redditGetUserId();
    if (!userId) return;
    const r = await fetch(`${REDDIT_API_BASE}/api/usage/status?userId=${encodeURIComponent(userId)}`);
    if (!r.ok) return;
    const status = await r.json();
    if (!isRedditTabNowActive()) return;
    const freshPlan = status.plan || "free";
    if (freshPlan !== cachedPlan) {
      applyRedditPlanToBar(freshPlan, tierEl, usageEl);
      await chrome.storage.local.set({ userPlan: freshPlan, isPro: status.isPro });
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
    const r = await fetch(`${REDDIT_API_BASE}/api/usage/status?userId=${encodeURIComponent(userId)}`);
    if (!r.ok) return;
    const status = await r.json();
    const plan = status.plan || "free";
    // Cache updated plan
    await chrome.storage.local.set({ userPlan: plan, isPro: status.isPro });
    renderRedditUsageCounters(status.feature_usage, plan);
  } catch { /* non-fatal */ }
}

async function redditCallApi(endpoint, payload) {
  const userId = await redditGetUserId();
  const email  = await redditGetEmail();
  const r = await fetch(`${REDDIT_API_BASE}/api/reddit/${endpoint}`, {
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

let _generatingPost = false;

async function handleScanGenerate(e) {
  e.preventDefault();
  if (_generatingPost) return;
  if (!(await redditCheckLimit("post_generator"))) return;

  const topic     = document.getElementById("reddit-scan-topic")?.value.trim();
  const subreddit = document.getElementById("reddit-scan-subreddit")?.value.trim();
  if (!topic) return;

  _generatingPost = true;
  redditShowLoading("Generating posts tuned for your community…");
  try {
    const data = await redditCallApi("generate", { topic, subreddit, analysisContext: _communityAnalysis });
    await redditIncrementUsage("post_generator");
    renderRedditPosts(data.posts || []);
  } catch (err) {
    redditShowView("reddit-view-post_generator");
    if (err.message !== "LIMIT_REACHED") alert("Error: " + err.message);
  } finally {
    _generatingPost = false;
  }
}

/* ─── Option B: From URL ───────────────────────────── */

async function handleUrlGenerate(e) {
  e.preventDefault();
  if (_generatingPost) return;
  if (!(await redditCheckLimit("post_generator"))) return;

  const url       = document.getElementById("reddit-url-input")?.value.trim();
  const subreddit = document.getElementById("reddit-url-subreddit")?.value.trim();
  if (!url) return;

  _generatingPost = true;
  redditShowLoading("Fetching URL and generating posts…");
  try {
    const data = await redditCallApi("from-url", { url, subreddit });
    await redditIncrementUsage("post_generator");
    renderRedditPosts(data.posts || []);
  } catch (err) {
    redditShowView("reddit-view-post_generator");
    if (err.message !== "LIMIT_REACHED") alert("Error: " + err.message);
  } finally {
    _generatingPost = false;
  }
}

/* ─── Option C: Quick Generate ─────────────────────── */

async function handlePostGenerator(e) {
  e.preventDefault();
  if (_generatingPost) return;
  if (!(await redditCheckLimit("post_generator"))) return;

  const topic      = document.getElementById("reddit-topic").value.trim();
  const subreddit  = document.getElementById("reddit-subreddit").value.trim();
  const template   = document.querySelector(".reddit-template-chip.active")?.dataset.template || "Lesson";
  const isPromoting = document.getElementById("reddit-promo-toggle")?.dataset.promoting === "yes";

  _generatingPost = true;
  redditShowLoading("Generating 3 Reddit posts…");
  try {
    const data = await redditCallApi("generate", { topic, subreddit, template, isPromoting });
    await redditIncrementUsage("post_generator");
    renderRedditPosts(data.posts || []);
  } catch (err) {
    redditShowView("reddit-view-post_generator");
    if (err.message !== "LIMIT_REACHED") alert("Error: " + err.message);
  } finally {
    _generatingPost = false;
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
        // Then refresh from server
        if (typeof refreshAccountStatus === "function") refreshAccountStatus();
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
    btn.addEventListener("click", async () => {
      const feature = btn.dataset.redditFeature;

      // Gate post_generator and subreddit_finder on their respective limits
      const featureToLimit = { post_generator: "post_generator", subreddit_finder: "subreddit_finder", comment_reply: "comment_reply" };
      if (featureToLimit[feature]) {
        const allowed = await redditCheckLimit(featureToLimit[feature]);
        if (!allowed) return; // redditCheckLimit already shows upgrade screen
      }

      // Reset finder flow when entering a feature fresh from home
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
        chrome.tabs.create({ url: `https://checkout.dodopayments.com/buy/pdt_0Nh513vWBknhkf541Vkd2?${params.toString()}`, active: true });
        return;
      }

      // Standard new subscription checkout
      const locale = (typeof navigator !== "undefined" && navigator.language) || "";
      const india  = locale.toUpperCase().endsWith("-IN") ||
                     Intl.DateTimeFormat().resolvedOptions().timeZone === "Asia/Kolkata";
      const r = await fetch(`${REDDIT_API_BASE}/api/payments/upgrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email, plan, country: india ? "IN" : undefined, india }),
      });
      const d = await r.json();
      const url = d.checkoutUrl || d.payment_link || d.url;
      if (url) {
        chrome.tabs.create({ url, active: true });
      } else {
        const staticUrl = plan === "bundle"
          ? "https://checkout.dodopayments.com/buy/pdt_0Nh23AJmTvBuWAXKsi2ds?quantity=1"
          : plan === "linkedin_pro"
          ? "https://checkout.dodopayments.com/buy/pdt_0Nh1YWHrfWoHzrfK5qEJF?quantity=1"
          : "https://checkout.dodopayments.com/buy/pdt_0Nh1zryt8Ch4KTi9B5yVJ?quantity=1";
        chrome.tabs.create({ url: staticUrl, active: true });
      }
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
    reddit_pro: "https://checkout.dodopayments.com/buy/pdt_0Nh1zryt8Ch4KTi9B5yVJ?quantity=1",
    bundle:     "https://checkout.dodopayments.com/buy/pdt_0Nh23AJmTvBuWAXKsi2ds?quantity=1",
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
      const checkoutUrl = `https://checkout.dodopayments.com/buy/pdt_0Nh513vWBknhkf541Vkd2?${params.toString()}`;
      chrome.tabs.create({ url: checkoutUrl, active: true });
      return;
    }

    // Standard Dodo checkout — used for free users
    chrome.tabs.create({ url: STATIC_URLS[plan] || STATIC_URLS.bundle, active: true });
  }

  document.getElementById("reddit-home-upgrade-pro")?.addEventListener("click", () => redditHomeUpgrade("reddit_pro"));
  document.getElementById("reddit-home-upgrade-bundle")?.addEventListener("click", () => redditHomeUpgrade("bundle"));
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

// Render Reddit-specific account bar if Reddit tab is already active on load
(function () {
  const activeTab = document.querySelector(".platform-tab.active");
  if (activeTab?.dataset.platform === "reddit") renderRedditAccountBar();
})();
