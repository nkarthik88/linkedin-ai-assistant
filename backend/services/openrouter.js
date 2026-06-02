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
  const list = (Array.isArray(profiles) ? profiles : []).slice(0, MAX_LEAD_PROFILES);

  const profilesForPrompt = list.map((p, i) => ({
    index: i,
    name: p.name || "",
    title: p.title || "",
    company: p.company || "",
    headline: p.headline || "",
    location: p.location || "",
  }));

  const filtersBlock = buildFiltersBlock(filters);

  const systemPrompt = `You are a B2B lead qualifier. The user has entered SPECIFIC search filters for their ideal customer. Your job is to score each LinkedIn profile STRICTLY against those filters.

${filtersBlock ? `USER'S EXACT FILTERS:\n${filtersBlock}\n\nCRITICAL RULES:` : "TARGET DESCRIPTION RULES:"}
${filters?.company ? `- If company filter is "${filters.company}": ONLY rate as hot/warm profiles WHERE the person works AT that company or a company with that exact name. "CEO at Google" when searching for "${filters.company}" → COLD.` : ""}
${filters?.title ? `- If title filter is "${filters.title}": ONLY rate as hot/warm profiles with that job title or very close variant (e.g. "CEO" matches "Co-Founder & CEO" but NOT "Marketing Manager").` : ""}
${filters?.location ? `- If location filter is "${filters.location}": prefer profiles in that location; non-matching location alone makes warm→cold.` : ""}
${filters?.keywords ? `- Keywords "${filters.keywords}": profile's title, headline, or company must contain at least one of these keywords to be hot/warm.` : ""}

SCORING (be strict — if a filter doesn't match, downgrade):
- Title matches title filter: +2 pts
- Company matches company filter: +2 pts
- Headline/title contains keyword(s): +1 pt
- Location matches location filter: +1 pt

QUALITY ASSIGNMENT:
- "hot"  = 3+ pts AND matches at least one primary filter (title or company) exactly
- "warm" = 2 pts OR partial primary filter match (close but not exact)
- "cold" = <2 pts OR primary filter clearly doesn't match

For EACH profile return:
- "index": integer copied from input
- "quality": "hot", "warm", or "cold"
- "reason": 1 sentence (max 120 chars) explaining WHY — reference their actual title/company and which filters matched/didn't, e.g. "Founder at n8n — matches both company and automation keywords 🔥" or "CEO at Google — doesn't match n8n company filter ❄️"
- "dm": personalized LinkedIn DM (under 300 chars), names the person, references their specific role/company, no generic openers

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
    err.statusCode = response.status >= 500 ? 502 : 400;
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

export async function generateVariations({ feature, data, tone, plan }) {
  const model = getModelForPlan(plan);
  const systemInstruction =
    FEATURE_INSTRUCTIONS[feature] ||
    "Generate 3 distinct professional LinkedIn text variations for the request.";

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
      temperature: feature === "viral_rewriter" ? 0.9 : 0.8,
      max_tokens: feature === "viral_rewriter" ? 700 : 1200,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${systemInstruction}

Respond with JSON only, in this exact shape:
{"variations":["variation 1","variation 2","variation 3"]}

Each variation must be a complete, ready-to-use string. No markdown fences.`,
        },
        {
          role: "user",
          content: buildUserPrompt(feature, data, tone),
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const err = new Error(
      text || `OpenRouter request failed (${response.status})`
    );
    err.statusCode = response.status >= 500 ? 502 : 400;
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

  const strings = variations
    .slice(0, 3)
    .map((v) => String(v).trim())
    .filter(Boolean);

  while (strings.length < 3 && strings.length > 0) {
    strings.push(strings[strings.length - 1]);
  }

  if (strings.length === 0) {
    const err = new Error("No valid variations in AI response");
    err.statusCode = 502;
    throw err;
  }

  return strings.slice(0, 3);
}
