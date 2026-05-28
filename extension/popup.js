const API_BASE = "https://linkedin-ai-backend-rho.vercel.app";
const API_URL = `${API_BASE}/api/generate`;
const API_URL_LEADS = `${API_BASE}/api/generate/leads`;

let accountStatus = null;

const FEATURE_LABELS = {
  generate_post: "Post options",
  personalized_dm: "DM options",
  reply_comment: "Reply options",
  improve_headline: "Headline options",
  viral_rewriter: "Rewritten posts",
};

let lastFeature = null;

// ── Toast ──────────────────────────────────────────────────────────────────

let toastTimer = null;

function showToast(message, type = "default") {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.className = `toast${type !== "default" ? ` ${type}` : ""}`;
  el.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 3000);
}

// ── View management ────────────────────────────────────────────────────────

function showView(viewId) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  const el = document.getElementById(viewId);
  if (el) el.classList.add("active");
}

function showError(containerId, message) {
  const container = document.getElementById(containerId);
  if (!container) return;
  let err = container.querySelector(".error-msg");
  if (!err) {
    err = document.createElement("div");
    err.className = "error-msg";
    container.prepend(err);
  }
  err.textContent = message;
  err.hidden = false;
}

function clearError(containerId) {
  const container = document.getElementById(containerId);
  const err = container?.querySelector(".error-msg");
  if (err) err.hidden = true;
}

// ── User ID & email ────────────────────────────────────────────────────────

async function getUserId() {
  const { userId } = await chrome.storage.local.get("userId");
  if (userId) return userId;
  const newId = crypto.randomUUID();
  await chrome.storage.local.set({ userId: newId });
  return newId;
}

async function getUserEmail() {
  const { upgradeEmail } = await chrome.storage.local.get("upgradeEmail");
  return upgradeEmail || "";
}

// ── Onboarding ─────────────────────────────────────────────────────────────

async function checkOnboarding() {
  const { onboardingDone } = await chrome.storage.local.get("onboardingDone");
  if (!onboardingDone) {
    const overlay = document.getElementById("onboarding");
    if (overlay) overlay.hidden = false;
  }
}

document.getElementById("onboarding-start")?.addEventListener("click", async () => {
  await chrome.storage.local.set({ onboardingDone: true });
  const overlay = document.getElementById("onboarding");
  if (overlay) overlay.hidden = true;
});

// ── Account status ─────────────────────────────────────────────────────────

function setUpgradeError(message) {
  const el = document.getElementById("upgrade-error");
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.hidden = false;
  } else {
    el.textContent = "";
    el.hidden = true;
  }
}

function renderAccountStatus(status) {
  accountStatus = status;

  const tierEl = document.getElementById("tier-label");
  const usageEl = document.getElementById("usage-label");
  const upgradeBtn = document.getElementById("upgrade-btn");

  if (!tierEl || !usageEl || !upgradeBtn) return;

  const isPro = Boolean(status?.isPro);
  const tierLabel = status?.tierLabel || (isPro ? "Pro Tier" : "Free Tier");
  tierEl.textContent = tierLabel;
  tierEl.classList.toggle("pro", isPro);

  if (isPro) {
    usageEl.textContent = "Unlimited uses";
    upgradeBtn.hidden = true;
  } else {
    const remaining = status?.remaining ?? 0;
    const used = status?.usedThisMonth ?? 0;
    const limit = status?.limit ?? 10;
    usageEl.textContent = `${remaining} of ${limit} remaining`;
    upgradeBtn.hidden = false;

    if (remaining === 0) {
      usageEl.style.color = "var(--error)";
    } else {
      usageEl.style.color = "";
    }
  }

  setUpgradeError("");
}

async function fetchAccountStatus() {
  const userId = await getUserId();
  const res = await fetch(
    `${API_BASE}/api/usage/status?userId=${encodeURIComponent(userId)}`
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Could not load account status (${res.status})`);
  }

  return res.json();
}

async function refreshAccountStatus() {
  const tierEl = document.getElementById("tier-label");
  const usageEl = document.getElementById("usage-label");
  if (tierEl) tierEl.textContent = "…";
  if (usageEl) usageEl.textContent = "Loading…";

  try {
    const status = await fetchAccountStatus();
    renderAccountStatus(status);
    renderLeadCounter();
    await chrome.storage.local.set({ isPro: Boolean(status.isPro) });
    return status;
  } catch {
    if (tierEl) tierEl.textContent = "Free Tier";
    if (usageEl) usageEl.textContent = "Offline";
    return null;
  }
}

// ── Account page ───────────────────────────────────────────────────────────

async function renderAccountPage(status) {
  const emailEl = document.getElementById("account-email");
  const badgeEl = document.getElementById("account-tier-badge");
  const usageText = document.getElementById("account-usage-text");
  const usageBar = document.getElementById("account-usage-bar");
  const usageNote = document.getElementById("account-usage-note");
  const proSection = document.getElementById("account-pro-section");
  const freeSection = document.getElementById("account-free-section");
  const emailInput = document.getElementById("account-email-input");

  const email = await getUserEmail();
  if (emailEl) emailEl.textContent = email || "No email saved";
  if (emailInput && email) emailInput.value = email;

  if (!status) return;

  const isPro = Boolean(status.isPro);
  if (badgeEl) {
    badgeEl.textContent = isPro ? "Pro Tier" : "Free Tier";
    badgeEl.classList.toggle("pro", isPro);
  }

  const used = status.usedThisMonth ?? 0;
  const limit = status.limit ?? 10;
  const remaining = status.remaining ?? 0;
  const pct = isPro ? 0 : Math.min(100, Math.round((used / limit) * 100));

  if (usageText) {
    usageText.textContent = isPro ? "Unlimited" : `${used} / ${limit} used`;
  }

  if (usageBar) {
    usageBar.style.width = isPro ? "0%" : `${pct}%`;
    usageBar.classList.toggle("full", !isPro && remaining === 0);
  }

  if (usageNote) {
    if (isPro) {
      usageNote.textContent = "Unlimited AI generations every month";
    } else if (remaining === 0) {
      usageNote.textContent = "Limit reached — upgrade for unlimited access";
      usageNote.style.color = "var(--error)";
    } else {
      usageNote.textContent = `Resets next month`;
      usageNote.style.color = "";
    }
  }

  if (proSection) proSection.hidden = !isPro;
  if (freeSection) freeSection.hidden = isPro;
}

document.getElementById("account-tab-btn")?.addEventListener("click", async () => {
  showView("view-account");
  const status = await refreshAccountStatus();
  await renderAccountPage(status);
});

// Email save
document.getElementById("account-email-save")?.addEventListener("click", async () => {
  const input = document.getElementById("account-email-input");
  const statusEl = document.getElementById("account-email-status");
  const email = input?.value.trim();

  if (!email || !email.includes("@")) {
    if (statusEl) {
      statusEl.textContent = "Please enter a valid email address.";
      statusEl.style.color = "var(--error)";
      statusEl.hidden = false;
    }
    return;
  }

  await chrome.storage.local.set({ upgradeEmail: email });
  const emailEl = document.getElementById("account-email");
  if (emailEl) emailEl.textContent = email;

  if (statusEl) {
    statusEl.textContent = "✓ Email saved";
    statusEl.style.color = "var(--success)";
    statusEl.hidden = false;
    setTimeout(() => { statusEl.hidden = true; }, 2500);
  }

  showToast("Email saved", "success");
});

// Cancel subscription
document.getElementById("cancel-subscription-btn")?.addEventListener("click", async () => {
  const btn = document.getElementById("cancel-subscription-btn");
  const errorEl = document.getElementById("cancel-error");
  const successEl = document.getElementById("cancel-success");

  if (!confirm("Are you sure you want to cancel your Pro subscription? You'll be moved back to the free plan immediately.")) {
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Cancelling…";
  }
  if (errorEl) errorEl.hidden = true;
  if (successEl) successEl.hidden = true;

  try {
    const userId = await getUserId();
    const email = await getUserEmail();

    const res = await fetch(`${API_BASE}/api/payments/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, email: email || undefined }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Cancellation failed (${res.status})`);
    }

    await chrome.storage.local.set({ isPro: false });
    if (successEl) successEl.hidden = false;
    if (btn) btn.hidden = true;

    // Refresh account bar
    const status = await refreshAccountStatus();
    await renderAccountPage(status);

    showToast("Subscription cancelled", "default");
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    }
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Cancel Subscription";
    }
  }
});

// Account page upgrade button
document.getElementById("account-upgrade-btn")?.addEventListener("click", () => {
  startUpgrade();
});

// ── Upgrade flow ───────────────────────────────────────────────────────────

async function startUpgrade(fromPrompt = false) {
  const upgradeBtn = fromPrompt
    ? document.getElementById("upgrade-prompt-btn")
    : document.getElementById("upgrade-btn");

  if (!upgradeBtn || upgradeBtn.disabled) return;

  const errorSetter = fromPrompt
    ? (msg) => {
        const el = document.getElementById("upgrade-prompt-error");
        if (el) { el.textContent = msg; el.hidden = !msg; }
      }
    : setUpgradeError;

  errorSetter("");
  upgradeBtn.disabled = true;
  const prevText = upgradeBtn.textContent;
  upgradeBtn.textContent = "Opening checkout…";

  try {
    const userId = await getUserId();
    if (!userId) throw new Error("Could not identify your account. Reload the extension and try again.");

    let customerEmail = await getUserEmail();

    if (!customerEmail) {
      const prompted = window.prompt(
        "Enter your email for the receipt (optional — also used for upgrade alerts):",
        ""
      );
      if (prompted && prompted.includes("@")) {
        customerEmail = prompted.trim();
        await chrome.storage.local.set({ upgradeEmail: customerEmail });
      }
    }

    const locale = (typeof navigator !== "undefined" && navigator.language) || "";
    const india =
      locale.toUpperCase().endsWith("-IN") ||
      locale.toUpperCase() === "IN" ||
      Intl.DateTimeFormat().resolvedOptions().timeZone === "Asia/Kolkata";

    const res = await fetch(`${API_BASE}/api/payments/upgrade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: String(userId),
        email: customerEmail || undefined,
        customerEmail: customerEmail || undefined,
        country: india ? "IN" : undefined,
        india,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Upgrade failed (${res.status})`);
    }

    const data = await res.json();
    const checkoutUrl = data.checkoutUrl || data.payment_link;
    if (!checkoutUrl) throw new Error("No checkout URL returned from server.");

    await chrome.storage.local.set({ pendingUpgrade: true });
    chrome.windows.create({ url: checkoutUrl, type: "popup", width: 480, height: 720 });

    upgradeBtn.textContent = "Complete payment, then reopen";
  } catch (err) {
    errorSetter(err.message);
    upgradeBtn.textContent = prevText;
  } finally {
    upgradeBtn.disabled = false;
  }
}

document.getElementById("upgrade-btn")?.addEventListener("click", () => startUpgrade(false));
document.getElementById("upgrade-prompt-btn")?.addEventListener("click", () => startUpgrade(true));
document.getElementById("upgrade-prompt-back")?.addEventListener("click", () => showView("view-home"));

// ── Profile helpers ────────────────────────────────────────────────────────

async function getActiveLinkedInTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.includes("linkedin.com")) {
    throw new Error("Open a LinkedIn profile page in this tab first.");
  }
  return tab;
}

async function ensureContentScript(tabId) {
  try {
    const ping = await chrome.tabs.sendMessage(tabId, { type: "PING" });
    if (ping?.success) return;
  } catch {
    /* inject below */
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"],
  });
}

async function getProfileDataFromPage({ refresh = false } = {}) {
  const tab = await getActiveLinkedInTab();

  if (!/\/in\/[^/?#]+/i.test(tab.url || "")) {
    throw new Error(
      "Navigate to a LinkedIn profile (linkedin.com/in/username) before generating DMs."
    );
  }

  await ensureContentScript(tab.id);

  const response = await chrome.tabs.sendMessage(tab.id, {
    type: "GET_PROFILE_DATA",
    refresh,
  });

  if (!response?.success) {
    throw new Error(response?.error || "Could not read profile data.");
  }

  return response.profileData;
}

function renderProfilePreview(elId, profileData) {
  const el = document.getElementById(elId);
  if (!el) return;

  const { name, headline, about, experience, posts } = profileData;
  if (!name && !headline) {
    el.hidden = true;
    return;
  }

  el.hidden = false;
  const experienceHtml =
    experience?.length > 0
      ? `<span style="display:block;margin-top:4px"><strong>Experience:</strong> ${escapeHtml(experience.slice(0, 2).join("; "))}</span>`
      : "";
  const postsHtml =
    posts?.length > 0
      ? `<span style="display:block;margin-top:4px"><strong>Recent post:</strong> ${escapeHtml(posts[0].slice(0, 100))}${posts[0].length > 100 ? "…" : ""}</span>`
      : "";

  el.innerHTML = `
    <strong>Profile detected</strong>
    ${name ? `<div>${escapeHtml(name)}</div>` : ""}
    ${headline ? `<span>${escapeHtml(headline)}</span>` : ""}
    ${about ? `<span style="display:block;margin-top:4px">${escapeHtml(about.slice(0, 140))}${about.length > 140 ? "…" : ""}</span>` : ""}
    ${experienceHtml}
    ${postsHtml}
  `;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ── API call ───────────────────────────────────────────────────────────────

async function callApi(body) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.status === 402) {
    // Usage limit reached — show upgrade prompt
    showView("view-upgrade-prompt");
    throw new Error("__LIMIT_REACHED__");
  }

  if (!res.ok) {
    let friendlyMsg = "";
    try {
      const data = await res.json();
      friendlyMsg = data.error || "";
    } catch {
      friendlyMsg = "";
    }

    if (res.status >= 500) {
      throw new Error("Our AI service is temporarily unavailable. Please try again in a moment.");
    }
    throw new Error(friendlyMsg || `Something went wrong (${res.status}). Please try again.`);
  }

  const data = await res.json();
  const options = data.options ?? data.results ?? data.choices ?? data.variations;
  if (!Array.isArray(options) || options.length === 0) {
    throw new Error("No options returned. Please try again.");
  }

  if (typeof data.remainingCredits === "number" && accountStatus && !accountStatus.isPro) {
    const updatedStatus = {
      ...accountStatus,
      remaining: data.remainingCredits,
      usedThisMonth: (accountStatus.limit ?? 10) - data.remainingCredits,
    };
    renderAccountStatus(updatedStatus);
    accountStatus = updatedStatus;

    if (data.remainingCredits === 0) {
      showToast("You've used your last free generation — consider upgrading!", "default");
    }
  }

  return options.slice(0, 3);
}

// ── Results ────────────────────────────────────────────────────────────────

function displayResults(feature, options) {
  lastFeature = feature;
  const container = document.getElementById("results-container");
  const title = document.getElementById("results-title");
  title.textContent = FEATURE_LABELS[feature] || "Your options";
  container.innerHTML = "";

  options.forEach((text, i) => {
    const card = document.createElement("div");
    card.className = "option-card";
    card.innerHTML = `
      <div class="option-num">Option ${i + 1}</div>
      <div class="option-text">${escapeHtml(String(text))}</div>
      <button type="button" class="copy-btn" data-index="${i}">Copy</button>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const text = options[Number(btn.dataset.index)];
      await navigator.clipboard.writeText(text);
      btn.textContent = "Copied!";
      btn.classList.add("copied");
      showToast("Copied to clipboard", "success");
      setTimeout(() => {
        btn.textContent = "Copy";
        btn.classList.remove("copied");
      }, 2000);
    });
  });

  showView("view-results");
}

// ── Generation runner ──────────────────────────────────────────────────────

async function runGeneration(feature, buildBody) {
  showView("view-loading");
  try {
    const userId = await getUserId();
    const email = await getUserEmail();
    const body = await buildBody(userId);
    const options = await callApi({ feature, userId, email: email || undefined, ...body });
    displayResults(feature, options);
  } catch (err) {
    if (err.message === "__LIMIT_REACHED__") return; // upgrade prompt already shown
    showView(`view-${feature}`);
    const formMap = {
      generate_post: "form-generate_post",
      personalized_dm: "form-personalized_dm",
      reply_comment: "form-reply_comment",
      improve_headline: "form-improve_headline",
      viral_rewriter: "form-viral_rewriter",
    };
    showError(formMap[feature], err.message);
  }
}

// ── Feature button clicks ──────────────────────────────────────────────────

document.querySelectorAll(".feature-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const feature = btn.dataset.feature;
    clearError(`form-${feature}`);

    if (feature === "personalized_dm") {
      showView("view-loading");
      try {
        const profileData = await getProfileDataFromPage({ refresh: true });
        showView("view-personalized_dm");
        renderProfilePreview("profile-preview-dm", profileData);
      } catch (err) {
        showView("view-personalized_dm");
        const el = document.getElementById("profile-preview-dm");
        if (el) {
          el.hidden = false;
          el.innerHTML = `<strong>Note</strong><span>${escapeHtml(err.message)}</span>`;
        }
      }
      return;
    }

    if (feature === "find_leads") {
      openFindLeads();
      return;
    }

    showView(`view-${feature}`);

    if (feature === "improve_headline") {
      try {
        const profileData = await getProfileDataFromPage();
        renderProfilePreview("profile-preview-headline", profileData);
        const input = document.getElementById("headline-input");
        if (profileData.headline && input && !input.value) {
          input.value = profileData.headline;
        }
      } catch {
        /* Optional — user can type manually */
      }
    }
  });
});

// ── Back buttons ───────────────────────────────────────────────────────────

document.querySelectorAll("[data-back]").forEach((btn) => {
  btn.addEventListener("click", () => showView("view-home"));
});

document.querySelector("[data-back-home]")?.addEventListener("click", () => {
  showView("view-home");
});

// ── Form submissions ───────────────────────────────────────────────────────

document.getElementById("form-generate_post")?.addEventListener("submit", (e) => {
  e.preventDefault();
  clearError("form-generate_post");
  const topic = document.getElementById("topic").value.trim();
  if (!topic) return;
  runGeneration("generate_post", async (userId) => ({ userId, topic }));
});

document.getElementById("form-personalized_dm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError("form-personalized_dm");
  try {
    const profileData = await getProfileDataFromPage({ refresh: true });
    renderProfilePreview("profile-preview-dm", profileData);
    const dmContext = document.getElementById("dm-context")?.value.trim();
    await runGeneration("personalized_dm", async (userId) => ({
      userId,
      profileData,
      topic: dmContext || undefined,
    }));
  } catch (err) {
    showError("form-personalized_dm", err.message);
  }
});

document.getElementById("form-reply_comment")?.addEventListener("submit", (e) => {
  e.preventDefault();
  clearError("form-reply_comment");
  const commentText = document.getElementById("comment-text").value.trim();
  const originalComment = document.getElementById("original-post").value.trim();
  if (!commentText) return;
  runGeneration("reply_comment", async (userId) => ({
    userId,
    commentText,
    originalComment: originalComment || undefined,
  }));
});

document.getElementById("form-improve_headline")?.addEventListener("submit", (e) => {
  e.preventDefault();
  clearError("form-improve_headline");
  const headline = document.getElementById("headline-input").value.trim();
  if (!headline) return;
  runGeneration("improve_headline", async (userId) => {
    let profileData = {};
    try {
      profileData = await getProfileDataFromPage();
    } catch {
      /* optional */
    }
    return { userId, headline, profileData };
  });
});

document.getElementById("form-viral_rewriter")?.addEventListener("submit", (e) => {
  e.preventDefault();
  clearError("form-viral_rewriter");
  const draftPost = document.getElementById("draft-post").value.trim();
  if (!draftPost) return;
  runGeneration("viral_rewriter", async (userId) => ({ userId, draftPost }));
});

// ── Find Leads ───────────────────────────────────────────────────────────────

const LEAD_QUALITY = {
  hot: { icon: "🔥", label: "Hot", cls: "hot" },
  warm: { icon: "⚡", label: "Warm", cls: "warm" },
  cold: { icon: "❄️", label: "Cold", cls: "cold" },
};

function renderLeadCounter() {
  const els = [
    document.getElementById("lead-counter"),
    document.getElementById("lead-counter-results"),
  ];
  const s = accountStatus;
  let text = "Lead searches available";
  if (s && typeof s.lead_searches_remaining === "number") {
    const used = s.lead_searches_used ?? 0;
    const limit = s.lead_searches_limit ?? 2;
    text = `${used}/${limit} lead searches used · ${s.lead_searches_remaining} remaining`;
  }
  els.forEach((el) => {
    if (!el) return;
    el.textContent = text;
    el.style.color =
      s && s.lead_searches_remaining === 0 ? "var(--error)" : "";
  });
}

function formatResetDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function showLeadLimit() {
  const isPro = Boolean(accountStatus?.isPro);
  const limit = accountStatus?.lead_searches_limit ?? (isPro ? 50 : 2);
  const msg = document.getElementById("lead-limit-msg");
  const resetEl = document.getElementById("lead-limit-reset");
  const upBtn = document.getElementById("lead-limit-upgrade");

  if (msg) {
    msg.textContent = isPro
      ? `You've used all ${limit} lead searches this month.`
      : "You've used all 2 free lead searches this month. Upgrade to Pro for 50 searches/month.";
  }

  const resetsOn = formatResetDate(accountStatus?.resets_on);
  if (resetEl) {
    resetEl.textContent = resetsOn ? `Resets on ${resetsOn}` : "";
    resetEl.hidden = !resetsOn;
  }

  if (upBtn) upBtn.hidden = isPro;

  showView("view-lead-limit");
}

function sleepMs(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function relativeTime(ts) {
  if (!ts) return "";
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min === 1) return "1 minute ago";
  if (min < 60) return `${min} minutes ago`;
  const hr = Math.floor(min / 60);
  if (hr === 1) return "1 hour ago";
  if (hr < 24) return `${hr} hours ago`;
  const d = Math.floor(hr / 24);
  return d === 1 ? "1 day ago" : `${d} days ago`;
}

function setLoading(text, subtext) {
  const t = document.getElementById("loading-text");
  const s = document.getElementById("loading-subtext");
  if (t) t.textContent = text;
  if (s) {
    s.textContent = subtext || "";
    s.hidden = !subtext;
  }
}

// ── Lead result persistence ──────────────────────────────────────────────────

async function persistLeadResults(leads, target) {
  await chrome.storage.local.set({
    leadResults: { leads, target: target || "", ts: Date.now() },
  });
}

async function getLeadResults() {
  const { leadResults } = await chrome.storage.local.get("leadResults");
  return leadResults || null;
}

async function clearLeadResults() {
  await chrome.storage.local.remove("leadResults");
}

// ── Saved Leads CRM ──────────────────────────────────────────────────────────

function leadKey(lead) {
  return lead.url || `${lead.name || ""}::${lead.company || ""}`;
}

async function getSavedLeads() {
  const { savedLeads } = await chrome.storage.local.get("savedLeads");
  return Array.isArray(savedLeads) ? savedLeads : [];
}

async function saveLead(lead) {
  const saved = await getSavedLeads();
  const key = leadKey(lead);
  if (saved.some((l) => leadKey(l) === key)) return false;
  saved.unshift({ ...lead, savedAt: Date.now() });
  await chrome.storage.local.set({ savedLeads: saved });
  await renderSavedLeads();
  return true;
}

async function deleteSavedLead(key) {
  const saved = await getSavedLeads();
  const next = saved.filter((l) => leadKey(l) !== key);
  await chrome.storage.local.set({ savedLeads: next });
  await renderSavedLeads();
}

async function renderSavedLeads() {
  const section = document.getElementById("saved-leads-section");
  const list = document.getElementById("saved-leads-list");
  const countEl = document.getElementById("saved-leads-count");
  if (!section || !list) return;

  const saved = await getSavedLeads();
  if (countEl) countEl.textContent = String(saved.length);
  section.hidden = saved.length === 0;
  list.innerHTML = "";

  saved.forEach((lead) => {
    const q = LEAD_QUALITY[lead.quality] || LEAD_QUALITY.cold;
    const sub =
      lead.title && lead.company
        ? `${lead.title} at ${lead.company}`
        : lead.title || lead.company || lead.headline || "";
    const key = leadKey(lead);

    const item = document.createElement("div");
    item.className = "saved-lead";
    item.innerHTML = `
      <div class="saved-lead-head" role="button" tabindex="0">
        <div class="saved-lead-identity">
          <div class="saved-lead-name">${escapeHtml(lead.name || "Unknown")}</div>
          ${sub ? `<div class="saved-lead-sub">${escapeHtml(sub)}</div>` : ""}
        </div>
        <span class="quality-badge ${q.cls}">${q.icon} ${q.label}</span>
      </div>
      <div class="saved-lead-body" hidden>
        ${lead.dm ? `<div class="lead-dm">${escapeHtml(lead.dm)}</div>` : ""}
        <div class="lead-actions">
          <button type="button" class="copy-btn saved-copy">Copy DM</button>
          ${lead.url ? `<button type="button" class="lead-view saved-view">View Profile →</button>` : ""}
          <button type="button" class="saved-delete">Delete</button>
        </div>
      </div>
    `;

    const head = item.querySelector(".saved-lead-head");
    const body = item.querySelector(".saved-lead-body");
    head.addEventListener("click", () => {
      body.hidden = !body.hidden;
    });

    item.querySelector(".saved-copy")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      await navigator.clipboard.writeText(lead.dm || "");
      const b = e.currentTarget;
      b.textContent = "Copied!";
      b.classList.add("copied");
      showToast("DM copied", "success");
      setTimeout(() => {
        b.textContent = "Copy DM";
        b.classList.remove("copied");
      }, 2000);
    });
    item.querySelector(".saved-view")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (lead.url) chrome.tabs.create({ url: lead.url });
    });
    item.querySelector(".saved-delete")?.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteSavedLead(key);
      showToast("Lead removed", "default");
    });

    list.appendChild(item);
  });
}

// ── Profile sources (auto background-tab search + current-page scan) ─────────

async function getSearchProfilesFromCurrentPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.includes("linkedin.com")) {
    throw new Error("Open a LinkedIn people search results page in this tab first.");
  }
  if (!/\/search\/results\/(people|all)/i.test(tab.url || "")) {
    throw new Error(
      "Go to a LinkedIn people search (linkedin.com/search/results/people) and try again."
    );
  }
  await ensureContentScript(tab.id);
  const resp = await chrome.tabs.sendMessage(tab.id, { type: "GET_SEARCH_PROFILES" });
  if (!resp?.success) {
    throw new Error(resp?.error || "Could not read profiles from this page.");
  }
  return resp.profiles;
}

let lastAutoDiag = null;

async function isDebugAutoSearch() {
  const { debugAutoSearch } = await chrome.storage.local.get("debugAutoSearch");
  return Boolean(debugAutoSearch);
}

async function autoSearchProfiles(target) {
  const debug = await isDebugAutoSearch();
  lastAutoDiag = null;

  const url = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(
    target
  )}`;
  setLoading(
    "🔍 Searching LinkedIn…",
    debug ? "Debug: opening a visible tab to inspect" : "Opening results in a background tab"
  );

  // In debug we open the tab focused (active) so LinkedIn renders without
  // background-tab throttling — and we leave it open for inspection.
  const tab = await chrome.tabs.create({ url, active: debug });
  const tabId = tab.id;

  try {
    const deadline = Date.now() + 28000;
    let profiles = [];
    while (Date.now() < deadline) {
      await sleepMs(1500);
      try {
        await ensureContentScript(tabId);
        const resp = await chrome.tabs.sendMessage(tabId, {
          type: "AUTO_SCRAPE",
          debug,
        });
        if (resp?.diag) lastAutoDiag = resp.diag;
        if (resp?.success && resp.profiles?.length) {
          profiles = resp.profiles;
          break;
        }
      } catch (e) {
        if (!lastAutoDiag) lastAutoDiag = { waiting: true, note: e.message };
      }
    }
    return profiles;
  } finally {
    if (debug) {
      try {
        await chrome.tabs.update(tabId, { active: true }); // leave open + focused
      } catch {
        /* ignore */
      }
    } else {
      try {
        await chrome.tabs.remove(tabId);
      } catch {
        /* already closed */
      }
    }
  }
}

// ── Render leads ─────────────────────────────────────────────────────────────

function displayLeads(leads, opts = {}) {
  const container = document.getElementById("leads-container");
  const title = document.getElementById("leads-results-title");
  const tsEl = document.getElementById("leads-timestamp");
  const celebrate = document.getElementById("leads-celebrate");
  const copyAllBtn = document.getElementById("copy-all-hot");

  const hotCount = leads.filter((l) => l.quality === "hot").length;

  if (title) {
    title.textContent = `${leads.length} lead${leads.length === 1 ? "" : "s"} analyzed`;
  }
  if (tsEl) {
    tsEl.textContent = opts.ts ? `Last search: ${relativeTime(opts.ts)}` : "";
  }
  if (celebrate) {
    if (hotCount > 0) {
      celebrate.textContent = `🎉 ${hotCount} Hot lead${hotCount === 1 ? "" : "s"} found!`;
      celebrate.hidden = false;
    } else {
      celebrate.hidden = true;
    }
  }
  if (copyAllBtn) copyAllBtn.hidden = hotCount === 0;

  container.innerHTML = "";

  getSavedLeads().then((saved) => {
    const savedKeys = new Set(saved.map(leadKey));

    leads.forEach((lead, i) => {
      const q = LEAD_QUALITY[lead.quality] || LEAD_QUALITY.cold;
      const sub =
        lead.title && lead.company
          ? `${lead.title} at ${lead.company}`
          : lead.title || lead.headline || lead.company || "";
      const isSaved = savedKeys.has(leadKey(lead));

      const card = document.createElement("div");
      card.className = `lead-card${lead.quality === "hot" ? " lead-hot" : ""}`;
      card.innerHTML = `
        <div class="lead-card-head">
          <div class="lead-identity">
            <div class="lead-name">${escapeHtml(lead.name || "Unknown")}</div>
            ${sub ? `<div class="lead-sub">${escapeHtml(sub)}</div>` : ""}
            ${lead.location ? `<div class="lead-location">📍 ${escapeHtml(lead.location)}</div>` : ""}
          </div>
          <span class="quality-badge ${q.cls}">${q.icon} ${q.label}</span>
        </div>
        ${lead.reason ? `<div class="lead-reason">${escapeHtml(lead.reason)}</div>` : ""}
        <div class="lead-dm-label">Personalized DM</div>
        <div class="lead-dm">${escapeHtml(lead.dm || "")}</div>
        <div class="lead-actions">
          <button type="button" class="copy-btn lead-copy" data-index="${i}">Copy DM</button>
          ${lead.url ? `<button type="button" class="lead-view" data-url="${escapeHtml(lead.url)}">View Profile →</button>` : ""}
          <button type="button" class="lead-save${isSaved ? " saved" : ""}" data-index="${i}">${isSaved ? "★ Saved" : "☆ Save Lead"}</button>
        </div>
      `;
      container.appendChild(card);
    });

    container.querySelectorAll(".lead-copy").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const dm = leads[Number(btn.dataset.index)]?.dm || "";
        await navigator.clipboard.writeText(dm);
        btn.textContent = "Copied!";
        btn.classList.add("copied");
        showToast("DM copied to clipboard", "success");
        setTimeout(() => {
          btn.textContent = "Copy DM";
          btn.classList.remove("copied");
        }, 2000);
      });
    });

    container.querySelectorAll(".lead-view").forEach((btn) => {
      btn.addEventListener("click", () => {
        const url = btn.dataset.url;
        if (url) chrome.tabs.create({ url });
      });
    });

    container.querySelectorAll(".lead-save").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (btn.classList.contains("saved")) return;
        const ok = await saveLead(leads[Number(btn.dataset.index)]);
        if (ok) {
          btn.textContent = "★ Saved";
          btn.classList.add("saved");
          showToast("Lead saved", "success");
        }
      });
    });
  });

  showView("view-leads-results");
}

// ── Lead search flow ─────────────────────────────────────────────────────────

async function qualifyAndShow(profiles, targetDescription) {
  setLoading(
    `Found ${profiles.length} profile${profiles.length === 1 ? "" : "s"}, analyzing…`,
    "Qualifying leads with AI"
  );

  const userId = await getUserId();
  const res = await fetch(API_URL_LEADS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, profiles, targetDescription }),
  });

  if (res.status === 402) {
    showLeadLimit();
    refreshAccountStatus();
    return;
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status >= 500) {
      throw new Error("Our AI service is temporarily unavailable. Please try again in a moment.");
    }
    throw new Error(data.error || `Something went wrong (${res.status}). Please try again.`);
  }

  const data = await res.json();
  const leads = data.leads;
  if (!Array.isArray(leads) || leads.length === 0) {
    throw new Error("No leads returned. Try a broader search.");
  }

  if (typeof data.leadSearchesRemaining === "number" && accountStatus) {
    const limit = data.leadSearchLimit ?? accountStatus.lead_searches_limit ?? 2;
    accountStatus.lead_searches_limit = limit;
    accountStatus.lead_searches_remaining = data.leadSearchesRemaining;
    accountStatus.lead_searches_used = Math.max(0, limit - data.leadSearchesRemaining);
  }
  renderLeadCounter();

  const ts = Date.now();
  await persistLeadResults(leads, targetDescription);
  displayLeads(leads, { ts });
}

async function runFindLeads(targetDescription, { scanCurrentPage = false } = {}) {
  clearError("form-find_leads");
  showView("view-loading");
  setLoading("🔍 Searching LinkedIn…", "Getting started");

  try {
    const profiles = scanCurrentPage
      ? await getSearchProfilesFromCurrentPage()
      : await autoSearchProfiles(targetDescription);

    if (!profiles || profiles.length === 0) {
      let msg =
        "Couldn't read any profiles. Make sure you're logged into LinkedIn, then try again — or use “Find Leads on This Page” on a search results page.";
      if (!scanCurrentPage && (await isDebugAutoSearch())) {
        msg += ` [debug ${JSON.stringify(lastAutoDiag || {})}] — the LinkedIn tab was left open; open its DevTools console for [ProPostly][auto] logs.`;
      }
      throw new Error(msg);
    }

    await qualifyAndShow(profiles, targetDescription);
  } catch (err) {
    showView("view-find_leads");
    showError("form-find_leads", err.message);
    renderLeadCounter();
  }
}

function getLeadTarget() {
  return document.getElementById("lead-target")?.value.trim() || "";
}

// Default action: scan the LinkedIn page the user is already on.
document.getElementById("form-find_leads")?.addEventListener("submit", (e) => {
  e.preventDefault();
  clearError("form-find_leads");
  const target = getLeadTarget();
  if (!target) return;
  runFindLeads(target, { scanCurrentPage: true });
});

// Opt-in: let ProPostly open a background LinkedIn search and scrape it.
document.getElementById("lead-auto-search")?.addEventListener("click", () => {
  clearError("form-find_leads");
  const target = getLeadTarget();
  if (!target) {
    showError("form-find_leads", "Describe your ideal customer first, then try auto-search.");
    return;
  }
  runFindLeads(target);
});

// "New Search" — clear persisted results and start fresh.
document.querySelector("[data-back-leads]")?.addEventListener("click", async () => {
  await clearLeadResults();
  const input = document.getElementById("lead-target");
  if (input) input.value = "";
  showView("view-find_leads");
  renderLeadCounter();
});

document.getElementById("copy-all-hot")?.addEventListener("click", async () => {
  const cached = await getLeadResults();
  const leads = cached?.leads || [];
  const hot = leads.filter((l) => l.quality === "hot");
  if (!hot.length) return;
  const text = hot
    .map((l) => `${l.name}${l.company ? ` (${l.company})` : ""}:\n${l.dm}`)
    .join("\n\n———\n\n");
  await navigator.clipboard.writeText(text);
  showToast(`Copied ${hot.length} hot DM${hot.length === 1 ? "" : "s"}`, "success");
});

document.getElementById("lead-debug")?.addEventListener("change", (e) => {
  chrome.storage.local.set({ debugAutoSearch: e.target.checked });
});

// Open Find Leads: show cached results if present, else the search form.
async function openFindLeads() {
  renderLeadCounter();
  refreshAccountStatus();
  const dbg = await isDebugAutoSearch();
  const cb = document.getElementById("lead-debug");
  if (cb) cb.checked = dbg;
  const cached = await getLeadResults();
  if (cached?.leads?.length) {
    displayLeads(cached.leads, { ts: cached.ts });
  } else {
    showView("view-find_leads");
  }
}

document.getElementById("lead-limit-back")?.addEventListener("click", () => showView("view-home"));
document.getElementById("lead-limit-upgrade")?.addEventListener("click", () => startUpgrade(false));

// ── Visibility / focus refresh ─────────────────────────────────────────────

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    refreshAccountStatus();
  }
});

window.addEventListener("focus", () => {
  refreshAccountStatus();
});

// ── Init ───────────────────────────────────────────────────────────────────

(async function init() {
  await checkOnboarding();
  refreshAccountStatus();
  renderSavedLeads();
})();
