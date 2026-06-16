import { config } from "../config.js";
import { getModelForPlan } from "../constants/plans.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const FEATURE_INSTRUCTIONS = {
  generate_post:
    "Write 3 distinct LinkedIn post drafts about the given topic. Each should be engaging, authentic, and suitable for a professional feed.",
  personalized_dm: `Write 3 distinct personalized LinkedIn connection or outreach DMs.

Rules:
- Use profileData from the input: greet by firstName when available, reference their headline, about, experience, or a recent post with a specific detail.
- Never use generic openers like "I came across your profile" or "I hope this finds you well" without a concrete hook.
- Each DM must feel human, concise (under 300 characters when possible), and clearly tied to something real from their profile.
- If topic/extra context is provided, weave it in naturally.
- Vary angle across the 3 options (shared interest, compliment on work, question about their focus).`,
  reply_comment:
    "Write 3 distinct thoughtful replies to the comment on LinkedIn. Keep them professional and conversational.",
  improve_headline:
    "Write 3 improved LinkedIn headline options that are clear, compelling, and keyword-aware.",
  viral_rewriter: `You are a viral LinkedIn ghostwriter. Transform the input post into ONE complete story-driven viral post.

THE VIRAL FORMULA — write ALL 6 sections, separated by blank lines:

1. CONFLICT HOOK (1 line): Personal conflict or shocking moment. "I almost got fired for this." / "Nobody warned me."
2. EMOTIONAL STAKES (2-3 lines): What was at risk? Show the human cost. Make readers think "I've been there."
3. TURNING POINT (1-2 lines): "But then something changed." "Here's what nobody tells you."
4. TRANSFORMATION + PROOF (3-5 lines): Before → After with real specifics. Numbers if possible.
5. INSIGHT / LESSON (3-5 lines as numbered list): 2-3 specific, actionable takeaways.
6. STRONG CTA (1-2 lines): Question that makes people want to comment. End with 2-3 hashtags.

RULES:
- Write the COMPLETE post — all 6 sections, ~800-1400 characters total
- Every section separated by a blank line
- NEVER start with "I" + boring statement. Open with tension or curiosity
- No corporate buzzwords. Real, human voice
- Completely different hook and angle from the original`,
};

function formatProfileForPrompt(profileData = {}) {
  const lines = [];
  if (profileData.name) lines.push(`Name: ${profileData.name}`);
  if (profileData.firstName) lines.push(`First name: ${profileData.firstName}`);
  if (profileData.headline) lines.push(`Headline: ${profileData.headline}`);
  if (profileData.about) lines.push(`About: ${profileData.about}`);
  if (profileData.experience?.length) {
    lines.push(`Experience:\n${profileData.experience.map((e) => `- ${e}`).join("\n")}`);
  }
  if (profileData.posts?.length) {
    lines.push(
      `Recent posts:\n${profileData.posts.map((p, i) => `${i + 1}. ${p}`).join("\n")}`
    );
  }
  if (profileData.url) lines.push(`Profile URL: ${profileData.url}`);
  return lines.join("\n");
}

function buildUserPrompt(feature, data, tone) {
  const toneLine = tone ? `Tone: ${tone}\n\n` : "";
  const { profileData, topic, ...rest } = data ?? {};

  if (feature === "personalized_dm" && profileData) {
    const profileBlock = formatProfileForPrompt(profileData);
    const contextLine = topic
      ? `\n\nSender's extra context / reason to connect:\n${topic}`
      : "";
    return `${toneLine}Target LinkedIn profile:\n${profileBlock}${contextLine}

Generate 3 DM options that reference specific details from this profile.`;
  }

  const payload = JSON.stringify(data ?? {}, null, 2);
  return `${toneLine}Feature: ${feature}\n\nInput data:\n${payload}`;
}

const MAX_LEAD_PROFILES = 25;

function buildFiltersBlock(filters) {
  if (!filters) return "";
  const lines = [];
  if (filters.title) lines.push(`- Job Title filter: "${filters.title}"`);
  if (filters.company) lines.push(`- Company filter: "${filters.company}"`);
  if (filters.location) lines.push(`- Location filter: "${filters.location}"`);
  if (filters.keywords) lines.push(`- Keywords filter: "${filters.keywords}"`);
  return lines.length ? lines.join("\n") : "";
}

/**
 * Qualify a batch of LinkedIn search-result profiles against the user's filters.
 * Returns [{ name, title, company, headline, quality, dm, reason }].
 */
export async function qualifyLeads({ profiles, targetDescription, filters, plan }) {
  const model = getModelForPlan(plan);

  // Strip profiles that have no usable data — they'll always be cold and waste tokens
  const rawList = (Array.isArray(profiles) ? profiles : []).slice(0, MAX_LEAD_PROFILES);
  const list = rawList.filter((p) => {
    const hasName = (p.name || "").trim().length > 1;
    const hasRole = (p.title || "").trim().length > 1 || (p.company || "").trim().length > 1;
    return hasName && hasRole;
  });

  const profilesForPrompt = list.map((p, i) => ({
    index: i,
    name: p.name || "",
    title: p.title || "",
    company: p.company || "",
    headline: p.headline || "",
    location: p.location || "",
  }));

  const filtersBlock = buildFiltersBlock(filters);

  const systemPrompt = `You are a B2B lead qualifier. Score each LinkedIn profile against the user's filters using FUZZY / SEMANTIC matching — not exact string matching.

${filtersBlock ? `USER'S FILTERS:\n${filtersBlock}` : ""}

MATCHING RULES (apply common sense, not exact text matching):

${filters?.title ? `TITLE FILTER "${filters.title}":
- HOT: profile's title contains the search term OR is a clear role synonym (e.g. "Developer" → matches "Software Engineer", "SDE", "Full Stack Dev", "Programmer", "Frontend Dev", "Backend Dev", "AI/ML Developer"; "CEO" → matches "Founder", "Co-Founder", "Managing Director"; "PM" → matches "Product Manager", "Product Lead")
- WARM: title is in the same broad role family but seniority/stack differs
- COLD: entirely different function (e.g. searching "Developer" → "HR Manager" is cold)` : ""}

${filters?.company ? `COMPANY FILTER "${filters.company}":
- HOT: profile's company name contains the search term OR the search term describes the company's industry/type (e.g. "AI" → matches any company with "AI", "ML", "artificial intelligence", "deeptech" in name OR if profile's headline mentions AI/ML work; "SaaS" → matches software/cloud/platform companies; "startup" → matches early-stage / Series A-B / founded companies)
- WARM: profile headline or about strongly suggests they work in that space even if company name doesn't match
- COLD: no connection whatsoever` : ""}

${filters?.location ? `LOCATION FILTER "${filters.location}":
- HOT/WARM boost: profile location contains the search term or nearby metro area
- A location mismatch alone does NOT make a profile cold if other filters match well` : ""}

${filters?.keywords ? `KEYWORDS "${filters.keywords}":
- Treat each word as a separate keyword; match in title, headline, company, or location
- Even one matching keyword is a positive signal` : ""}

SCORING:
- Title fuzzy-matches title filter: +2 pts
- Company fuzzy-matches company filter: +2 pts
- Any keyword found in title/headline/company: +1 pt
- Location matches: +1 pt

QUALITY:
- "hot"  = 3+ pts OR strong match on the most important filter
- "warm" = 1–2 pts OR partial / indirect match
- "cold" = 0 pts AND no plausible connection to any filter

For EACH profile return:
- "index": integer copied from input
- "quality": "hot", "warm", or "cold"
- "reason": 1 sentence (≤120 chars) — name the specific matched/unmatched signal, e.g. "Full Stack Dev at AI startup — matches Developer title and AI company 🔥"
- "dm": personalized LinkedIn DM (≤300 chars), greets by name, references their role/company, no generic openers

Respond with JSON only:
{"leads":[{"index":0,"quality":"hot","reason":"...","dm":"..."}]}
No markdown fences.`;

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openRouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://linkedin-ai-assistant.local",
      "X-Title": "ProPostly",
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `${targetDescription ? `Target description:\n${targetDescription}\n\n` : ""}Profiles to qualify:\n${JSON.stringify(profilesForPrompt, null, 2)}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const err = new Error(text || `OpenRouter request failed (${response.status})`);
    err.statusCode = response.status === 429 ? 429 : response.status >= 500 ? 502 : 400;
    throw err;
  }

  const body = await response.json();
  const content = body.choices?.[0]?.message?.content;
  if (!content) {
    const err = new Error("Empty response from OpenRouter");
    err.statusCode = 502;
    throw err;
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    const err = new Error("Failed to parse AI response as JSON");
    err.statusCode = 502;
    throw err;
  }

  const aiLeads = Array.isArray(parsed.leads) ? parsed.leads : [];
  const byIndex = new Map();
  for (const l of aiLeads) {
    if (typeof l?.index === "number") byIndex.set(l.index, l);
  }

  const validQuality = new Set(["hot", "warm", "cold"]);
  return list.map((p, i) => {
    const ai = byIndex.get(i) || {};
    const quality = validQuality.has(String(ai.quality).toLowerCase())
      ? String(ai.quality).toLowerCase()
      : "cold";
    return {
      name: p.name || "",
      title: p.title || "",
      company: p.company || "",
      headline: p.headline || "",
      location: p.location || "",
      url: p.url || "",
      quality,
      reason: String(ai.reason || "").trim(),
      dm: String(ai.dm || "").trim(),
    };
  });
}

const VIRAL_MIN_LENGTH = 400; // chars — below this the post is definitely truncated

async function callOpenRouter({ model, feature, systemInstruction, userPrompt }) {
  const isViral = feature === "viral_rewriter";
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openRouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://linkedin-ai-assistant.local",
      "X-Title": "ProPostly",
    },
    body: JSON.stringify({
      model,
      temperature: isViral ? 0.9 : 0.8,
      max_tokens: isViral ? 1500 : 1200,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: isViral
            ? `${systemInstruction}

CRITICAL OUTPUT RULES:
- Respond with JSON only: {"variations":["<your complete viral post>"]}
- The array contains ONE string — the full viral post
- That string MUST include ALL 6 sections (hook, stakes, turning point, transformation, lessons, CTA)
- Minimum length: 600 characters. If your response is under 600 chars you have failed
- Do NOT write 2 or 3 variations. ONE post only. No markdown fences.`
            : `${systemInstruction}

Respond with JSON only, in this exact shape:
{"variations":["variation 1","variation 2","variation 3"]}

Each variation must be a complete, ready-to-use string. No markdown fences.`,
        },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const err = new Error(text || `OpenRouter request failed (${response.status})`);
    err.statusCode = response.status === 429 ? 429 : response.status >= 500 ? 502 : 400;
    throw err;
  }

  const body = await response.json();
  const content = body.choices?.[0]?.message?.content;
  if (!content) {
    const err = new Error("Empty response from OpenRouter");
    err.statusCode = 502;
    throw err;
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    const err = new Error("Failed to parse AI response as JSON");
    err.statusCode = 502;
    throw err;
  }

  const variations = parsed.variations ?? parsed.options ?? parsed.choices;
  if (!Array.isArray(variations) || variations.length < 1) {
    const err = new Error("AI response missing variations array");
    err.statusCode = 502;
    throw err;
  }

  let strings = variations
    .slice(0, 3)
    .map((v) => String(v).trim())
    .filter(Boolean);

  // Always surface the longest variation first (handles model returning 3 short ones)
  if (isViral && strings.length > 1) {
    strings = [...strings].sort((a, b) => b.length - a.length);
  }

  while (strings.length < 3 && strings.length > 0) {
    strings.push(strings[strings.length - 1]);
  }

  return strings;
}

const RETRY_DELAY_MS = [0, 1500, 3000]; // backoff per attempt (0-indexed)

export async function generateVariations({ feature, data, tone, plan }) {
  const model = getModelForPlan(plan);
  const systemInstruction =
    FEATURE_INSTRUCTIONS[feature] ||
    "Generate 3 distinct professional LinkedIn text variations for the request.";
  const userPrompt = buildUserPrompt(feature, data, tone);

  const isViral = feature === "viral_rewriter";
  // All features get 2 attempts on transient 5xx; viral gets 3 for length validation too
  const MAX_ATTEMPTS = isViral ? 3 : 2;

  let strings = [];
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // Exponential backoff — wait before retrying (skip on first attempt)
    if (attempt > 1) {
      const delay = RETRY_DELAY_MS[attempt - 1] ?? 3000;
      await new Promise((r) => setTimeout(r, delay));
    }

    try {
      strings = await callOpenRouter({ model, feature, systemInstruction, userPrompt });

      // For viral: validate the best result is long enough to be a complete post
      if (isViral) {
        const best = strings[0] ?? "";
        if (best.length >= VIRAL_MIN_LENGTH) break; // good — stop retrying
        // Too short — treat as a soft failure and retry
        lastError = new Error(`Viral post too short (${best.length} chars) — retrying`);
        console.warn(`[viral_rewriter] attempt ${attempt}: best variation ${best.length} chars < ${VIRAL_MIN_LENGTH}, retrying`);
        strings = []; // clear so we don't return the short version
      } else {
        break;
      }
    } catch (err) {
      lastError = err;
      // Retry on transient server errors (5xx / 429) only
      const isTransient = err.statusCode === 502 || err.statusCode === 429 || err.statusCode >= 500;
      if (!isTransient || attempt === MAX_ATTEMPTS) throw err;
      console.warn(`[${feature}] attempt ${attempt} failed (${err.statusCode}): ${err.message} — retrying`);
    }
  }

  if (strings.length === 0) {
    // All retries exhausted — throw the last error
    throw lastError ?? new Error("No valid variations in AI response");
  }

  return strings.slice(0, 3);
}
