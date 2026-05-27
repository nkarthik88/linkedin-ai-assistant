const API_BASE = "https://linkedin-ai-backend-rho.vercel.app";
const API_URL = `${API_BASE}/api/generate`;

let accountStatus = null;

const FEATURE_LABELS = {
  generate_post: "Post options",
  personalized_dm: "DM options",
  reply_comment: "Reply options",
  improve_headline: "Headline options",
  viral_rewriter: "Rewritten posts",
};

let lastFeature = null;

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

async function getUserId() {
  const { userId } = await chrome.storage.local.get("userId");
  if (userId) return userId;
  const newId = crypto.randomUUID();
  await chrome.storage.local.set({ userId: newId });
  return newId;
}

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
  tierEl.textContent = status?.tierLabel || (isPro ? "Pro Tier" : "Free Tier");
  tierEl.classList.toggle("pro", isPro);

  if (isPro) {
    usageEl.textContent = status?.message || "Unlimited uses";
    upgradeBtn.hidden = true;
  } else {
    usageEl.textContent =
      status?.message ||
      `${status?.remaining ?? 0} uses remaining this month`;
    upgradeBtn.hidden = false;
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
  if (usageEl) usageEl.textContent = "Loading usage…";

  try {
    const status = await fetchAccountStatus();
    renderAccountStatus(status);
    await chrome.storage.local.set({ isPro: Boolean(status.isPro) });
    return status;
  } catch (err) {
    if (tierEl) tierEl.textContent = "Free Tier";
    if (usageEl) usageEl.textContent = "Usage unavailable";
    setUpgradeError(err.message);
    return null;
  }
}

async function startUpgrade() {
  const upgradeBtn = document.getElementById("upgrade-btn");
  if (!upgradeBtn || upgradeBtn.disabled) return;

  setUpgradeError("");
  upgradeBtn.disabled = true;
  const previousText = upgradeBtn.textContent;
  upgradeBtn.textContent = "Opening checkout…";

  try {
    const userId = await getUserId();
    if (!userId || typeof userId !== "string") {
      throw new Error("Could not identify your account. Reload the extension and try again.");
    }

    let customerEmail = "";
    try {
      const stored = await chrome.storage.local.get("upgradeEmail");
      customerEmail = stored.upgradeEmail || "";
    } catch {
      /* optional */
    }

    if (!customerEmail) {
      const prompted = window.prompt(
        "Enter your email for the receipt (required by payment provider):",
        ""
      );
      if (prompted && prompted.includes("@")) {
        customerEmail = prompted.trim();
        await chrome.storage.local.set({ upgradeEmail: customerEmail });
      }
    }

    const locale =
      (typeof navigator !== "undefined" && navigator.language) || "";
    const india =
      locale.toUpperCase().endsWith("-IN") ||
      locale.toUpperCase() === "IN" ||
      Intl.DateTimeFormat().resolvedOptions().timeZone === "Asia/Kolkata";

    const res = await fetch(`${API_BASE}/api/payments/upgrade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: String(userId),
        user_id: String(userId),
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
    if (!checkoutUrl) {
      throw new Error("No checkout URL returned from server.");
    }

    await chrome.storage.local.set({ pendingUpgrade: true });
    chrome.windows.create({ url: checkoutUrl, type: "popup", width: 480, height: 720 });

    upgradeBtn.textContent = "Complete payment, then reopen extension";
  } catch (err) {
    setUpgradeError(err.message);
    upgradeBtn.textContent = previousText;
  } finally {
    upgradeBtn.disabled = false;
  }
}

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
      ? `<span style="display:block;margin-top:4px"><strong>Recent posts:</strong> ${escapeHtml(posts[0].slice(0, 100))}${posts[0].length > 100 ? "…" : ""}</span>`
      : "";

  el.innerHTML = `
    <strong>Profile detected</strong>
    ${name ? `<div>${escapeHtml(name)}</div>` : ""}
    ${headline ? `<span>${escapeHtml(headline)}</span>` : ""}
    ${about ? `<span style="display:block;margin-top:4px">${escapeHtml(about.slice(0, 160))}${about.length > 160 ? "…" : ""}</span>` : ""}
    ${experienceHtml}
    ${postsHtml}
  `;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function callApi(body) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      text || `API error (${res.status}). Check your connection and try again.`
    );
  }

  const data = await res.json();
  const options = data.options ?? data.results ?? data.choices ?? data.variations;
  if (!Array.isArray(options) || options.length === 0) {
    throw new Error("No options returned from the API.");
  }

  if (typeof data.remainingCredits === "number" && accountStatus && !accountStatus.isPro) {
    renderAccountStatus({
      ...accountStatus,
      remaining: data.remainingCredits,
      usedThisMonth: accountStatus.limit - data.remainingCredits,
    });
  }

  return options.slice(0, 3);
}

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
      setTimeout(() => {
        btn.textContent = "Copy";
        btn.classList.remove("copied");
      }, 2000);
    });
  });

  showView("view-results");
}

async function runGeneration(feature, buildBody) {
  showView("view-loading");
  try {
    const userId = await getUserId();
    const body = await buildBody(userId);
    const options = await callApi({ feature, userId, ...body });
    displayResults(feature, options);
  } catch (err) {
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

async function runPersonalizedDmGeneration() {
  clearError("form-personalized_dm");
  await runGeneration("personalized_dm", async (userId) => {
    const profileData = await getProfileDataFromPage({ refresh: true });
    renderProfilePreview("profile-preview-dm", profileData);
    const dmContext = document.getElementById("dm-context")?.value.trim();
    return {
      userId,
      profileData,
      topic: dmContext || undefined,
    };
  });
}

document.querySelectorAll(".feature-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const feature = btn.dataset.feature;
    clearError(`form-${feature}`);

    if (feature === "personalized_dm") {
      showView("view-loading");
      try {
        const profileData = await getProfileDataFromPage({ refresh: true });
        renderProfilePreview("profile-preview-dm", profileData);
        await runGeneration("personalized_dm", async (userId) => {
          const dmContext = document.getElementById("dm-context")?.value.trim();
          return {
            userId,
            profileData,
            topic: dmContext || undefined,
          };
        });
      } catch (err) {
        showView("view-personalized_dm");
        const el = document.getElementById("profile-preview-dm");
        if (el) {
          el.hidden = false;
          el.innerHTML = `<strong>Note</strong><span>${escapeHtml(err.message)}</span>`;
        }
        showError("form-personalized_dm", err.message);
      }
      return;
    }

    showView(`view-${feature}`);

    if (feature === "improve_headline") {
      try {
        const profileData = await getProfileDataFromPage();
        renderProfilePreview("profile-preview-headline", profileData);
        const input = document.getElementById("headline-input");
        if (profileData.headline && !input.value) {
          input.value = profileData.headline;
        }
      } catch (err) {
        const el = document.getElementById("profile-preview-headline");
        if (el) {
          el.hidden = false;
          el.innerHTML = `<strong>Note</strong><span>${escapeHtml(err.message)}</span>`;
        }
      }
    }
  });
});

document.querySelectorAll("[data-back]").forEach((btn) => {
  btn.addEventListener("click", () => showView("view-home"));
});

document.querySelector("[data-back-home]")?.addEventListener("click", () => {
  showView("view-home");
});

document.getElementById("form-generate_post")?.addEventListener("submit", (e) => {
  e.preventDefault();
  clearError("form-generate_post");
  const topic = document.getElementById("topic").value.trim();
  if (!topic) return;
  runGeneration("generate_post", async (userId) => ({ userId, topic }));
});

document.getElementById("form-personalized_dm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  runPersonalizedDmGeneration();
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
  runGeneration("viral_rewriter", async (userId) => ({
    userId,
    draftPost,
  }));
});

document.getElementById("upgrade-btn")?.addEventListener("click", () => {
  startUpgrade();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    refreshAccountStatus();
  }
});

window.addEventListener("focus", () => {
  refreshAccountStatus();
});

refreshAccountStatus();
