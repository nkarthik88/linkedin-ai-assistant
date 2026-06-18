import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { config } from "../config.js";
import { getModelForPlan } from "../constants/plans.js";
import { consumeRedditFeatureCredit, logFunnelEvent } from "../services/usage.js";

const router = Router();

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REDDIT_MODEL = "google/gemini-2.5-flash-lite";

const HUMAN_REDDIT_RULES = `Write like a real person texting a friend who happens to be on Reddit. Casual, direct, imperfect. Use contractions (it's, don't, can't, I've). Take a clear stance — never be neutral. Admit a mistake or struggle somewhere in the post. Vulnerability earns karma. No sales pitches, no community contribution theater. Just a real person sharing something real.`;

const HUMAN_WRITING_RULES = `
HUMAN WRITING RULES — apply to every post without exception:
1. Vary sentence length aggressively. Short punch. Then a longer sentence with real detail and context. Short again.
2. Use contractions everywhere: it's, don't, can't, I've, you're, that's, wasn't, didn't.
3. Be opinionated. Take a stance and defend it. "This approach is wrong and here's why" beats "there are pros and cons."
4. Include one genuine struggle, mistake, or moment of vulnerability. "I wasted two weeks on this before realising the obvious thing."
5. Use emotional, subjective words: annoying, honestly, weird, refreshing, surprisingly, genuinely, frustrated, relieved, confused, baffled.
6. Add natural self-corrections: "Actually wait, that's not quite right —" or "scratch that, the real issue was..."
7. Use commas, not em-dashes. Em-dashes are a known AI writing tell.
8. Keep paragraphs to 2-3 sentences maximum. Hard cap: 200 words total for the body.
9. End every post with a simple, genuine question or request for advice. Make it easy to reply — one sentence, not a list of questions.
10. Peer voice only: sharing experience as an equal, never an expert presenting findings to an audience.`;

const BANNED_WORDS = `
BANNED WORDS — never use these under any circumstances, rewrite the sentence if needed:
unleash, comprehensive, game-changer, game changer, delve, navigating, in conclusion, to summarize,
revolutionary, leverage, synergy, guaranteed, life-changing, secrets, holistic, robust, scalable,
Click here, Act now, Exclusive, groundbreaking, cutting-edge, disruptive, innovative, transformative,
landscape, pivotal, testament, Moreover, Furthermore, Additionally, It is important, It is worth noting,
10x, supercharge, streamline, 100% free, best price, Wait until you see, I'm excited to share,
as an AI, I cannot, I'd be happy to, Certainly, Absolutely, Of course`;

const SELF_REVIEW = `
SELF-REVIEW PASS — check every post before finalizing:
1. Promotional tone? Rewrite completely. The post must deliver value even if the reader ignores whatever is being promoted.
2. Any em-dashes? Replace every single one with a comma or period.
3. Any banned words? Replace them with plain language.
4. Any neutral, fence-sitting language? Pick a side.
5. Is there a moment of struggle or vulnerability? If not, add one.
6. Does it end with a genuine single question? If not, add one.
7. Over 200 words in the body? Cut until it's under.
8. Would a real Redditor actually post this without editing? If no, rewrite.`;

async function callOpenRouter(model, systemPrompt, userPrompt, jsonMode = true) {
  const body = {
    model,
    temperature: 0.85,
    max_tokens: 2500,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  };
  if (jsonMode) body.response_format = { type: "json_object" };

  const r = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openRouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://api.propostly.com",
      "X-Title": "ProPostly",
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    const err = new Error(txt || `OpenRouter error ${r.status}`);
    err.statusCode = r.status >= 500 ? 502 : 400;
    throw err;
  }

  const data = await r.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    const err = new Error("Empty response from OpenRouter");
    err.statusCode = 502;
    throw err;
  }
  return content;
}

function safeParseJSON(content) {
  // Strip markdown code fences
  let cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  // Try direct parse first
  try { return JSON.parse(cleaned); } catch {}
  // Extract first {...} block from anywhere in the response
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  throw new Error("No JSON found in response");
}

function validateUserId(req, res) {
  const userId = String(req.body?.userId || "").trim();
  if (!userId || !UUID_RE.test(userId)) {
    res.status(400).json({ error: "Valid userId is required" });
    return null;
  }
  return userId;
}

/* ─── POST /api/reddit/generate ─────────────────────── */
router.post(
  "/generate",
  asyncHandler(async (req, res) => {
    const userId = validateUserId(req, res);
    if (!userId) return;

    const { topic, subreddit, tone, template, isPromoting, analysisContext } = req.body;
    if (!topic) return res.status(400).json({ error: "topic is required" });

    const model = REDDIT_MODEL;

    const TEMPLATE_FORMATS = {
      Lesson:   'FORMAT — Lesson: Start with "I spent [time] on [topic]." then contrast what you expected vs what actually happened. End with the key takeaway.',
      Question: 'FORMAT — Question: "I\'ve been working on [topic] and genuinely confused by [specific aspect]. Has anyone found a better way?" Invite real community input.',
      Counter:  'FORMAT — Counter: "Everyone says [common belief]. I tried the opposite for [duration]. Here\'s what actually happened." Be specific about results, not vague.',
      Win:      'FORMAT — Win: "I finally solved [specific problem] by doing [one specific thing]. Here\'s exactly what I changed." Ground it in specifics, keep it humble.',
      Resource: 'FORMAT — Resource: Brief intro sentence, then 3-5 numbered points about [topic] with real context for each. End with honest reflection, not a CTA.',
    };

    const templateSection = template && TEMPLATE_FORMATS[template]
      ? `\n${TEMPLATE_FORMATS[template]}\n`
      : '';

    const promoSection = isPromoting
      ? `\nPROMOTION FRAMING (utility-first bridge): The author is promoting something. Frame as personal story or lesson first. Mention the product/service LAST and briefly, as one natural sentence in a longer post. The post must deliver genuine value even if the reader ignores the promotion entirely. Structure: problem you faced → what you tried → what worked → (one brief mention of the tool/service as what helped). Never sound like an ad.\n`
      : '';

    const communitySection = analysisContext
      ? `\nCOMMUNITY ANALYSIS for ${analysisContext.subreddit || subreddit}:
What this community likes: ${(analysisContext.likes || []).join(', ')}
What to avoid: ${(analysisContext.avoid || []).join(', ')}
Community tone: ${analysisContext.tone || ''}
Key rules: ${(analysisContext.rules || []).join(' • ')}
${analysisContext.summary || ''}
IMPORTANT: Match this community's exact writing style and preferences above all else.\n`
      : '';

    const systemPrompt = `You are a Reddit ghostwriter. Generate 3 distinct Reddit post options. Each must read like it was written by a real person, not polished content.
${communitySection}
${HUMAN_WRITING_RULES}
${BANNED_WORDS}
${promoSection}${templateSection}
Each post must have a TITLE and a BODY (max 200 words). Also score anti-ban risk (0-100) for each:
- 0-30: Safe (human voice, genuine value, no promo feel)
- 31-60: Risky (borderline promotional or AI-sounding)
- 61-100: Do not post (promotional, spammy, or AI-generated)
${SELF_REVIEW}
Respond with JSON only:
{"posts":[{"title":"...","body":"...","antiBanScore":15},{"title":"...","body":"...","antiBanScore":22},{"title":"...","body":"...","antiBanScore":35}]}`;

    const userPrompt = `Topic: ${topic}
${subreddit ? `Target subreddit: ${subreddit}` : ""}
${tone && !template ? `Tone: ${tone}` : ""}

Generate 3 Reddit posts.`;

    const content = await callOpenRouter(model, systemPrompt, userPrompt);
    let parsed;
    try { parsed = safeParseJSON(content); } catch {
      return res.status(502).json({ error: "Failed to parse AI response" });
    }

    const posts = (parsed.posts || []).slice(0, 3).map((p) => ({
      title: String(p.title || "").trim(),
      body: String(p.body || "").trim(),
      antiBanScore: Math.min(100, Math.max(0, parseInt(p.antiBanScore) || 0)),
    }));

    if (!posts.length || !posts[0].title) {
      return res.status(502).json({ error: "AI returned no posts — please try again" });
    }

    // Consume credit only after we have real results
    const creditResult = await consumeRedditFeatureCredit(userId, "reddit_post");
    logFunnelEvent({ userId, event: "feature_used", feature: "reddit_post", plan: creditResult.plan, meta: { remaining: creditResult.featureRemaining } }).catch(() => {});
    if (creditResult.featureRemaining === 0) logFunnelEvent({ userId, event: "limit_hit", feature: "reddit_post", plan: creditResult.plan }).catch(() => {});
    res.json({
      posts,
      featureUsed: creditResult.featureUsed,
      featureLimit: creditResult.featureLimit,
      featureRemaining: creditResult.featureRemaining,
    });
  })
);

/* ─── POST /api/reddit/analyze-community ─────────────── */
router.post(
  "/analyze-community",
  asyncHandler(async (req, res) => {
    const userId = validateUserId(req, res);
    if (!userId) return;

    const { subreddit, topPosts, rules } = req.body;
    if (!subreddit) return res.status(400).json({ error: "subreddit is required" });
    if (!Array.isArray(topPosts) || topPosts.length === 0) {
      return res.status(400).json({ error: "topPosts array is required" });
    }

    const model = REDDIT_MODEL;

    const systemPrompt = `You are a Reddit community analyst. Analyze top posts from a subreddit and identify writing patterns that get upvotes.

Respond with JSON only:
{
  "likes": ["3-5 specific content types or styles this community upvotes"],
  "avoid": ["3-5 specific things that get downvoted or removed here"],
  "tone": "one sentence describing how members actually write in this community",
  "rules": ["up to 4 key community rules relevant to content creation"],
  "summary": "2 sentences: how to write a post that succeeds in this specific community"
}`;

    const userPrompt = `Subreddit: ${subreddit}

Top posts this month (title | upvotes):
${topPosts.slice(0, 25).map((p) => `- "${p.title}" (${p.score} upvotes)`).join("\n")}

Sidebar rules:
${rules || "Not available"}

Analyze the writing patterns, content types, and community preferences.`;

    const content = await callOpenRouter(model, systemPrompt, userPrompt);
    let parsed;
    try { parsed = safeParseJSON(content); } catch {
      return res.status(502).json({ error: "Failed to parse AI response" });
    }

    res.json({
      likes:   Array.isArray(parsed.likes)  ? parsed.likes.slice(0, 5)  : [],
      avoid:   Array.isArray(parsed.avoid)  ? parsed.avoid.slice(0, 5)  : [],
      tone:    String(parsed.tone   || "").trim(),
      rules:   Array.isArray(parsed.rules)  ? parsed.rules.slice(0, 4)  : [],
      summary: String(parsed.summary || "").trim(),
    });
  })
);

/* ─── POST /api/reddit/from-url ──────────────────────── */
router.post(
  "/from-url",
  asyncHandler(async (req, res) => {
    const userId = validateUserId(req, res);
    if (!userId) return;

    const { url, subreddit } = req.body;
    if (!url) return res.status(400).json({ error: "url is required" });

    // Validate URL
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return res.status(400).json({ error: "Only HTTP/HTTPS URLs are supported" });
      }
    } catch {
      return res.status(400).json({ error: "Invalid URL" });
    }

    // Fetch URL content server-side
    let urlContent = "";
    try {
      const response = await fetch(parsedUrl.href, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(10000),
        redirect: "follow",
      });
      if (!response.ok) {
        return res.status(400).json({ error: `Could not fetch URL (HTTP ${response.status})` });
      }
      const html = await response.text();
      urlContent = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<nav[\s\S]*?<\/nav>/gi, "")
        .replace(/<footer[\s\S]*?<\/footer>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 4000);
    } catch (err) {
      return res.status(400).json({ error: "Could not fetch URL: " + (err.message || "timeout") });
    }

    if (!urlContent || urlContent.length < 50) {
      return res.status(400).json({ error: "Could not extract enough content from that URL" });
    }

    const model = REDDIT_MODEL;

    const systemPrompt = `You are a Reddit ghostwriter. Transform website or product content into 3 authentic Reddit posts (max 200 words each) that read like they were written by a real person, not a marketer.
${HUMAN_WRITING_RULES}
${BANNED_WORDS}

CRITICAL FRAMING RULE — the post must NEVER read like an advertisement. Pick exactly one frame:
1. Personal experience: "I was struggling with X, tried Y, here's what actually happened."
2. Lesson learned: "Spent 3 weeks on X. Honest results below."
3. Community question: "Working on X, hit Y problem. How do you all deal with this?"

Structure: Problem → struggle/journey → what they discovered → (if promoting: ONE natural sentence at the very end, never in the opening)
The post must be worth reading even if the reader ignores whatever is being promoted.
${subreddit ? `\nWriting for ${subreddit}. Match that community's exact tone and style.` : ""}
${SELF_REVIEW}
Respond with JSON only:
{"posts":[{"title":"...","body":"...","antiBanScore":15},{"title":"...","body":"...","antiBanScore":22},{"title":"...","body":"...","antiBanScore":35}]}`;

    const userPrompt = `Extract the core value from this content and write 3 Reddit posts:\n\n${urlContent}`;

    const content = await callOpenRouter(model, systemPrompt, userPrompt);
    let parsed;
    try { parsed = safeParseJSON(content); } catch {
      return res.status(502).json({ error: "Failed to parse AI response" });
    }

    const posts = (parsed.posts || []).slice(0, 3).map((p) => ({
      title: String(p.title || "").trim(),
      body:  String(p.body  || "").trim(),
      antiBanScore: Math.min(100, Math.max(0, parseInt(p.antiBanScore) || 0)),
    }));

    if (!posts.length || !posts[0].title) {
      return res.status(502).json({ error: "AI returned no posts — please try again" });
    }

    const creditResult = await consumeRedditFeatureCredit(userId, "reddit_post");
    logFunnelEvent({ userId, event: "feature_used", feature: "reddit_post", plan: creditResult.plan, meta: { remaining: creditResult.featureRemaining } }).catch(() => {});
    if (creditResult.featureRemaining === 0) logFunnelEvent({ userId, event: "limit_hit", feature: "reddit_post", plan: creditResult.plan }).catch(() => {});
    res.json({
      posts,
      featureUsed: creditResult.featureUsed,
      featureLimit: creditResult.featureLimit,
      featureRemaining: creditResult.featureRemaining,
    });
  })
);

/* ─── POST /api/reddit/reply ─────────────────────────── */
router.post(
  "/reply",
  asyncHandler(async (req, res) => {
    const userId = validateUserId(req, res);
    if (!userId) return;

    const { commentText, postContext, persona = "mentor" } = req.body;
    if (!commentText) return res.status(400).json({ error: "commentText is required" });

    const model = REDDIT_MODEL;

    const personaInstructions = {
      mentor: `Reply as a helpful, experienced community member who explains concepts clearly and adds real value. Sound like a knowledgeable peer, not a teacher or marketer. Share what you know from experience. Helpful, warm, genuinely useful.`,
      witty: `Reply with humor and relatability. Short punchy lines. Make them smile. Sound like the funny-but-smart person everyone loves in Reddit comments. Humor first, never offensive, always leaves a good feeling.`,
      curious: `Reply with genuine curiosity. Ask deep follow-up questions that make the original poster feel their point is interesting and worth expanding on. Questions that keep the conversation going get the most upvotes. Sound fascinated, not interrogative.`,
    };

    const personaStyle = personaInstructions[persona] || personaInstructions.mentor;

    const systemPrompt = `You are a Reddit reply writer. Generate exactly 3 replies to a Reddit comment.

${HUMAN_REDDIT_RULES}

PERSONA MODE — apply this to all 3 replies:
${personaStyle}

${HUMAN_WRITING_RULES}

${BANNED_WORDS}

All 3 replies must match the persona style above. No promotional language. No AI writing patterns.

Respond with JSON only:
{"variations":["reply 1","reply 2","reply 3"]}`;

    const userPrompt = `${postContext ? `Post context: ${postContext}\n\n` : ""}Comment to reply to: ${commentText}`;

    const content = await callOpenRouter(model, systemPrompt, userPrompt);
    let parsed;
    try { parsed = safeParseJSON(content); } catch {
      return res.status(502).json({ error: "Failed to parse AI response" });
    }

    const variations = (parsed.variations || []).slice(0, 3).map((v) => String(v).trim()).filter(Boolean);
    if (!variations.length) {
      return res.status(502).json({ error: "AI returned no replies — please try again" });
    }
    while (variations.length < 3) {
      variations.push(variations[variations.length - 1]);
    }

    const creditResult = await consumeRedditFeatureCredit(userId, "reddit_reply");
    logFunnelEvent({ userId, event: "feature_used", feature: "reddit_reply", plan: creditResult.plan, meta: { remaining: creditResult.featureRemaining } }).catch(() => {});
    if (creditResult.featureRemaining === 0) logFunnelEvent({ userId, event: "limit_hit", feature: "reddit_reply", plan: creditResult.plan }).catch(() => {});
    res.json({
      variations,
      featureUsed: creditResult.featureUsed,
      featureLimit: creditResult.featureLimit,
      featureRemaining: creditResult.featureRemaining,
    });
  })
);

/* ─── POST /api/reddit/subreddits ────────────────────── */
router.post(
  "/subreddits",
  asyncHandler(async (req, res) => {
    const userId = validateUserId(req, res);
    if (!userId) return;

    const { niche } = req.body;
    if (!niche) return res.status(400).json({ error: "niche is required" });

    const model = REDDIT_MODEL;

    const systemPrompt = `You are a Reddit strategy expert. Suggest 10-15 real subreddits for a given niche.

For each subreddit provide:
- name: exact subreddit name with r/ prefix
- members: estimated member count as string (e.g. "500K members")
- promoAllowed: "YES", "NO", or "Rules" (check if self-promotion is typically allowed)
- bestTime: best day/time to post (e.g. "Tuesday 9am EST")
- vibe: one word — "technical", "casual", "startup", "creative", "supportive", etc.

Respond with JSON only:
{"subreddits":[{"name":"r/example","members":"100K members","promoAllowed":"Rules","bestTime":"Monday 10am EST","vibe":"startup"}]}`;

    const userPrompt = `Find the best subreddits for this niche:\n${niche}`;

    const content = await callOpenRouter(model, systemPrompt, userPrompt);
    let parsed;
    try { parsed = safeParseJSON(content); } catch {
      return res.status(502).json({ error: "Failed to parse AI response" });
    }

    const subreddits = (parsed.subreddits || []).slice(0, 15).map((s) => ({
      name: String(s.name || "").trim(),
      members: String(s.members || "").trim(),
      promoAllowed: ["YES", "NO", "Rules"].includes(s.promoAllowed) ? s.promoAllowed : "Rules",
      bestTime: String(s.bestTime || "").trim(),
      vibe: String(s.vibe || "").trim(),
    })).filter((s) => s.name);

    if (!subreddits.length) {
      return res.status(502).json({ error: "AI returned no subreddits — please try again" });
    }

    const creditResult = await consumeRedditFeatureCredit(userId, "reddit_subreddit");
    logFunnelEvent({ userId, event: "feature_used", feature: "reddit_subreddit", plan: creditResult.plan, meta: { remaining: creditResult.featureRemaining } }).catch(() => {});
    if (creditResult.featureRemaining === 0) logFunnelEvent({ userId, event: "limit_hit", feature: "reddit_subreddit", plan: creditResult.plan }).catch(() => {});
    res.json({
      subreddits,
      featureUsed: creditResult.featureUsed,
      featureLimit: creditResult.featureLimit,
      featureRemaining: creditResult.featureRemaining,
    });
  })
);

/* ─── POST /api/reddit/score ─────────────────────────── */
// Score is a free quality check — runs automatically on all generated posts, never charged
router.post(
  "/score",
  asyncHandler(async (req, res) => {
    const userId = validateUserId(req, res);
    if (!userId) return;

    const { postTitle, postBody } = req.body;
    if (!postTitle || !postBody) {
      return res.status(400).json({ error: "postTitle and postBody are required" });
    }

    const model = REDDIT_MODEL;

    const systemPrompt = `You are a Reddit anti-spam expert. Score a Reddit post for ban risk (0-100).

SCORING:
- 0-30: Safe ✅ (sounds human, adds value, no promo feel)
- 31-60: Risky ⚠️ (borderline, might get flagged)
- 61-100: Don't post ⛔ (too promotional, spammy, or AI-generated)

Return specific warnings for anything that raises the score. For each warning include:
- label: short name of the issue (e.g. "Title sounds promotional")
- fix: one specific fix suggestion

Respond with JSON only:
{"score":25,"warnings":[{"label":"Contains spam triggers","fix":"Remove the phrase 'check this out' from the title"}]}`;

    const userPrompt = `Post title: ${postTitle}\n\nPost body:\n${postBody}`;

    const content = await callOpenRouter(model, systemPrompt, userPrompt);
    let parsed;
    try { parsed = safeParseJSON(content); } catch {
      return res.status(502).json({ error: "Failed to parse AI response" });
    }

    const score = Math.min(100, Math.max(0, parseInt(parsed.score) || 0));
    const warnings = (parsed.warnings || []).map((w) => ({
      label: String(w.label || "").trim(),
      fix: String(w.fix || "").trim(),
    }));

    res.json({ score, warnings });
  })
);

/* ─── POST /api/reddit/viral ─────────────────────────── */
router.post(
  "/viral",
  asyncHandler(async (req, res) => {
    const userId = validateUserId(req, res);
    if (!userId) return;
    // Viral rewrite is a free refinement of already-generated content — no credit consumed

    const { draft, subreddit } = req.body;
    if (!draft) return res.status(400).json({ error: "draft is required" });

    const model = REDDIT_MODEL;

    const systemPrompt = `You are a Reddit viral ghostwriter. Transform the draft into ONE viral Reddit post${subreddit ? ` specifically for ${subreddit}` : ""}.${subreddit ? ` Follow that subreddit's culture and norms exactly.` : ""}

${HUMAN_REDDIT_RULES}
${BANNED_WORDS}

THE REDDIT VIRAL FORMULA — write ALL 5 sections, separated by blank lines:

1. HOOK (1 line): Surprising statement, a relatable screw-up, or a specific number. Makes people stop scrolling.
2. CONFLICT (2-3 lines): What went wrong, what was hard, what did you struggle with? Be specific and vulnerable.
3. INSIGHT (2-3 lines): The key realization or lesson. State it directly and with an opinion.
4. PROOF (2-3 lines): Specific result, before/after, or real detail. Vague claims get ignored.
5. CTA (1 sentence): One genuine question that invites replies. Not a list. No marketing tone.

HARD RULES:
- Use contractions throughout (it's, don't, wasn't, I've, can't)
- Short paragraphs — 2-3 sentences max per section
- Total body under 200 words
- Sounds like a real person, not a content creator
- NO buzzwords, NO "I'm excited to share", NO corporate tone
- Anti-ban score must be under 30

Respond with JSON only:
{"post":"your complete viral post here"}`;

    const userPrompt = `Transform this draft into a viral Reddit post:\n\n${draft}`;

    const content = await callOpenRouter(model, systemPrompt, userPrompt);
    let parsed;
    try { parsed = safeParseJSON(content); } catch {
      return res.status(502).json({ error: "Failed to parse AI response" });
    }

    res.json({ post: String(parsed.post || "").trim() });
  })
);

export default router;
