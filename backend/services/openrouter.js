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
  viral_rewriter:
    "Rewrite the draft post into 3 distinct viral-style LinkedIn post variations while keeping the core message.",
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

/**
 * Qualify a batch of LinkedIn search-result profiles against the user's ideal
 * customer and draft a personalized opening DM for each.
 * Returns [{ name, title, company, headline, quality, dm, reason }].
 */
export async function qualifyLeads({ profiles, targetDescription, plan }) {
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
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are an expert B2B sales prospecting assistant. The user describes their ideal customer, and you receive a list of LinkedIn profiles from a search results page (with job title, company, headline, and location).

For EACH profile, judge how well it matches the ideal customer and return:
- "index": the profile's index (integer, copied from input)
- "quality": one of "hot", "warm", "cold"
    • "hot"  = clearly matches the target (role AND industry/company fit)
    • "warm" = partial match (right role OR right space, but not both, or seniority is close)
    • "cold" = unlikely to match the target
- "reason": one short sentence (max 120 chars) that explicitly ties the rating to the user's target, e.g. "Matches your target — B2B SaaS founder at a product company." Reference their actual title/company.
- "dm": a personalized LinkedIn outreach DM (under 300 chars) that names the person and references their SPECIFIC role and company. No generic openers like "I came across your profile". Make it feel hand-written. Even for cold leads, write a polite, relevant DM.

If a profile has no title/company, infer from the headline and rate conservatively (usually warm/cold), and say so in the reason.

Respond with JSON only, in this exact shape:
{"leads":[{"index":0,"quality":"hot","reason":"...","dm":"..."}]}

Return one object per input profile, preserving the index. No markdown fences.`,
        },
        {
          role: "user",
          content: `Ideal customer / target description:
${targetDescription || "(not specified — infer a reasonable B2B target)"}

Profiles:
${JSON.stringify(profilesForPrompt, null, 2)}`,
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
      temperature: 0.8,
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
