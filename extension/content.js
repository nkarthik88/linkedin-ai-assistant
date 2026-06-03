// Guard against re-injection (extension reload into an already-injected tab)
if (window.__propostlyInjected) {
  // Already running — skip re-declaration to avoid SyntaxError on let/const
} else {
window.__propostlyInjected = true;

function getText(el) {
  return el?.textContent?.replace(/\s+/g, " ").trim() || "";
}

function isLinkedInProfilePage() {
  return /linkedin\.com\/in\/[^/?#]+/i.test(window.location.href);
}

function queryFirst(selectors, root = document) {
  for (const sel of selectors) {
    const el = root.querySelector(sel);
    if (el) return el;
  }
  return null;
}

function queryAllText(selectors, limit = 5, root = document) {
  for (const sel of selectors) {
    const nodes = root.querySelectorAll(sel);
    if (nodes.length) {
      return Array.from(nodes)
        .slice(0, limit)
        .map((n) => getText(n))
        .filter(Boolean);
    }
  }
  return [];
}

function findSectionByAnchorId(anchorId) {
  const anchor = document.getElementById(anchorId);
  if (!anchor) return null;
  return (
    anchor.closest("section") ||
    anchor.closest('[data-view-name*="profile"]') ||
    anchor.parentElement?.parentElement
  );
}

function findSectionByHeading(...labels) {
  const headings = document.querySelectorAll("h2, h3, span.visually-hidden");
  for (const heading of headings) {
    const text = getText(heading).toLowerCase();
    if (labels.some((label) => text === label.toLowerCase() || text.includes(label.toLowerCase()))) {
      return heading.closest("section") || heading.closest(".artdeco-card");
    }
  }
  return null;
}

function extractFromOgMeta() {
  const ogTitle = document.querySelector('meta[property="og:title"]')?.content || "";
  const ogDescription =
    document.querySelector('meta[property="og:description"]')?.content || "";

  let name = "";
  let headline = "";

  const titleMatch = ogTitle.match(/^(.+?)\s*[-–|]\s*(.+?)(?:\s*[-–|]\s*LinkedIn)?$/i);
  if (titleMatch) {
    name = titleMatch[1].trim();
    headline = titleMatch[2].replace(/\s*on\s+LinkedIn.*$/i, "").trim();
  } else if (ogTitle) {
    name = ogTitle.replace(/\s*on\s+LinkedIn.*$/i, "").trim();
  }

  return { name, headline, about: ogDescription };
}

function extractName() {
  const el = queryFirst([
    "main h1.text-heading-xlarge",
    "h1.text-heading-xlarge.inline",
    "h1.text-heading-xlarge",
    ".pv-text-details__left-panel h1",
    ".ph5 h1",
    'section[data-view-name="profile-card"] h1',
    'div[data-view-name="profile-card"] h1',
    "main section h1",
    "main h1",
    "h1", // broadest fallback
  ]);
  const name = getText(el);
  // Reject strings that are clearly not a person's name
  if (name && name.length < 80 && !/^\d+$/.test(name)) return name;
  // OG meta fallback
  const og = document.querySelector('meta[property="og:title"]')?.content || "";
  const m = og.match(/^([^|–\-]+)/);
  return m ? m[1].replace(/\s*on\s+LinkedIn.*$/i, "").trim() : "";
}

function extractHeadline() {
  const HEADLINE_SELECTORS = [
    ".text-body-medium.break-words",
    ".pv-text-details__left-panel .text-body-medium",
    ".ph5 .text-body-medium",
    '[data-field="headline"]',
    ".pv-top-card--experience-list-item span",
  ];

  const topCard = queryFirst([
    ".pv-top-card",
    '[data-view-name="profile-top-card"]',
    '[data-view-name="profile-card"]',
    "main .ph5",
    "main section.artdeco-card",
  ]);

  // Search within topCard first; fall back to full document if not found there
  let el = topCard ? queryFirst(HEADLINE_SELECTORS, topCard) : null;
  if (!el) el = queryFirst(HEADLINE_SELECTORS, document);

  const text = getText(el);
  if (text && text.length <= 300) return text;

  // OG meta fallback — often contains "Name | Headline | LinkedIn"
  const og = document.querySelector('meta[property="og:title"]')?.content || "";
  const parts = og.split(/\s*[|–\-]\s*/);
  if (parts.length >= 2) {
    const candidate = parts[1].replace(/\s*LinkedIn.*$/i, "").trim();
    if (candidate.length > 3 && candidate.length <= 300) return candidate;
  }
  return "";
}

function extractAbout() {
  const section =
    findSectionByAnchorId("about") || findSectionByHeading("About");

  if (section) {
    const textEl = queryFirst(
      [
        ".inline-show-more-text span[aria-hidden='true']",
        ".inline-show-more-text",
        ".pv-shared-text-with-see-more span[aria-hidden='true']",
        ".display-flex.full-width span[aria-hidden='true']",
        ".break-words span[aria-hidden='true']",
      ],
      section
    );
    const about = getText(textEl);
    if (about) return about;

    const sectionText = getText(section);
    const cleaned = sectionText
      .replace(/^about\s*/i, "")
      .replace(/\s*…?\s*see more\s*$/i, "")
      .trim();
    if (cleaned.length > 20) return cleaned.slice(0, 2000);
  }

  return "";
}

function extractExperience(limit = 4) {
  const section =
    findSectionByAnchorId("experience") ||
    findSectionByHeading("Experience");

  if (!section) return [];

  const items = section.querySelectorAll(
    "li.pvs-list__paged-list-item, li.artdeco-list__item, ul > li"
  );

  const experiences = [];

  for (const item of items) {
    if (experiences.length >= limit) break;

    const spans = item.querySelectorAll(
      "span[aria-hidden='true'], .t-bold span, .mr1 span[aria-hidden='true']"
    );
    const parts = Array.from(spans)
      .map((s) => getText(s))
      .filter(Boolean);

    const unique = [...new Set(parts)];
    if (unique.length === 0) continue;

    const entry = unique.slice(0, 3).join(" · ");
    if (entry.length > 5 && !experiences.includes(entry)) {
      experiences.push(entry);
    }
  }

  return experiences;
}

function extractRecentPosts(limit = 3) {
  const activitySection =
    findSectionByHeading("Activity", "Recent activity") ||
    document.querySelector('[data-view-name="profile-component-activity"]');

  const roots = [activitySection, document].filter(Boolean);
  const postSelectors = [
    ".feed-shared-update-v2__description .break-words",
    ".feed-shared-inline-show-more-text span[aria-hidden='true']",
    ".update-components-text span[aria-hidden='true']",
    ".feed-shared-text-view span[aria-hidden='true']",
    ".profile-creator-shared-feed-update__description span[aria-hidden='true']",
    ".break-words span[aria-hidden='true']",
  ];

  for (const root of roots) {
    const posts = queryAllText(postSelectors, limit, root);
    if (posts.length) return posts;
  }

  return [];
}

function extractProfilePhoto() {
  const img = queryFirst([
    "img.pv-top-card-profile-picture__image--show",
    "img.pv-top-card-profile-picture__image",
    ".profile-photo-edit__preview",
    ".pv-top-card__photo img",
    "main section img.EntityPhoto-circle-9",
    "main .pv-top-card img[src*='profile-displayphoto']",
    "main img[src*='licdn.com'][width='200']",
    "main img[src*='licdn.com'][width='400']",
  ]);
  return img?.src || "";
}

function extractLocation() {
  const el = queryFirst([
    ".pv-text-details__left-panel span.text-body-small.inline.t-black--light.break-words",
    ".pv-top-card--list .pv-top-card--list-bullet li",
    "main .text-body-small.t-black--light.break-words",
  ]);
  const text = getText(el);
  if (text && text.length < 80 && !text.toLowerCase().includes("contact")) return text;
  return "";
}

function extractProfileData() {
  const meta = extractFromOgMeta();
  const name = extractName() || meta.name;
  const headline = extractHeadline() || meta.headline;
  const about = extractAbout() || meta.about;
  const experience = extractExperience();
  const posts = extractRecentPosts();
  const firstName = name.split(/\s+/)[0] || "";
  const photo = extractProfilePhoto();
  const location = extractLocation();

  return {
    name,
    firstName,
    headline,
    about,
    experience,
    posts,
    photo,
    location,
    url: window.location.href,
    isProfilePage: isLinkedInProfilePage(),
  };
}

let cachedProfile = null;
let cacheUrl = "";

function getProfileData() {
  if (!isLinkedInProfilePage()) {
    return {
      ...extractProfileData(),
      isProfilePage: false,
    };
  }

  if (cachedProfile && cacheUrl === window.location.href) {
    return cachedProfile;
  }

  const data = extractProfileData();
  if (data.name || data.headline || data.about) {
    cachedProfile = data;
    cacheUrl = window.location.href;
  }
  return data;
}

function refreshProfileCache() {
  cachedProfile = null;
  cacheUrl = "";
  return getProfileData();
}

let profileObserver = null;

function watchProfilePage() {
  if (!isLinkedInProfilePage() || profileObserver) return;

  profileObserver = new MutationObserver(() => {
    const data = extractProfileData();
    if (data.name || data.headline) {
      cachedProfile = data;
      cacheUrl = window.location.href;
    }
  });

  profileObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

watchProfilePage();

// ── Find Leads: read profiles from a people search results page ──────────────

function isLinkedInSearchPage() {
  return /linkedin\.com\/search\/results\/(people|all)/i.test(window.location.href);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Scroll the search page to trigger LinkedIn's lazy loading until the profile
 * count stabilises (or we time out), then return extracted profiles. Used by
 * the background-tab auto-search so the popup gets a full result set.
 */
async function autoScrapeSearch(maxMs = 12000, debug = false) {
  const start = Date.now();
  let lastCount = 0;
  let stablePasses = 0;
  let passes = 0;
  let maxAnchors = 0;

  // Skip scroll in hidden/background tabs — scrolling a hidden tab causes Chrome
  // to bring it to the foreground, stealing focus from the extension popup.
  const isBackground = document.visibilityState === "hidden";

  while (Date.now() - start < maxMs) {
    if (!isBackground) {
      window.scrollTo(0, document.body.scrollHeight);
    }
    await sleep(750);
    const count = document.querySelectorAll('a[href*="/in/"]').length;
    maxAnchors = Math.max(maxAnchors, count);
    passes += 1;
    if (debug) {
      console.log(`[ProPostly][auto] pass ${passes}: ${count} profile anchors`);
    }
    if (count > 0 && count === lastCount) {
      stablePasses += 1;
      if (stablePasses >= 2) break;
    } else {
      stablePasses = 0;
    }
    lastCount = count;
  }

  if (!isBackground) window.scrollTo(0, 0);
  await sleep(200);
  const profiles = extractSearchProfiles();
  const diag = {
    url: window.location.href,
    isSearch: isLinkedInSearchPage(),
    visibility: document.visibilityState,
    passes,
    maxAnchors,
    finalAnchors: document.querySelectorAll('a[href*="/in/"]').length,
    extracted: profiles.length,
  };
  if (debug) console.log("[ProPostly][auto] done", diag);
  return { profiles, diag };
}

function cleanName(raw) {
  return getText({ textContent: raw })
    .replace(/^status is (reachable|offline)\s*/i, "")
    .replace(/\s*•.*$/, "") // strip "• 1st" degree badges
    .replace(/\s*\b(1st|2nd|3rd)\b\s*degree connection.*$/i, "")
    .replace(/\s*view .*?profile.*$/i, "")
    .trim();
}

const NOISE_ROW =
  /^(1st|2nd|3rd|connect|message|follow|following|pending)$|degree connection|view .*?profile|status is (reachable|offline)|\bfollowers?\b|mutual connection/i;

/**
 * Split a LinkedIn headline into job title + company.
 * Handles "CEO at TechCorp", "Founder & CEO @ TechCorp", and pipe/bullet
 * separated headlines like "Helping founders | CEO at TechCorp | SaaS".
 */
function splitTitleCompany(headline) {
  if (!headline) return { title: "", company: "" };
  const segments = headline.split(/\s*[|•·–—]\s*/).filter(Boolean);

  for (const seg of segments) {
    const m = seg.match(/^(.*?\S)\s+(?:at|@)\s+(.+)$/i);
    if (m && m[2].trim()) {
      return { title: m[1].trim(), company: m[2].trim() };
    }
  }
  // No "at"/"@" — treat the most descriptive segment as the title.
  return { title: (segments[0] || headline).trim(), company: "" };
}

/**
 * Collect the visible text rows inside a result card (headline, location, etc.)
 * in DOM order, skipping the name, action buttons, and connection-degree noise.
 * This is the resilient fallback when LinkedIn's named subtitle classes change.
 */
function collectInfoRows(container, name) {
  const candidates = container.querySelectorAll(
    ".entity-result__primary-subtitle, .entity-result__secondary-subtitle, " +
      '.t-14, .t-12, [class*="subtitle"], [class*="summary"], p'
  );

  const rows = [];
  const seen = new Set();
  for (const el of candidates) {
    // Skip the title block (contains the profile link / the name itself).
    if (el.querySelector && el.querySelector('a[href*="/in/"]')) continue;
    const txt = getText(el);
    if (!txt || txt.length < 2 || txt.length > 220) continue;
    if (name && txt === name) continue;
    if (NOISE_ROW.test(txt)) continue;
    if (seen.has(txt)) continue;
    seen.add(txt);
    rows.push(txt);
  }
  return rows;
}

function looksLikeLocation(text) {
  if (!text) return false;
  if (/\b(at|@)\b/i.test(text)) return false; // that's a headline
  // Locations are short and often "City, Region, Country" or a known area.
  return (
    /,/.test(text) ||
    /\b(area|region|county|district|greater)\b/i.test(text) ||
    text.split(/\s+/).length <= 4
  );
}

function extractSearchProfiles(limit = 25) {
  const seen = new Set();
  const results = [];

  let containers = Array.from(
    document.querySelectorAll(
      [
        "li.reusable-search__result-container",
        "div[data-chameleon-result-urn]",
        "li.org-people-profile-card__profile-card-spacing",
        "div.entity-result",
        "div.search-results-container ul > li",
        'ul[role="list"] > li',
        "li.artdeco-list__item",
      ].join(", ")
    )
  );

  // Fallback: derive containers from profile links if known classes are absent.
  if (!containers.length) {
    document.querySelectorAll('a[href*="/in/"]').forEach((a) => {
      const c =
        a.closest("li") ||
        a.closest("div[data-chameleon-result-urn]") ||
        a.closest("div");
      if (c && !containers.includes(c)) containers.push(c);
    });
  }

  for (const c of containers) {
    if (results.length >= limit) break;

    const link = c.querySelector('a[href*="/in/"]');
    if (!link) continue;

    const href = (link.getAttribute("href") || "").split("?")[0];
    if (!href || !/\/in\/[^/]+/.test(href) || seen.has(href)) continue;

    const name = cleanName(
      getText(link.querySelector('span[aria-hidden="true"]')) ||
        getText(c.querySelector('.entity-result__title-text span[aria-hidden="true"]')) ||
        getText(c.querySelector('.entity-result__title-text a')) ||
        getText(link)
    );
    if (!name || name.length < 2 || /^linkedin member$/i.test(name)) continue;

    // 1) Try LinkedIn's named subtitle classes (across DOM versions).
    let headline =
      getText(c.querySelector(".entity-result__primary-subtitle")) ||
      getText(c.querySelector("div.t-14.t-black.t-normal")) ||
      "";
    let location =
      getText(c.querySelector(".entity-result__secondary-subtitle")) ||
      getText(c.querySelector("div.t-14.t-normal.t-black--light")) ||
      "";

    // 2) Fallback: positional text rows when class names have changed.
    if (!headline || !location) {
      const rows = collectInfoRows(c, name);
      if (!headline) headline = rows[0] || "";
      if (!location) {
        location =
          rows.find((r) => r !== headline && looksLikeLocation(r)) ||
          rows.find((r) => r !== headline) ||
          "";
      }
    }

    const { title, company } = splitTitleCompany(headline);

    seen.add(href);
    results.push({
      name,
      title,
      company,
      headline,
      location,
      url: href.startsWith("http") ? href : `https://www.linkedin.com${href}`,
    });
  }

  return results;
}

// Cache the last user selection — clicking the toolbar icon clears window.getSelection()
// before the side panel can read it, so we must capture it proactively.
let lastSelectedText = "";

document.addEventListener("selectionchange", () => {
  const sel = window.getSelection()?.toString()?.trim() || "";
  if (sel.length > 5) lastSelectedText = sel;
});

// Selectors for LinkedIn's Quill comment/reply editor (contenteditable divs)
const COMMENT_BOX_SELECTORS = [
  '.comments-comment-box__form .ql-editor[contenteditable="true"]',
  '.comments-reply-box .ql-editor[contenteditable="true"]',
  '.feed-shared-update-v2__comments-container .ql-editor[contenteditable="true"]',
  'div.ql-editor[contenteditable="true"]',
  'div[contenteditable="true"][data-placeholder*="omment"]',
  'div[contenteditable="true"][data-placeholder*="eply"]',
  'div[contenteditable="true"][aria-label*="omment"]',
  'div[contenteditable="true"][aria-label*="eply"]',
];

function findCommentBox() {
  // Prefer whichever contenteditable box is already focused inside a comment area
  const active = document.activeElement;
  if (active && active.contentEditable === "true") {
    const inCommentArea = active.closest(
      ".comments-comment-box, .comments-reply-box, .feed-shared-update-v2__comments-container, .comments-comment-texteditor"
    );
    if (inCommentArea) return active;
  }

  for (const sel of COMMENT_BOX_SELECTORS) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

// Selectors for reading existing comment text (not the input box, the comment body)
const COMMENT_TEXT_SELECTORS = [
  ".comments-comment__main-content",
  ".feed-shared-comment__main-content",
  ".comments-comment-item__main-content",
  ".social-details-social-activity .comments-comment__main-content",
  "article .comments-comment__main-content",
  ".comment__main-content",
];

function findNearestCommentText() {
  // Strategy 1: if a reply box is open, find the comment it belongs to
  const replyBox = findCommentBox();
  if (replyBox) {
    const container = replyBox.closest(
      ".comments-comment-item, .comments-reply-item, " +
      ".feed-shared-update-v2__comments-container, " +
      ".social-details-social-activity"
    );
    if (container) {
      for (const sel of COMMENT_TEXT_SELECTORS) {
        const textEl = container.querySelector(sel);
        const text = textEl?.textContent?.trim();
        if (text && text.length > 5) return text;
      }
    }
  }

  // Strategy 2: first comment visible inside the viewport
  for (const sel of COMMENT_TEXT_SELECTORS) {
    const els = document.querySelectorAll(sel);
    for (const el of els) {
      const rect = el.getBoundingClientRect();
      if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
        const text = el.textContent?.trim();
        if (text && text.length > 5) return text;
      }
    }
  }

  // Strategy 3: first comment anywhere on page
  for (const sel of COMMENT_TEXT_SELECTORS) {
    const el = document.querySelector(sel);
    const text = el?.textContent?.trim();
    if (text && text.length > 5) return text;
  }

  return null;
}

// Prevent double-registration when re-injected into an already-open tab
if (window.__propostly_registered) {
  // Already running — just reset the profile cache so fresh data is read
  cachedProfile = null;
  cacheUrl = "";
} else {
  window.__propostly_registered = true;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "FILL_COMMENT_REPLY") {
    try {
      const box = findCommentBox();
      if (!box) {
        sendResponse({
          success: false,
          error:
            "No comment box found. Click the Reply button under the LinkedIn comment first, then try again.",
        });
        return true;
      }

      box.focus();
      // Select all existing text and replace with the reply
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, message.text);
      box.scrollIntoView({ behavior: "smooth", block: "center" });

      sendResponse({ success: true });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
    return true;
  }

  if (message.type === "FILL_POST_BOX") {
    (async () => {
      try {
        const COMMENT_AREA = ".comments-comment-box, .comments-reply-box, .comments-comment-texteditor";

        const findEditor = () => {
          // Specific selectors first
          const specific = [
            '.share-creation-state__text-editor [contenteditable="true"]',
            '.editor-content [contenteditable="true"]',
            '.share-box [contenteditable="true"]',
            '.share-creation-state [contenteditable="true"]',
            'div.ql-editor[contenteditable="true"]',
            'div[role="textbox"][contenteditable="true"]',
          ];
          for (const sel of specific) {
            const el = document.querySelector(sel);
            if (el && !el.closest(COMMENT_AREA)) return el;
          }

          // Broad fallback: any visible contenteditable not in a comment area
          for (const el of document.querySelectorAll('div[contenteditable="true"]')) {
            if (el.closest(COMMENT_AREA)) continue;
            const r = el.getBoundingClientRect();
            if (r.width > 100 && r.height > 30) return el;
          }
          return null;
        };

        let editor = findEditor();

        // Post box not open — click "Start a post" to open it
        if (!editor) {
          const startBtn = document.querySelector(
            '.share-box-feed-entry__trigger, ' +
            'button[aria-label="Start a post"], ' +
            '.share-box-feed-entry__top-bar, ' +
            '[data-control-name="share.sharebox_trigger"]'
          );
          if (startBtn) {
            startBtn.click();
          } else {
            sendResponse({
              success: false,
              error: "Click 'Start a post' at the top of your LinkedIn feed first, then try again.",
            });
            return;
          }

          // Poll until the editor appears (up to 3 seconds)
          for (let i = 0; i < 12; i++) {
            await new Promise((r) => setTimeout(r, 250));
            editor = findEditor();
            if (editor) break;
          }
        }

        if (!editor) {
          sendResponse({
            success: false,
            error: "LinkedIn post box didn't open. Try clicking 'Start a post' on LinkedIn first.",
          });
          return;
        }

        // Focus and give React a moment to register it
        editor.focus();
        editor.click();
        await new Promise((r) => setTimeout(r, 100));
        document.execCommand("selectAll", false, null);
        document.execCommand("insertText", false, message.text);
        // Dispatch input event so React/LinkedIn picks up the change
        editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
        editor.scrollIntoView({ behavior: "smooth", block: "center" });
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.type === "GET_SELECTED_TEXT") {
    try {
      // Priority 1: live selection
      const live = window.getSelection()?.toString()?.trim() || "";
      if (live.length > 5) {
        sendResponse({ success: true, text: live });
        return true;
      }

      // Priority 2: cached selection (captured before toolbar click cleared it)
      if (lastSelectedText.length > 5) {
        const text = lastSelectedText;
        lastSelectedText = "";
        sendResponse({ success: true, text });
        return true;
      }

      // Priority 3: smart page scan — no selection required
      const nearest = findNearestCommentText();
      if (nearest) {
        sendResponse({ success: true, text: nearest });
        return true;
      }

      sendResponse({
        success: false,
        error: "No comments visible. Click the comment count (e.g. '12 comments') under the post to expand them, then try again.",
      });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
    return true;
  }

  if (message.type === "PING") {
    sendResponse({ success: true, isProfilePage: isLinkedInProfilePage() });
    return true;
  }

  if (message.type === "GET_SEARCH_PROFILES") {
    try {
      if (!isLinkedInSearchPage()) {
        sendResponse({
          success: false,
          error:
            "Open a LinkedIn people search results page (linkedin.com/search/results/people) in this tab.",
        });
        return true;
      }

      const profiles = extractSearchProfiles();
      if (!profiles.length) {
        sendResponse({
          success: false,
          error:
            "No profiles found on this page. Scroll down to load results, then try again.",
        });
        return true;
      }

      sendResponse({ success: true, profiles });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
    return true;
  }

  if (message.type === "AUTO_SCRAPE") {
    if (!isLinkedInSearchPage()) {
      sendResponse({
        success: false,
        error: "Not a search results page yet.",
        diag: { url: window.location.href, isSearch: false },
      });
      return true;
    }
    autoScrapeSearch(12000, message.debug)
      .then(({ profiles, diag }) =>
        sendResponse({ success: profiles.length > 0, profiles, diag })
      )
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // async response
  }

  if (message.type === "GET_PROFILE_DATA") {
    (async () => {
      try {
        // LinkedIn is a React SPA — retry with increasing delays so DOM can settle
        const DELAYS = [0, 1200, 2500];

        for (let attempt = 0; attempt < DELAYS.length; attempt++) {
          if (DELAYS[attempt] > 0) {
            await new Promise((r) => setTimeout(r, DELAYS[attempt]));
          }

          // Force-clear cache on each attempt
          cachedProfile = null;
          cacheUrl = "";

          const profileData = extractProfileData();

          if (!profileData.isProfilePage && !message.allowAnyPage) {
            sendResponse({
              success: false,
              error: "Open a LinkedIn profile page (linkedin.com/in/username) in this tab.",
              profileData,
            });
            return;
          }

          if (profileData.name || profileData.headline || profileData.about) {
            cachedProfile = profileData;
            cacheUrl = window.location.href;
            sendResponse({ success: true, profileData });
            return;
          }
        }

        // All 3 attempts failed — return partial data so the DM form still opens
        const partial = extractProfileData();
        sendResponse({
          success: false,
          error: "Could not read profile details automatically.",
          profileData: partial,
        });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // keep message channel open for async response
  }
});

} // end __propostlyInjected guard
