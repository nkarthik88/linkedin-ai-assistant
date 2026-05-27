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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "PING") {
    sendResponse({ success: true, isProfilePage: isLinkedInProfilePage() });
    return true;
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
