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
    "main section h1",
    "main h1",
  ]);
  return getText(el);
}

function extractHeadline() {
  const topCard = queryFirst([
    "main section.artdeco-card",
    ".pv-top-card",
    '[data-view-name="profile-top-card"]',
    "main .ph5",
  ]);

  const el = queryFirst(
    [
      ".text-body-medium.break-words",
      "div.text-body-medium",
      ".pv-text-details__left-panel .text-body-medium",
      ".ph5 .text-body-medium",
    ],
    topCard || document
  );

  const text = getText(el);
  if (!text || text.length > 300) return "";
  return text;
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

function extractProfileData() {
  const meta = extractFromOgMeta();
  const name = extractName() || meta.name;
  const headline = extractHeadline() || meta.headline;
  const about = extractAbout() || meta.about;
  const experience = extractExperience();
  const posts = extractRecentPosts();
  const firstName = name.split(/\s+/)[0] || "";

  return {
    name,
    firstName,
    headline,
    about,
    experience,
    posts,
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

  while (Date.now() - start < maxMs) {
    window.scrollTo(0, document.body.scrollHeight);
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

  window.scrollTo(0, 0);
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
  // Prefer whichever comment box is already focused
  const active = document.activeElement;
  if (
    active &&
    active.contentEditable === "true" &&
    active.getAttribute("role") !== "textbox" === false || active.tagName !== "INPUT"
  ) {
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
    try {
      const profileData =
        message.refresh === true ? refreshProfileCache() : getProfileData();

      if (!profileData.isProfilePage) {
        sendResponse({
          success: false,
          error:
            "Open a LinkedIn profile page (linkedin.com/in/username) in this tab.",
          profileData,
        });
        return true;
      }

      if (!profileData.name && !profileData.headline && !profileData.about) {
        sendResponse({
          success: false,
          error:
            "Could not read profile details. Scroll the profile page, wait for it to load, then try again.",
          profileData,
        });
        return true;
      }

      sendResponse({ success: true, profileData });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
    return true;
  }
});
