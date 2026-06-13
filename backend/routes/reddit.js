import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { config } from "../config.js";
import { getModelForPlan } from "../constants/plans.js";

const router = Router();

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const HUMAN_REDDIT_RULES = `Write using casual conversational Reddit language. Use short paragraphs. Natural friendly tone. Minor imperfections ok. Variable sentence lengths. NO marketing jargon. NO promotional buzzwords. NO polished sales copy. Add genuine value first.`;

async function callOpenRouter(model, systemPrompt, userPrompt, jsonMode = true) {
  const body = {
    model,
    temperature: 0.85,
    max_tokens: 1200,
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

    const { topic, subreddit, tone } = req.body;
    if (!topic) return res.status(400).json({ error: "topic is required" });

    const model = getModelForPlan("free"); // Upgrade path can be added later

    const systemPrompt = `You are a Reddit ghostwriter. Generate 3 distinct Reddit post options.

${HUMAN_REDDIT_RULES}

Each post must have a TITLE and a BODY. After generating, also provide an anti-ban score (0-100) for each:
- 0-30: Safe (natural, adds value, no promo feel)
- 31-60: Risky (might get flagged)
- 61-100: Don't post (too promotional, spammy, or AI-sounding)

Respond with JSON only:
{"posts":[{"title":"...","body":"...","antiBanScore":15},{"title":"...","body":"...","antiBanScore":22},{"title":"...","body":"...","antiBanScore":35}]}`;

    const userPrompt = `Topic: ${topic}
${subreddit ? `Target subreddit: ${subreddit}` : ""}
Tone: ${tone || "Story"}

Generate 3 Reddit posts.`;

    const content = await callOpenRouter(model, systemPrompt, userPrompt);
    let parsed;
    try { parsed = JSON.parse(content); } catch {
      return res.status(502).json({ error: "Failed to parse AI response" });
    }

    const posts = (parsed.posts || []).slice(0, 3).map((p) => ({
      title: String(p.title || "").trim(),
      body: String(p.body || "").trim(),
      antiBanScore: Math.min(100, Math.max(0, parseInt(p.antiBanScore) || 0)),
    }));

    res.json({ posts });
  })
);

/* ─── POST /api/reddit/reply ─────────────────────────── */
router.post(
  "/reply",
  asyncHandler(async (req, res) => {
    const userId = validateUserId(req, res);
    if (!userId) return;

    const { commentText, postContext } = req.body;
    if (!commentText) return res.status(400).json({ error: "commentText is required" });

    const model = getModelForPlan("free");

    const systemPrompt = `You are a Reddit reply writer. Generate exactly 3 replies to a Reddit comment.

${HUMAN_REDDIT_RULES}

Reply types (in order):
1. Karma-builder: gets upvotes by being funny, relatable, or insightful
2. Value-add: adds genuine information or a different perspective
3. Conversational: continues the dialogue naturally, asks or shares briefly

Respond with JSON only:
{"variations":["karma-builder reply","value-add reply","conversational reply"]}`;

    const userPrompt = `${postContext ? `Post context: ${postContext}\n\n` : ""}Comment to reply to: ${commentText}`;

    const content = await callOpenRouter(model, systemPrompt, userPrompt);
    let parsed;
    try { parsed = JSON.parse(content); } catch {
      return res.status(502).json({ error: "Failed to parse AI response" });
    }

    const variations = (parsed.variations || []).slice(0, 3).map((v) => String(v).trim());
    while (variations.length < 3 && variations.length > 0) {
      variations.push(variations[variations.length - 1]);
    }

    res.json({ variations });
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

    const model = getModelForPlan("free");

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
    try { parsed = JSON.parse(content); } catch {
      return res.status(502).json({ error: "Failed to parse AI response" });
    }

    const subreddits = (parsed.subreddits || []).slice(0, 15).map((s) => ({
      name: String(s.name || "").trim(),
      members: String(s.members || "").trim(),
      promoAllowed: ["YES", "NO", "Rules"].includes(s.promoAllowed) ? s.promoAllowed : "Rules",
      bestTime: String(s.bestTime || "").trim(),
      vibe: String(s.vibe || "").trim(),
    }));

    res.json({ subreddits });
  })
);

/* ─── POST /api/reddit/score ─────────────────────────── */
router.post(
  "/score",
  asyncHandler(async (req, res) => {
    const userId = validateUserId(req, res);
    if (!userId) return;

    const { postTitle, postBody } = req.body;
    if (!postTitle || !postBody) {
      return res.status(400).json({ error: "postTitle and postBody are required" });
    }

    const model = getModelForPlan("free");

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
    try { parsed = JSON.parse(content); } catch {
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

    const { draft } = req.body;
    if (!draft) return res.status(400).json({ error: "draft is required" });

    const model = getModelForPlan("free");

    const systemPrompt = `You are a Reddit viral ghostwriter. Transform the draft into ONE viral Reddit post.

${HUMAN_REDDIT_RULES}

THE REDDIT VIRAL FORMULA — write ALL 5 sections, separated by blank lines:

1. HOOK (1 line): Surprising statement, relatable moment, or a number. Makes people stop scrolling.
2. CONFLICT (2-3 lines): What went wrong, what was the challenge, what did you struggle with?
3. INSIGHT (2-3 lines): The key realization or lesson. The "aha" moment.
4. PROOF (2-3 lines): Specific result, before/after, or evidence. Real details beat vague claims.
5. CTA (1-2 lines): Question that invites comments. No marketing speak.

RULES:
- Minimum 400 characters total
- Short paragraphs (1-3 lines max)
- Sounds like a real person sharing a genuine experience
- NO buzzwords, NO "I'm excited to share", NO corporate tone
- Anti-ban score must be under 30

Respond with JSON only:
{"post":"your complete viral post here"}`;

    const userPrompt = `Transform this draft into a viral Reddit post:\n\n${draft}`;

    const content = await callOpenRouter(model, systemPrompt, userPrompt);
    let parsed;
    try { parsed = JSON.parse(content); } catch {
      return res.status(502).json({ error: "Failed to parse AI response" });
    }

    res.json({ post: String(parsed.post || "").trim() });
  })
);

export default router;
