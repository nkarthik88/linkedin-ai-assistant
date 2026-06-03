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

async function getUserName() {
  const { upgradeName } = await chrome.storage.local.get("upgradeName");
  return upgradeName || "";
}

async function registerWithBackend(userId, email, name) {
  try {
    await fetch(`${API_BASE}/api/auth/register-extension`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, email: email || undefined, name: name || undefined }),
    });
  } catch { /* non-fatal — fire and forget */ }
}

function updateHeaderName(name) {
  const el = document.getElementById("header-user-name");
  if (!el) return;
  el.textContent = name ? `Hi, ${name} 👋` : "AI-powered content for your LinkedIn";
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
  const nameInput = document.getElementById("onboarding-name");
  const emailInput = document.getElementById("onboarding-email");
  const errorEl = document.getElementById("onboarding-error");

  const name = nameInput?.value.trim() || "";
  const email = emailInput?.value.trim() || "";

  if (!name) {
    if (errorEl) { errorEl.textContent = "Please enter your name."; errorEl.hidden = false; }
    nameInput?.focus();
    return;
  }

  const save = { onboardingDone: true, upgradeName: name };
  if (email && email.includes("@")) save.upgradeEmail = email;
  await chrome.storage.local.set(save);

  updateHeaderName(name);
  const overlay = document.getElementById("onboarding");
  if (overlay) overlay.hidden = true;

  // Register with backend so email is in DB from day 1
  const userId = await getUserId();
  registerWithBackend(userId, email, name);
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
    usageEl.textContent = "Unlimited access";
    upgradeBtn.hidden = true;
  } else {
    const fu = status?.feature_usage || {};
    const entries = Object.values(fu);
    const anyExhausted = entries.some((f) => f.remaining === 0);
    const leadExhausted = (status?.lead_searches_remaining ?? 1) === 0;
    const limitHit = anyExhausted || leadExhausted;
    usageEl.textContent = limitHit
      ? "Some features at limit — upgrade"
      : "10 uses/feature/month · 5 lead searches";
    usageEl.style.color = limitHit ? "var(--error)" : "";
    // Only show upgrade button when a limit is actually hit
    upgradeBtn.hidden = !limitHit;
  }

  setUpgradeError("");
  renderFeatureCounters(status);
}

const FEATURE_DEFAULT_LIMIT = { generate_post: 10, personalized_dm: 10, reply_comment: 10, improve_headline: 10 };

function renderFeatureCounters(status) {
  const isPro = Boolean(status?.isPro);
  const featureUsage = status?.feature_usage || {};
  const FEATURE_NAMES = ["generate_post", "personalized_dm", "reply_comment", "improve_headline"];

  FEATURE_NAMES.forEach((feature) => {
    const btn = document.querySelector(`.feature-btn[data-feature="${feature}"]`);
    if (!btn) return;

    // Counter text
    let counterEl = btn.querySelector(".feature-usage-counter");
    if (!counterEl) {
      counterEl = document.createElement("span");
      counterEl.className = "feature-usage-counter";
      btn.appendChild(counterEl);
    }

    // Mini progress bar
    let barWrap = btn.querySelector(".feature-btn-bar-bg");
    if (!barWrap) {
      barWrap = document.createElement("div");
      barWrap.className = "feature-btn-bar-bg";
      const fill = document.createElement("div");
      fill.className = "feature-btn-bar-fill";
      barWrap.appendChild(fill);
      btn.appendChild(barWrap);
    }
    const barFill = barWrap.querySelector(".feature-btn-bar-fill");

    if (isPro) {
      counterEl.textContent = "Unlimited";
      counterEl.className = "feature-usage-counter unlimited";
      barWrap.hidden = true;
      btn.disabled = false;
      btn.classList.remove("feature-locked");
    } else {
      const info = featureUsage[feature];
      const defaultLimit = FEATURE_DEFAULT_LIMIT[feature] ?? 10;
      const used = info?.used ?? 0;
      const limit = info?.limit ?? defaultLimit;
      const remaining = info?.remaining ?? (limit - used);
      const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

      if (remaining === 0) {
        counterEl.textContent = `${used}/${limit} · 🔒 Limit reached`;
        counterEl.className = "feature-usage-counter exhausted";
        btn.disabled = true;
        btn.classList.add("feature-locked");
      } else {
        counterEl.textContent = `${used}/${limit} used · ${remaining} left`;
        counterEl.className = `feature-usage-counter${pct >= 80 ? " warn" : ""}`;
        btn.disabled = false;
        btn.classList.remove("feature-locked");
      }

      // Color the bar
      barWrap.hidden = false;
      if (barFill) {
        barFill.style.width = `${pct}%`;
        barFill.className = "feature-btn-bar-fill" +
          (pct >= 100 ? " bar-danger" : pct >= 80 ? " bar-warn" : pct >= 50 ? " bar-mid" : "");
      }
    }
  });
}

async function fetchAccountStatus() {
  const userId = await getUserId();
  const deadline = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), 5000)
  );
  const request = fetch(
    `${API_BASE}/api/usage/status?userId=${encodeURIComponent(userId)}`
  ).then(async (res) => {
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `Status ${res.status}`);
    }
    return res.json();
  });
  return Promise.race([request, deadline]);
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
  const nameEl = document.getElementById("account-name");
  const emailTextEl = document.getElementById("account-email-text");
  const badgeEl = document.getElementById("account-tier-badge");
  const usageText = document.getElementById("account-usage-text");
  const usageBar = document.getElementById("account-usage-bar");
  const usageNote = document.getElementById("account-usage-note");
  const proSection = document.getElementById("account-pro-section");
  const freeSection = document.getElementById("account-free-section");
  const emailUnsetSection = document.getElementById("account-email-unset");

  const name = await getUserName();
  const email = await getUserEmail();

  if (nameEl) nameEl.textContent = name || "—";
  if (emailTextEl) emailTextEl.textContent = email || "No email saved";
  if (emailUnsetSection) emailUnsetSection.hidden = Boolean(email);

  if (!status) return;

  const isPro = Boolean(status.isPro);
  if (badgeEl) {
    badgeEl.textContent = isPro ? "Pro Tier" : "Free Tier";
    badgeEl.classList.toggle("pro", isPro);
  }

  if (usageText) {
    usageText.textContent = isPro ? "Unlimited" : "10 uses / feature / month";
  }

  // Hide the aggregate progress bar for free users — per-feature bars replace it
  if (usageBar) usageBar.style.width = "0%";

  const resetsOn = status.resets_on ? formatResetDate(status.resets_on) : null;
  if (usageNote) {
    if (isPro) {
      usageNote.textContent = "Unlimited AI generations every month";
      usageNote.style.color = "";
    } else {
      usageNote.textContent = resetsOn ? `Resets ${resetsOn}` : "Resets on the 1st of each month";
      usageNote.style.color = "";
    }
  }

  // Per-feature breakdown (free users)
  const breakdownEl = document.getElementById("feature-usage-breakdown");
  if (breakdownEl) {
    if (isPro) {
      breakdownEl.hidden = true;
    } else {
      breakdownEl.hidden = false;
      const fu = status.feature_usage || {};
      const leadUsed = status.lead_searches_used ?? 0;
      const leadLimit = status.lead_searches_limit ?? 5;
      const leadRemaining = status.lead_searches_remaining ?? leadLimit;

      breakdownEl.querySelectorAll(".feature-usage-row").forEach((row) => {
        const feature = row.dataset.feature;
        const counterEl = row.querySelector(".fur-counter");
        if (!counterEl) return;

        if (feature === "deep_lead_search") {
          const pct = leadLimit > 0 ? Math.min(100, Math.round((leadUsed / leadLimit) * 100)) : 0;
          counterEl.textContent = `${leadUsed}/${leadLimit} · ${leadRemaining} left`;
          counterEl.className = `fur-counter${leadRemaining === 0 ? " fur-exhausted" : ""}`;
          updateFurBar(row, pct, leadRemaining === 0);
        } else {
          const info = fu[feature];
          if (info) {
            const { used, limit, remaining } = info;
            const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
            counterEl.textContent = `${used}/${limit} · ${remaining} left`;
            counterEl.className = `fur-counter${remaining === 0 ? " fur-exhausted" : ""}`;
            updateFurBar(row, pct, remaining === 0);
          } else {
            counterEl.textContent = "0/10 · 10 left";
            counterEl.className = "fur-counter";
            updateFurBar(row, 0, false);
          }
        }
      });
    }
  }

  if (proSection) proSection.hidden = !isPro;
  if (freeSection) freeSection.hidden = isPro;
}

function updateFurBar(row, pct, exhausted) {
  let barWrap = row.querySelector(".fur-bar-bg");
  if (!barWrap) {
    barWrap = document.createElement("div");
    barWrap.className = "fur-bar-bg";
    const fill = document.createElement("div");
    fill.className = "fur-bar-fill";
    barWrap.appendChild(fill);
    row.appendChild(barWrap);
  }
  const fill = barWrap.querySelector(".fur-bar-fill");
  if (fill) {
    fill.style.width = `${pct}%`;
    fill.className = `fur-bar-fill${exhausted ? " fur-bar-danger" : pct >= 80 ? " fur-bar-warning" : ""}`;
  }
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
  const emailTextEl = document.getElementById("account-email-text");
  if (emailTextEl) emailTextEl.textContent = email;
  const emailUnsetSection = document.getElementById("account-email-unset");
  if (emailUnsetSection) emailUnsetSection.hidden = true;

  const userId = await getUserId();
  const name = await getUserName();
  registerWithBackend(userId, email, name);

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
document.getElementById("account-upgrade-btn")?.addEventListener("click", (e) => {
  startUpgrade(e.currentTarget);
});

// ── Upgrade flow ───────────────────────────────────────────────────────────

async function startUpgrade(triggerBtn = null) {
  const btn = triggerBtn instanceof HTMLElement ? triggerBtn : null;
  if (btn?.disabled) return;

  const errorSetter = (msg) => {
    setUpgradeError(msg);
    const promptErr = document.getElementById("upgrade-prompt-error");
    if (promptErr) { promptErr.textContent = msg; promptErr.hidden = !msg; }
    const leadErr = document.getElementById("lead-limit-error");
    if (leadErr) { leadErr.textContent = msg; leadErr.hidden = !msg; }
  };

  errorSetter("");
  if (btn) { btn.disabled = true; btn.dataset.prevText = btn.textContent; btn.textContent = "Opening checkout…"; }

  try {
    const userId = await getUserId();
    if (!userId) throw new Error("Could not identify your account. Reload the extension and try again.");

    let customerEmail = await getUserEmail();
    let customerName = await getUserName();

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

    if (!customerName) {
      const prompted = window.prompt("Enter your full name for the checkout form (optional):", "");
      if (prompted && prompted.trim()) {
        customerName = prompted.trim();
        await chrome.storage.local.set({ upgradeName: customerName });
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
        name: customerName || undefined,
        customerName: customerName || undefined,
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

    if (btn) btn.textContent = "Waiting for payment…";

    // Poll for Pro status for up to 3 minutes after checkout opens
    let pollCount = 0;
    const pollInterval = setInterval(async () => {
      pollCount++;
      try {
        const status = await fetchAccountStatus();
        if (status?.isPro) {
          clearInterval(pollInterval);
          await chrome.storage.local.set({ isPro: true, pendingUpgrade: false });
          renderAccountStatus(status);
          if (btn) btn.textContent = "✅ Pro activated!";
          showToast("🎉 You're now Pro! Unlimited access unlocked.", "success");
          setTimeout(() => showView("view-home"), 1500);
        } else if (pollCount >= 18) {
          clearInterval(pollInterval);
          if (btn) btn.textContent = "Complete payment, then reopen";
        }
      } catch { /* ignore */ }
    }, 10000);
  } catch (err) {
    errorSetter(err.message);
    if (btn) btn.textContent = btn.dataset.prevText || "Upgrade to Pro — $9/month";
  } finally {
    if (btn) btn.disabled = false;
  }
}

document.getElementById("upgrade-btn")?.addEventListener("click", (e) => startUpgrade(e.currentTarget));
document.getElementById("upgrade-prompt-btn")?.addEventListener("click", (e) => startUpgrade(e.currentTarget));
document.getElementById("upgrade-prompt-back")?.addEventListener("click", () => showView("view-home"));

// ── Profile helpers ────────────────────────────────────────────────────────

async function getActiveLinkedInTab() {
  // Query all active tabs across every window (works from side panel too)
  const activeTabs = await chrome.tabs.query({ active: true });
  const activeLinkedIn = activeTabs.find(t => t.url?.includes("linkedin.com"));
  if (activeLinkedIn) return activeLinkedIn;
  // Fall back to any open LinkedIn tab
  const allTabs = await chrome.tabs.query({});
  const anyLinkedIn = allTabs.find(t => t.url?.includes("linkedin.com"));
  if (anyLinkedIn) return anyLinkedIn;
  throw new Error("Open a LinkedIn page in your browser first.");
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

  // Give the newly-injected script time to register its message listener
  await new Promise((r) => setTimeout(r, 150));
}

async function getProfileDataFromPage({ refresh = false, requireProfile = true } = {}) {
  const tab = await getActiveLinkedInTab();

  if (requireProfile && !/\/in\/[^/?#]+/i.test(tab.url || "")) {
    throw new Error(
      "Navigate to a LinkedIn profile (linkedin.com/in/username) before generating DMs."
    );
  }

  await ensureContentScript(tab.id);

  const response = await chrome.tabs.sendMessage(tab.id, {
    type: "GET_PROFILE_DATA",
    refresh,
    allowAnyPage: !requireProfile,
  });

  if (!response?.success) {
    throw new Error(response?.error || "Could not read profile data.");
  }

  return response.profileData;
}

// Like getProfileDataFromPage but never throws — returns { profileData, warning }
async function getProfileDataForDM() {
  try {
    const tab = await getActiveLinkedInTab();
    if (!/\/in\/[^/?#]+/i.test(tab.url || "")) {
      return { profileData: {}, warning: "Navigate to a LinkedIn profile (linkedin.com/in/username) first." };
    }
    await ensureContentScript(tab.id);
    const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_PROFILE_DATA", refresh: true });
    if (response?.profileData && (response.profileData.name || response.profileData.headline)) {
      return { profileData: response.profileData, warning: null };
    }
    return {
      profileData: response?.profileData || {},
      warning: response?.error || "Profile details couldn't be read — paste them manually below.",
    };
  } catch (err) {
    return { profileData: {}, warning: err.message };
  }
}

function renderProfilePreview(elId, profileData) {
  const el = document.getElementById(elId);
  if (!el) return;

  const { name, headline, photo, location, experience } = profileData;
  if (!name && !headline) {
    el.hidden = true;
    return;
  }

  el.hidden = false;
  const avatarHtml = photo
    ? `<img src="${escapeHtml(photo)}" class="profile-preview-photo" alt="${escapeHtml(name || "")}" />`
    : `<div class="profile-preview-avatar-placeholder">${escapeHtml((name || "?")[0].toUpperCase())}</div>`;

  const company = experience?.[0] ? `<span class="profile-preview-company">🏢 ${escapeHtml(experience[0].split(" · ")[0])}</span>` : "";
  const loc = location ? `<span class="profile-preview-location">📍 ${escapeHtml(location)}</span>` : "";

  el.innerHTML = `
    <div class="profile-preview-inner">
      <div class="profile-preview-left">${avatarHtml}</div>
      <div class="profile-preview-right">
        <div class="profile-preview-name">${escapeHtml(name || "")}</div>
        ${headline ? `<div class="profile-preview-headline">${escapeHtml(headline)}</div>` : ""}
        <div class="profile-preview-meta">${company}${loc}</div>
      </div>
    </div>
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
    // Usage limit reached — show upgrade prompt with context
    let limitMsg = "";
    try {
      const errData = await res.json();
      limitMsg = errData.error || "";
    } catch { /* ignore */ }
    const titleEl = document.getElementById("upgrade-prompt-title");
    const descEl = document.getElementById("upgrade-prompt-desc");
    if (titleEl) titleEl.textContent = "You've reached your free limit";
    if (descEl) {
      descEl.innerHTML = limitMsg
        ? `${escapeHtml(limitMsg)}<br><br>Upgrade to Pro for <strong>unlimited AI generations</strong> — just $9/month.`
        : `Upgrade to Pro for <strong>unlimited AI generations</strong> every month — just $9/month.`;
    }
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

  const feature = body?.feature;
  if (feature && typeof data.featureUsed === "number" && data.featureLimit !== null) {
    // Server returned authoritative counts — update local state regardless of whether
    // accountStatus was loaded (fixes the case where init() hasn't resolved yet)
    const used = data.featureUsed;
    const limit = data.featureLimit;
    const remaining = data.featureRemaining ?? Math.max(0, limit - used);

    // Merge into accountStatus (create skeleton if not yet populated)
    const base = accountStatus || { isPro: false, feature_usage: {}, lead_searches_used: 0, lead_searches_limit: 5, lead_searches_remaining: 5 };
    const updatedStatus = {
      ...base,
      feature_usage: {
        ...(base.feature_usage || {}),
        [feature]: { used, limit, remaining, unlimited: false },
      },
    };
    renderAccountStatus(updatedStatus);
    accountStatus = updatedStatus;

    // Toast with emoji + count
    const featureEmoji = { generate_post: "✍️", personalized_dm: "💬", reply_comment: "↩️", improve_headline: "🎯", viral_rewriter: "🚀" };
    const emoji = featureEmoji[feature] || "✅";
    showToast(`${emoji} ${used}/${limit} used · ${remaining} remaining`, "success");

    // Engagement messages at milestones
    const pct = limit > 0 ? (used / limit) * 100 : 0;
    if (remaining === 0) {
      // handled by upgrade prompt on next attempt
    } else if (remaining === 1) {
      setTimeout(() => showToast(`⚠️ Last free use for this feature — upgrade for unlimited!`, "default"), 3200);
    } else if (pct >= 80 && pct < 90) {
      setTimeout(() => showToast(`⚠️ ${remaining} uses left — ready to upgrade?`, "default"), 3200);
    } else if (pct >= 50 && used === Math.ceil(limit * 0.5)) {
      setTimeout(() => showToast(`🔥 Halfway through — you're on a roll!`, "default"), 3200);
    }
  } else if (accountStatus && !accountStatus.isPro && typeof data.remainingCredits === "number") {
    const updatedStatus = {
      ...accountStatus,
      remaining: data.remainingCredits,
      usedThisMonth: (accountStatus.limit ?? 10) - data.remainingCredits,
    };
    renderAccountStatus(updatedStatus);
    accountStatus = updatedStatus;
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

  const isReply = feature === "reply_comment";
  const isPost = feature === "generate_post";
  const isDM = feature === "personalized_dm";

  const POST_STYLE_LABELS = ["💼 Professional", "🚀 Inspiring", "😎 Conversational"];
  const DM_TONE_LABELS = ["👔 Professional", "🤝 Collaborative", "😊 Casual"];

  if (isDM) {
    // Add regenerate button above cards
    const regenRow = document.createElement("div");
    regenRow.className = "dm-regen-row";
    regenRow.innerHTML = `<button type="button" id="regen-dm-btn" class="regen-btn">🔄 Generate Different Options</button>`;
    container.appendChild(regenRow);
    regenRow.querySelector("#regen-dm-btn").addEventListener("click", () => {
      showView("view-personalized_dm");
    });
  }

  options.forEach((text, i) => {
    const card = document.createElement("div");
    card.className = "option-card";
    const charCount = String(text).length;

    let labelHtml = "";
    if (isPost) labelHtml = POST_STYLE_LABELS[i] || `Option ${i + 1}`;
    else if (isDM) labelHtml = DM_TONE_LABELS[i] || `Option ${i + 1}`;
    else labelHtml = `Option ${i + 1}`;

    card.innerHTML = `
      <div class="option-num">${labelHtml} <span class="char-count">${charCount} chars</span></div>
      <div class="option-text">${escapeHtml(String(text))}</div>
      ${isReply
        ? `<div class="reply-actions">
             <button type="button" class="post-reply-btn" data-index="${i}">↩ Post Reply</button>
             <button type="button" class="copy-btn copy-reply-btn" data-index="${i}">Copy</button>
           </div>`
        : isPost
        ? `<div class="reply-actions">
             <button type="button" class="copy-btn" data-index="${i}">📋 Copy</button>
             <button type="button" class="viral-btn" data-index="${i}">🔥 Make it Viral</button>
           </div>
           <div class="viral-result" id="viral-result-${i}" hidden></div>`
        : isDM
        ? `<button type="button" class="copy-btn dm-copy-btn" data-index="${i}">📋 Copy DM</button>`
        : `<button type="button" class="copy-btn" data-index="${i}">Copy</button>`}
    `;
    container.appendChild(card);
  });

  if (isReply) {
    container.querySelectorAll(".post-reply-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const text = options[Number(btn.dataset.index)];
        const prevText = btn.textContent;
        btn.textContent = "Posting…";
        btn.disabled = true;
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tab?.id || !tab.url?.includes("linkedin.com")) {
            throw new Error("Open the LinkedIn post in a tab, click Reply under the comment, then try again.");
          }
          await ensureContentScript(tab.id);
          const resp = await chrome.tabs.sendMessage(tab.id, {
            type: "FILL_COMMENT_REPLY",
            text,
          });
          if (!resp?.success) throw new Error(resp?.error || "Could not find comment box. Click Reply under the LinkedIn comment first.");
          btn.textContent = "✅ Done!";
          showToast("Reply ready — click Post on LinkedIn! 🚀", "success");
        } catch (err) {
          showToast(err.message, "default");
          btn.textContent = prevText;
          btn.disabled = false;
        }
      });
    });

    // Copy button also on reply cards (fallback)
    container.querySelectorAll(".copy-reply-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const text = options[Number(btn.dataset.index)];
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          try {
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.style.cssText = "position:fixed;opacity:0";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
          } catch {
            showToast("Could not copy. Please select and copy manually.", "default");
            return;
          }
        }
        btn.textContent = "Copied!";
        btn.classList.add("copied");
        showToast("Copied to clipboard!", "success");
        setTimeout(() => { btn.textContent = "Copy"; btn.classList.remove("copied"); }, 2000);
      });
    });
  }

  if (isPost) {
    container.querySelectorAll(".post-to-linkedin-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const text = options[Number(btn.dataset.index)];
        const prevText = btn.textContent;
        btn.disabled = true;

        // Step 1: copy text to clipboard
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          try {
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.style.cssText = "position:fixed;opacity:0";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
          } catch {
            showToast("Could not copy. Please copy manually then go to LinkedIn.", "default");
            btn.disabled = false;
            return;
          }
        }

        // Step 2: open or focus LinkedIn tab
        const linkedinTabs = await chrome.tabs.query({ url: "*://*.linkedin.com/*" });
        if (linkedinTabs.length > 0) {
          // Focus existing LinkedIn tab
          await chrome.tabs.update(linkedinTabs[0].id, { active: true });
          await chrome.windows.update(linkedinTabs[0].windowId, { focused: true });
        } else {
          // Open LinkedIn feed in new tab
          await chrome.tabs.create({ url: "https://www.linkedin.com/feed/" });
        }

        btn.textContent = "✅ Copied!";
        showToast("✅ Copied! Click 'Start a post' on LinkedIn and press Ctrl+V (or ⌘V)", "success");
        setTimeout(() => { btn.textContent = prevText; btn.disabled = false; }, 3000);
      });
    });
  }

  // 🔥 Make it Viral button
  if (isPost) {
    container.querySelectorAll(".viral-btn").forEach((btn) => {
      let viralAttempts = 0;
      const MAX_VIRAL_ATTEMPTS = 3;

      async function runViral() {
        const i = Number(btn.dataset.index);
        const originalText = options[i];
        const resultBox = document.getElementById(`viral-result-${i}`);
        viralAttempts++;

        const attemptLabel = viralAttempts > 1 ? ` (attempt ${viralAttempts}/${MAX_VIRAL_ATTEMPTS})` : "";
        btn.textContent = `🔥 Making it viral…${attemptLabel}`;
        btn.disabled = true;
        if (resultBox) {
          resultBox.hidden = false;
          resultBox.innerHTML = `<div class="viral-loading">🔥 Rewriting for maximum engagement… ⏳ May take 10–20 seconds</div>`;
        }

        try {
          const userId = await getUserId();
          const email = await getUserEmail();
          const viralOptions = await callApi({
            feature: "viral_rewriter",
            userId,
            email: email || undefined,
            draftPost: originalText,
          });
          const viralText = viralOptions[0];

          // Reset attempt counter on success so "Redo Viral" can retry fresh
          viralAttempts = 0;

          resultBox.innerHTML = `
            <div class="viral-label">🔥 Viral Version</div>
            <div class="viral-text">${escapeHtml(viralText)}</div>
            <div class="viral-actions">
              <button type="button" class="copy-viral-btn">📋 Copy Viral</button>
            </div>
          `;

          resultBox.querySelector(".copy-viral-btn").addEventListener("click", async (e) => {
            const copyBtn = e.currentTarget;
            try { await navigator.clipboard.writeText(viralText); } catch {
              const ta = document.createElement("textarea");
              ta.value = viralText; ta.style.cssText = "position:fixed;opacity:0";
              document.body.appendChild(ta); ta.select();
              document.execCommand("copy"); document.body.removeChild(ta);
            }
            copyBtn.textContent = "✅ Copied!";
            showToast("🔥 Viral version copied!", "success");
            setTimeout(() => { copyBtn.textContent = "📋 Copy Viral"; }, 2000);
          });

          btn.textContent = "🔄 Redo Viral";
          btn.disabled = false;
          showToast("🔥 Viral version ready!", "success");

        } catch (err) {
          if (err.message === "__LIMIT_REACHED__") return;

          if (viralAttempts < MAX_VIRAL_ATTEMPTS) {
            // Show retry option
            const retryLabel = viralAttempts === MAX_VIRAL_ATTEMPTS - 1 ? "🔄 Retry (last attempt)" : "🔄 Retry Viral";
            btn.textContent = retryLabel;
            btn.disabled = false;
            if (resultBox) {
              resultBox.hidden = false;
              resultBox.innerHTML = `<div class="viral-error">❌ Failed to make viral — click Retry to try again</div>`;
            }
            showToast("❌ Viral generation failed — tap Retry", "default");
          } else {
            // 3 failures — show fallback
            btn.textContent = "Use original instead";
            btn.disabled = true;
            if (resultBox) {
              resultBox.hidden = false;
              resultBox.innerHTML = `
                <div class="viral-error viral-fallback">
                  ❌ Couldn't generate viral version after 3 attempts.<br>
                  No worries — the original post above is great! 📋 Copy it and post.
                </div>`;
            }
            showToast("Viral failed 3× — use the original post", "default");
          }
        }
      }

      btn.addEventListener("click", runViral);
    });
  }

  // Copy button — works for ALL card types (post, headline, etc.)
  container.querySelectorAll(".copy-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const text = options[Number(btn.dataset.index)];
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          try {
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
          } catch {
            showToast("Could not copy — please select and copy manually", "default");
            return;
          }
        }
        const isDMCopy = btn.classList.contains("dm-copy-btn");
        btn.textContent = "✅ Copied!";
        btn.classList.add("copied");
        showToast(
          isPost ? "✅ Copied! Ready to post on LinkedIn 🚀"
          : isDMCopy ? "✅ DM copied! Open Messages and paste →"
          : "Copied to clipboard!",
          "success"
        );
        const origLabel = isDMCopy ? "📋 Copy DM" : isPost ? "📋 Copy" : "Copy";
        setTimeout(() => {
          btn.textContent = origLabel;
          btn.classList.remove("copied");
        }, 2000);
      });
    });

  showView("view-results");
}

// ── Generation runner ──────────────────────────────────────────────────────

const LOADING_MESSAGES = {
  generate_post: "✍️ Writing your posts…",
  personalized_dm: "💬 Crafting your DM…",
  reply_comment: "↩️ Writing replies…",
  improve_headline: "🎯 Rewriting your headline…",
  viral_rewriter: "🚀 Boosting your post…",
};

async function runGeneration(feature, buildBody) {
  showView("view-loading");
  const loadingText = document.getElementById("loading-text");
  if (loadingText) loadingText.textContent = LOADING_MESSAGES[feature] || "Generating with AI…";
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
      const { profileData, warning } = await getProfileDataForDM();
      showView("view-personalized_dm");
      const previewEl = document.getElementById("profile-preview-dm");
      if (profileData.name || profileData.headline) {
        renderProfilePreview("profile-preview-dm", profileData);
        if (previewEl) {
          previewEl.hidden = false;
          // Store partial data for submit
          previewEl.dataset.profileJson = JSON.stringify(profileData);
        }
      } else if (warning && previewEl) {
        previewEl.hidden = false;
        previewEl.dataset.profileJson = "";
        previewEl.innerHTML = `<strong>Note</strong><span>${escapeHtml(warning)}</span>`;
      }
      return;
    }

    if (feature === "deep_lead_search") {
      openDeepLeadSearch();
      return;
    }

    if (feature === "reply_comment") {
      showView("view-reply_comment");
      // Small delay so the view is visible before we update it
      setTimeout(() => tryReadFromPage({ silent: true }), 80);
      return;
    }

    showView(`view-${feature}`);

    if (feature === "generate_post") {
      setTimeout(() => document.getElementById("topic")?.focus(), 50);
    }

    if (feature === "improve_headline") {
      // Just show the view — both buttons handle their own logic
      const statusEl = document.getElementById("headline-load-status");
      if (statusEl) statusEl.hidden = true;
      const profilePreview = document.getElementById("profile-preview-headline");
      if (profilePreview) profilePreview.hidden = true;
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

// ── Reply to Comment: read text from LinkedIn page ────────────────────────

async function tryReadFromPage({ silent = false } = {}) {
  const statusEl = document.getElementById("read-from-page-status");
  const btn = document.getElementById("read-from-page-btn");
  const ta = document.getElementById("comment-text");

  function setStatus(msg, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = `read-from-page-status${isError ? " error" : " ok"}`;
    statusEl.hidden = !msg;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url?.includes("linkedin.com")) {
      if (!silent) setStatus("Open LinkedIn first, then try again.", true);
      return;
    }
    if (btn) btn.textContent = "Reading…";
    await ensureContentScript(tab.id);
    const resp = await chrome.tabs.sendMessage(tab.id, { type: "GET_SELECTED_TEXT" });
    if (resp?.success && resp.text) {
      if (ta) {
        ta.value = resp.text;
        ta.dispatchEvent(new Event("input"));
      }
      setStatus("✅ Comment loaded from LinkedIn!");
    } else if (!silent) {
      setStatus(resp?.error || "Could not read comment. Select the comment text on LinkedIn, then click Read from LinkedIn.", true);
    }
  } catch (err) {
    if (!silent) setStatus("Could not connect to LinkedIn tab.", true);
  } finally {
    if (btn) btn.textContent = "📋 Read from LinkedIn";
  }
}

document.getElementById("read-from-page-btn")?.addEventListener("click", () => {
  tryReadFromPage({ silent: false });
});

// ── Form submissions ───────────────────────────────────────────────────────

document.getElementById("form-generate_post")?.addEventListener("submit", (e) => {
  e.preventDefault();
  clearError("form-generate_post");
  const topic = document.getElementById("topic").value.trim();
  if (!topic) return;
  runGeneration("generate_post", async (userId) => ({ userId, topic }));
});

// Intent chip toggle
document.querySelectorAll(".intent-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const wasActive = chip.classList.contains("active");
    document.querySelectorAll(".intent-chip").forEach((c) => c.classList.remove("active"));
    if (!wasActive) chip.classList.add("active");
  });
});

let dmGenerating = false;
document.getElementById("form-personalized_dm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (dmGenerating) return;
  dmGenerating = true;

  // Disable button and show loading immediately — no visual dead zone
  const submitBtn = e.target.querySelector("button[type=submit]");
  const originalBtnText = submitBtn?.textContent ?? "";
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "⏳ Generating…"; }
  showView("view-loading");
  const loadingText = document.getElementById("loading-text");
  if (loadingText) loadingText.textContent = "💬 Crafting your DM…";

  const previewEl = document.getElementById("profile-preview-dm");
  try {
    // Use profile cached from button-click load; re-read only if missing
    let profileData = {};
    const cachedJson = previewEl?.dataset.profileJson;
    if (cachedJson) {
      try { profileData = JSON.parse(cachedJson); } catch { /* fall through */ }
    }
    if (!profileData.name && !profileData.headline) {
      const result = await getProfileDataForDM();
      profileData = result.profileData;
    }

    const dmContext = document.getElementById("dm-context")?.value.trim();
    const intentChip = document.querySelector(".intent-chip.active");
    const intent = intentChip?.dataset.intent || "";
    const topicParts = [intent ? `Goal: ${intent}` : "", dmContext].filter(Boolean);
    await runGeneration("personalized_dm", async (userId) => ({
      userId,
      profileData,
      topic: topicParts.join(". ") || undefined,
    }));
  } catch (err) {
    showView("view-personalized_dm");
    if (previewEl && previewEl.innerHTML.includes("<strong>Note</strong>")) {
      previewEl.hidden = true;
    }
    showError("form-personalized_dm", err.message);
  } finally {
    dmGenerating = false;
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalBtnText; }
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

// "Generate from Profile" button — reads full profile, no typing needed
document.getElementById("headline-from-profile-btn")?.addEventListener("click", async () => {
  const btn = document.getElementById("headline-from-profile-btn");
  const statusEl = document.getElementById("headline-load-status");
  const setStatus = (msg, isError = false) => {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = `read-from-page-status${isError ? " error" : " ok"}`;
    statusEl.hidden = !msg;
  };
  const showManualFallback = () => {
    setStatus("❌ Couldn't read profile. Type your headline below and use \"Improve My Headline\" instead.", true);
    document.getElementById("headline-input")?.focus();
  };

  const prevText = btn.textContent;
  btn.textContent = "📖 Reading profile…";
  btn.disabled = true;
  setStatus("📖 Reading your LinkedIn profile…");

  // Progress hint after 2s so the user knows we're still working
  const hintTimer = setTimeout(() => setStatus("⏳ Still reading — make sure you're on your LinkedIn profile page…"), 2000);

  try {
    // getProfileDataForDM never throws — uses retry with 0/1200/2500ms delays
    const { profileData, warning } = await getProfileDataForDM();
    clearTimeout(hintTimer);

    if (!profileData.name && !profileData.headline) {
      // No usable profile data — show manual fallback
      btn.textContent = prevText;
      btn.disabled = false;
      showManualFallback();
      return;
    }

    renderProfilePreview("profile-preview-headline", profileData);
    setStatus("✅ Profile read! Generating headlines…");

    await runGeneration("improve_headline", async (userId) => ({
      userId,
      headline: profileData.headline || "",
      profileData,
    }));

  } catch (err) {
    clearTimeout(hintTimer);
    showManualFallback();
  } finally {
    btn.textContent = prevText;
    btn.disabled = false;
  }
});

// "Improve My Headline" form — user pastes their headline
document.getElementById("form-improve_headline")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError("form-improve_headline");
  const headline = document.getElementById("headline-input")?.value.trim();
  if (!headline) {
    showError("form-improve_headline", "Paste your current headline above first.");
    document.getElementById("headline-input")?.focus();
    return;
  }
  runGeneration("improve_headline", async (userId) => ({ userId, headline, profileData: {} }));
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
  // Results-view pill (unchanged)
  const pill = document.getElementById("lead-counter-results");
  const s = accountStatus;
  if (pill) {
    if (s && typeof s.lead_searches_remaining === "number") {
      const used = s.lead_searches_used ?? 0;
      const limit = s.lead_searches_limit ?? 10;
      pill.textContent = `🔎 ${used}/${limit} searches used`;
      pill.style.color = s.lead_searches_remaining === 0 ? "var(--error)" : "";
    } else {
      pill.textContent = "";
    }
  }

  // New progress-bar UI
  const counterEl = document.getElementById("lead-counter");
  const barEl = document.getElementById("lead-progress-bar");
  const engagEl = document.getElementById("lead-engagement-msg");
  const resetEl = document.getElementById("lead-reset-date");

  if (!s || typeof s.lead_searches_remaining !== "number") {
    if (counterEl) counterEl.textContent = "Lead searches available";
    return;
  }

  const used = s.lead_searches_used ?? 0;
  const limit = s.lead_searches_limit ?? 10;
  const remaining = s.lead_searches_remaining;
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const isPro = Boolean(s.isPro);

  if (counterEl) {
    counterEl.textContent = `🔎 ${used}/${limit} searches used · ${remaining} remaining`;
    counterEl.classList.toggle("limit-hit", remaining === 0);
  }

  if (barEl) {
    barEl.style.width = `${pct}%`;
    barEl.className = "lead-progress-bar" +
      (pct >= 100 ? " bar-danger" : pct >= 80 ? " bar-warning" : "");
  }

  if (engagEl) {
    if (remaining === 0) {
      engagEl.textContent = isPro ? "Monthly limit reached" : "Upgrade for 50 searches →";
    } else if (!isPro && used >= Math.floor(limit * 0.8)) {
      engagEl.textContent = `🎯 ${remaining} left — upgrade for 50/month!`;
    } else if (!isPro && used >= Math.floor(limit * 0.5)) {
      engagEl.textContent = "🔥 You're halfway there!";
    } else {
      engagEl.textContent = "";
    }
  }

  if (resetEl && s.resets_on) {
    const date = formatResetDate(s.resets_on);
    resetEl.textContent = date ? `Resets ${date}` : "";
  }
}

// ── Search History ────────────────────────────────────────────────────────────

async function getSearchHistory() {
  const { leadSearchHistory } = await chrome.storage.local.get("leadSearchHistory");
  return Array.isArray(leadSearchHistory) ? leadSearchHistory : [];
}

async function saveSearchHistory(filters, leadsCount, hotCount) {
  const history = await getSearchHistory();
  const parts = [filters.title, filters.company, filters.location, filters.keywords]
    .filter(Boolean).join(" · ");
  const entry = { filters, leadsCount, hotCount, label: parts, ts: Date.now() };
  // dedupe by label (keep newest)
  const deduped = history.filter((h) => h.label !== parts);
  const next = [entry, ...deduped].slice(0, 10);
  await chrome.storage.local.set({ leadSearchHistory: next });
}

function filtersLabel(filters) {
  return [filters.title, filters.company, filters.location, filters.keywords]
    .filter(Boolean).join(" · ") || "(any)";
}

async function renderSearchHistory() {
  const section = document.getElementById("lead-history-section");
  const list = document.getElementById("lead-history-list");
  if (!section || !list) return;

  const history = await getSearchHistory();
  if (history.length === 0) { section.hidden = true; return; }

  section.hidden = false;
  list.innerHTML = "";
  history.slice(0, 5).forEach((entry) => {
    const item = document.createElement("div");
    item.className = "lead-history-item";
    const ago = relativeTime(entry.ts);
    const meta = entry.leadsCount != null
      ? `${entry.hotCount ?? 0}🔥 · ${ago}`
      : ago;
    item.innerHTML = `
      <span class="lead-history-filters" title="${escapeHtml(entry.label)}">${escapeHtml(entry.label)}</span>
      <span class="lead-history-meta">${escapeHtml(meta)}</span>
    `;
    item.addEventListener("click", () => {
      const f = entry.filters;
      const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ""; };
      setVal("filter-title", f.title);
      setVal("filter-company", f.company);
      setVal("filter-location", f.location);
      setVal("filter-keywords", f.keywords);
    });
    list.appendChild(item);
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
  const limit = accountStatus?.lead_searches_limit ?? (isPro ? 50 : 10);
  const msg = document.getElementById("lead-limit-msg");
  const resetEl = document.getElementById("lead-limit-reset");
  const upBtn = document.getElementById("lead-limit-upgrade");

  if (msg) {
    msg.textContent = isPro
      ? `You've used all ${limit} lead searches this month.`
      : "You've used all 5 free lead searches this month. Upgrade to Pro for 50 searches/month.";
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
  saved.unshift({ ...lead, status: "new", savedAt: Date.now() });
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

async function setLeadStatus(key, status) {
  const saved = await getSavedLeads();
  const next = saved.map((l) => (leadKey(l) === key ? { ...l, status } : l));
  await chrome.storage.local.set({ savedLeads: next });
  await renderSavedLeads();
}

async function exportLeadsCSV() {
  const saved = await getSavedLeads();
  if (!saved.length) {
    showToast("No saved leads to export", "default");
    return;
  }
  const cols = ["Name", "Title", "Company", "Location", "Quality", "Status", "DM", "Profile URL"];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = saved.map((l) =>
    [l.name, l.title, l.company, l.location, l.quality, l.status || "new", l.dm, l.url]
      .map(esc)
      .join(",")
  );
  const csv = [cols.join(","), ...rows].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "propostly-leads.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  showToast(`Exported ${saved.length} lead${saved.length === 1 ? "" : "s"}`, "success");
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

  if (saved.length === 0) {
    list.innerHTML = `<div class="saved-empty">No saved leads yet.<br>Start a Deep Lead Search! 🔎</div>`;
    return;
  }

  saved.forEach((lead) => {
    const q = LEAD_QUALITY[lead.quality] || LEAD_QUALITY.cold;
    const sub = lead.title && lead.company
      ? `${lead.title} at ${lead.company}`
      : lead.title || lead.company || lead.headline || "";
    const key = leadKey(lead);
    const contacted = lead.status === "contacted";

    const item = document.createElement("div");
    item.className = `saved-lead-card${contacted ? " sl-contacted" : ""}`;
    item.innerHTML = `
      <div class="sl-head" role="button" tabindex="0" aria-expanded="false">
        <div class="sl-left">
          <div class="sl-name">${escapeHtml(lead.name || "Unknown")}
            ${contacted ? '<span class="sl-status-badge contacted">✓ Contacted</span>' : ""}
          </div>
          ${sub ? `<div class="sl-sub">${escapeHtml(sub)}</div>` : ""}
        </div>
        <div class="sl-right">
          <span class="quality-badge ${q.cls}">${q.icon} ${q.label}</span>
          <span class="sl-chevron">▾</span>
        </div>
      </div>
      <div class="sl-body" hidden>
        ${lead.location ? `<div class="sl-location">📍 ${escapeHtml(lead.location)}</div>` : ""}
        ${lead.dm ? `
          <div class="sl-dm-label">💬 Personalized DM</div>
          <div class="sl-dm">${escapeHtml(lead.dm)}</div>
        ` : ""}
        <div class="sl-actions">
          <button type="button" class="sl-btn sl-copy">📋 Copy DM</button>
          ${lead.url ? `<button type="button" class="sl-btn sl-view">👁 Profile</button>` : ""}
        </div>
        <div class="sl-actions sl-actions-2">
          <button type="button" class="sl-btn sl-status-btn${contacted ? " sl-contacted-btn" : ""}">${contacted ? "↺ Mark New" : "✓ Contacted"}</button>
          <button type="button" class="sl-btn sl-delete">🗑 Delete</button>
        </div>
      </div>
    `;

    const head = item.querySelector(".sl-head");
    const body = item.querySelector(".sl-body");
    const chevron = item.querySelector(".sl-chevron");
    head.addEventListener("click", () => {
      const open = !body.hidden;
      body.hidden = open;
      chevron.style.transform = open ? "" : "rotate(180deg)";
      head.setAttribute("aria-expanded", String(!open));
    });

    item.querySelector(".sl-copy")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      try { await navigator.clipboard.writeText(lead.dm || ""); } catch { /* ignore */ }
      const b = e.currentTarget;
      b.textContent = "✅ Copied!";
      showToast("DM copied!", "success");
      setTimeout(() => { b.textContent = "📋 Copy DM"; }, 2000);
    });

    item.querySelector(".sl-view")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (lead.url) chrome.tabs.create({ url: lead.url });
    });

    item.querySelector(".sl-status-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      setLeadStatus(key, contacted ? "new" : "contacted");
      showToast(contacted ? "Marked as new" : "✓ Marked as contacted!", "success");
    });

    item.querySelector(".sl-delete")?.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteSavedLead(key);
      showToast("Lead removed", "default");
    });

    list.appendChild(item);
  });
}

// ── Background-tab auto search ────────────────────────────────────────────────

async function autoSearchProfiles(searchUrl) {
  setLoading("🔍 Searching LinkedIn…", "Opening results in a background tab");

  const tab = await chrome.tabs.create({ url: searchUrl, active: false });
  const tabId = tab.id;

  try {
    const deadline = Date.now() + 28000;
    let profiles = [];
    while (Date.now() < deadline) {
      await sleepMs(1500);
      try {
        await ensureContentScript(tabId);
        const resp = await chrome.tabs.sendMessage(tabId, { type: "AUTO_SCRAPE" });
        if (resp?.success && resp.profiles?.length) {
          profiles = resp.profiles;
          break;
        }
      } catch {
        /* tab still loading, keep waiting */
      }
    }
    return profiles;
  } finally {
    try {
      await chrome.tabs.remove(tabId);
    } catch {
      /* already closed */
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
  const warmCount = leads.filter((l) => l.quality === "warm").length;
  const coldCount = leads.filter((l) => l.quality === "cold").length;

  // Show only hot + warm; if none, show a hint rather than dumping cold leads
  const qualifiedLeads = leads.filter((l) => l.quality === "hot" || l.quality === "warm");
  const visibleLeads = qualifiedLeads;

  if (title) {
    const parts = [];
    if (hotCount > 0) parts.push(`🔥 ${hotCount} Hot`);
    if (warmCount > 0) parts.push(`⚡ ${warmCount} Warm`);
    if (parts.length > 0) {
      if (coldCount > 0) parts.push(`(${coldCount} others filtered out)`);
      title.textContent = parts.join("  ·  ");
    } else {
      title.textContent = coldCount > 0
        ? `No close matches — try broader filters`
        : "No leads found";
    }
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

  // If nothing matched, show actionable hint
  if (visibleLeads.length === 0) {
    const hint = document.createElement("div");
    hint.className = "leads-empty-hint";
    hint.innerHTML = coldCount > 0
      ? `<strong>No close matches found.</strong><br>Try broadening your filters — use a more general title (e.g. "Engineer" not "DevOps Engineer"), remove the company filter, or use a country instead of a city.`
      : `<strong>No profiles were found.</strong><br>Make sure you're on a LinkedIn search results page, then try again.`;
    container.appendChild(hint);
  }

  // Add cold leads toggle if there are cold leads hidden
  if (coldCount > 0 && qualifiedLeads.length > 0) {
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "link-btn-subtle";
    toggle.id = "show-cold-toggle";
    toggle.textContent = `Show ${coldCount} cold lead${coldCount === 1 ? "" : "s"} (not matching)`;
    toggle.style.marginBottom = "8px";
    container.appendChild(toggle);
    toggle.addEventListener("click", () => {
      toggle.hidden = true;
      renderLeadCards(leads, container, true);
    });
  }

  getSavedLeads().then((saved) => {
    const savedKeys = new Set(saved.map(leadKey));
    renderLeadCards(visibleLeads, container, false, savedKeys, leads);

    // Next Steps CTA bar at the bottom
    const existingCta = document.getElementById("leads-next-steps");
    if (existingCta) existingCta.remove();
    if (leads.length > 0) {
      const cta = document.createElement("div");
      cta.id = "leads-next-steps";
      cta.className = "leads-next-steps";
      cta.innerHTML = `
        <div class="leads-next-label">Next steps →</div>
        <div class="leads-next-actions">
          ${hotCount > 0 ? `<button type="button" id="next-copy-hot" class="next-step-btn hot-step">📋 Copy All Hot DMs (${hotCount})</button>` : ""}
          <button type="button" id="next-export-csv" class="next-step-btn">⬇ Export CSV</button>
        </div>
      `;
      container.appendChild(cta);

      cta.querySelector("#next-export-csv")?.addEventListener("click", () => {
        document.getElementById("export-leads")?.click();
      });
      cta.querySelector("#next-copy-hot")?.addEventListener("click", () => {
        document.getElementById("copy-all-hot")?.click();
      });
    }
  });

  showView("view-leads-results");
}

function renderLeadCards(leadsToShow, container, appendMode = false, savedKeys = new Set(), allLeads = null) {
  if (!appendMode) {
    container.querySelectorAll(".lead-card").forEach((c) => c.remove());
  }
  const leads = allLeads || leadsToShow;

  leadsToShow.forEach((lead) => {
    const i = leads.indexOf(lead);
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
      ${lead.reason ? `<div class="lead-reason">💡 ${escapeHtml(lead.reason)}</div>` : ""}
      <details class="lead-dm-details">
        <summary class="lead-dm-label">💬 Personalized DM <span class="lead-dm-toggle">▾</span></summary>
        <div class="lead-dm">${escapeHtml(lead.dm || "")}</div>
      </details>
      <div class="lead-actions">
        <button type="button" class="copy-btn lead-copy" data-index="${i}">📋 Copy DM</button>
        ${lead.url ? `<button type="button" class="lead-view" data-url="${escapeHtml(lead.url)}">View Profile →</button>` : ""}
        <button type="button" class="lead-save${isSaved ? " saved" : ""}" data-index="${i}">${isSaved ? "★ Saved" : "☆ Save"}</button>
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
        const hotLeads = leads.filter(l => l.quality === "hot");
        const savedCount = container.querySelectorAll(".lead-save.saved").length;
        const hotTotal = hotLeads.length;
        const msg = hotTotal > 0
          ? `⭐ Saved! (${savedCount}/${hotTotal} hot leads saved)`
          : "⭐ Lead saved!";
        showToast(msg, "success");
        renderLeadCounter();
      }
    });
  });
}

// ── Lead search flow ─────────────────────────────────────────────────────────

async function qualifyAndShow(profiles, targetDescription, filters = null) {
  setLoading(
    `Found ${profiles.length} profile${profiles.length === 1 ? "" : "s"}, analyzing…`,
    "Qualifying leads with AI"
  );

  const searchStart = Date.now();
  const userId = await getUserId();
  const res = await fetch(API_URL_LEADS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, profiles, targetDescription, filters }),
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

  if (typeof data.leadSearchesRemaining === "number") {
    const limit = data.leadSearchLimit ?? (accountStatus?.lead_searches_limit ?? 5);
    const used = Math.max(0, limit - data.leadSearchesRemaining);
    const base = accountStatus || { isPro: false, feature_usage: {} };
    accountStatus = { ...base, lead_searches_limit: limit, lead_searches_remaining: data.leadSearchesRemaining, lead_searches_used: used };
    renderAccountStatus(accountStatus);
    showToast(`🔎 ${used}/${limit} searches used · ${data.leadSearchesRemaining} remaining`, "success");
    const pct = limit > 0 ? (used / limit) * 100 : 0;
    if (data.leadSearchesRemaining === 1) {
      setTimeout(() => showToast("⚠️ Last free lead search — upgrade for 50/month!", "default"), 3200);
    } else if (pct >= 80 && used === Math.ceil(limit * 0.8)) {
      setTimeout(() => showToast(`⚠️ ${data.leadSearchesRemaining} searches left — ready to upgrade?`, "default"), 3200);
    }
  }
  renderLeadCounter();

  // Search insights
  const elapsed = Math.round((Date.now() - searchStart) / 1000);
  const hotCount  = leads.filter((l) => l.quality === "hot").length;
  const warmCount = leads.filter((l) => l.quality === "warm").length;
  const coldCount = leads.filter((l) => l.quality === "cold").length;
  const insightsEl = document.getElementById("lead-insights");
  const breakdownEl = document.getElementById("lead-insights-breakdown");
  const timingEl = document.getElementById("lead-insights-timing");
  if (insightsEl && breakdownEl && timingEl) {
    const parts = [];
    if (hotCount)  parts.push(`🔥 ${hotCount} Hot`);
    if (warmCount) parts.push(`⚡ ${warmCount} Warm`);
    if (coldCount) parts.push(`❄️ ${coldCount} Cold`);
    breakdownEl.textContent = parts.join("  ·  ") || `${leads.length} leads`;
    timingEl.textContent = `⚡ ${elapsed}s`;
    insightsEl.hidden = false;
  }

  // Save to search history
  if (filters) {
    await saveSearchHistory(filters, leads.length, hotCount);
    renderSearchHistory();
  }

  const ts = Date.now();
  await persistLeadResults(leads, targetDescription);
  displayLeads(leads, { ts });
}

function buildLinkedInSearchUrl(filters) {
  const parts = [filters.title, filters.company, filters.keywords, filters.location].filter(Boolean);
  const keywords = parts.join(" ");
  const params = new URLSearchParams();
  if (keywords) params.set("keywords", keywords);
  if (filters.title) params.set("title", filters.title);
  return `https://www.linkedin.com/search/results/people/?${params.toString()}`;
}

function filtersToDescription(filters) {
  const parts = [];
  if (filters.title) parts.push(`Job Title: ${filters.title}`);
  if (filters.company) parts.push(`Company: ${filters.company}`);
  if (filters.location) parts.push(`Location: ${filters.location}`);
  if (filters.keywords) parts.push(`Keywords: ${filters.keywords}`);
  return parts.join("\n") || "(not specified)";
}

function buildNoResultsSuggestions(filters) {
  const tips = [];
  if (filters.keywords) tips.push(`Remove the "${filters.keywords}" keyword — it may be too specific`);
  if (filters.location) tips.push(`Try a broader location like a country instead of a city`);
  if (filters.title) tips.push(`Try a more general title (e.g. "Engineer" instead of "Senior Software Engineer")`);
  if (filters.company) tips.push(`Remove the company filter to search across all companies`);
  tips.push("Make sure you're logged into LinkedIn before searching");
  return tips;
}

async function runDeepLeadSearch(filters) {
  clearError("form-deep_lead_search");

  // Client-side pre-check: if we already know the limit is hit, show immediately
  if (
    accountStatus &&
    typeof accountStatus.lead_searches_remaining === "number" &&
    accountStatus.lead_searches_remaining <= 0
  ) {
    showLeadLimit();
    return;
  }

  showView("view-loading");
  setLoading("🔍 Searching LinkedIn…", "Opening results in a background tab");

  try {
    let profiles = [];
    let usedFilters = filters;

    // First attempt: full filters
    profiles = await autoSearchProfiles(buildLinkedInSearchUrl(filters));

    // If no results AND keywords were set, auto-retry without keywords (free — no credit consumed)
    if ((!profiles || profiles.length === 0) && filters.keywords) {
      setLoading("🔍 Broadening search…", "Trying without keyword filter");
      const broaderFilters = { ...filters, keywords: "" };
      profiles = await autoSearchProfiles(buildLinkedInSearchUrl(broaderFilters));
      if (profiles?.length > 0) {
        usedFilters = broaderFilters; // qualify against the broader set
      }
    }

    if (!profiles || profiles.length === 0) {
      const suggestions = buildNoResultsSuggestions(filters);
      // Show structured error using the lead search error element directly
      showView("view-deep_lead_search");
      renderLeadCounter();
      const container = document.getElementById("form-deep_lead_search");
      let err = container?.querySelector(".error-msg");
      if (!err && container) { err = document.createElement("div"); err.className = "error-msg"; container.prepend(err); }
      if (err) {
        err.innerHTML = `<strong>No profiles found for this search.</strong><br><br>Try these adjustments:<ol style="margin:6px 0 0 16px;padding:0">${suggestions.map(s => `<li style="margin-bottom:4px">${escapeHtml(s)}</li>`).join("")}</ol>`;
        err.hidden = false;
      }
      return;
    }

    const targetDescription = filtersToDescription(usedFilters);
    await qualifyAndShow(profiles, targetDescription, usedFilters);
  } catch (err) {
    showView("view-deep_lead_search");
    showError("form-deep_lead_search", err.message);
    renderLeadCounter();
  }
}

document.getElementById("form-deep_lead_search")?.addEventListener("submit", (e) => {
  e.preventDefault();
  clearError("form-deep_lead_search");
  const title = document.getElementById("filter-title")?.value.trim() || "";
  const company = document.getElementById("filter-company")?.value.trim() || "";
  const location = document.getElementById("filter-location")?.value.trim() || "";
  const keywords = document.getElementById("filter-keywords")?.value.trim() || "";

  if (!title && !company && !location && !keywords) {
    showError("form-deep_lead_search", "Enter at least one filter to search.");
    return;
  }

  runDeepLeadSearch({ title, company, location, keywords });
});

// "New Search" — clear persisted results and start fresh.
document.getElementById("back-to-search")?.addEventListener("click", async () => {
  await clearLeadResults();
  const insightsEl = document.getElementById("lead-insights");
  if (insightsEl) insightsEl.hidden = true;
  showView("view-deep_lead_search");
  renderLeadCounter();
  renderSearchHistory();
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

document.getElementById("export-leads")?.addEventListener("click", exportLeadsCSV);

function wireTemplateButtons() {
  document.querySelectorAll(".lead-template-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ""; };
      setVal("filter-title",    btn.dataset.title);
      setVal("filter-company",  btn.dataset.company);
      setVal("filter-location", btn.dataset.location);
      setVal("filter-keywords", btn.dataset.keywords);
      // Auto-submit
      document.getElementById("form-deep_lead_search")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
  });
}

async function openDeepLeadSearch() {
  renderLeadCounter();
  refreshAccountStatus();
  wireTemplateButtons();
  renderSearchHistory();
  const cached = await getLeadResults();
  if (cached?.leads?.length) {
    displayLeads(cached.leads, { ts: cached.ts });
  } else {
    showView("view-deep_lead_search");
  }
}

document.getElementById("lead-limit-back")?.addEventListener("click", () => showView("view-home"));
document.getElementById("lead-limit-upgrade")?.addEventListener("click", (e) => startUpgrade(e.currentTarget));

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
  const name = await getUserName();
  updateHeaderName(name);
  await refreshAccountStatus();
  renderSavedLeads();
})();
