import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { config } from "../config.js";
import { getModelForPlan } from "../constants/plans.js";
import { consumeRedditFeatureCredit } from "../services/usage.js";

const router = Router();

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const HUMAN_REDDIT_RULES = `Write using casual conversational Reddit language. Use short paragraphs. Natural friendly tone. Minor imperfections ok. Variable sentence lengths. NO marketing jargon. NO promotional buzzwords. NO polished sales copy. Add genuine value first.`;

const HUMAN_WRITING_RULES = `
HUMAN WRITING RULES — apply to every post without exception:
1. Vary sentence length aggressively. Short punch. Then a longer sentence with real detail and context. Short again.
2. Use emotional, subjective words: annoying, honestly, weird, refreshing, surprisingly, genuinely, frustrated, relieved, confused
3. Add natural self-corrections mid-post: "Actually, scratch that — the real issue was..." or "Wait, I should back up here..."
4. State opinions directly: "Here's the thing, it doesn't work" — NOT "I think it might not work"
5. Include imperfect anecdotes: "spent 3 hours on this and honestly results were mediocre but here's what I learned anyway"
6. Use commas, not em-dashes — em-dashes are a known AI writing tell
7. Keep paragraphs to 1-3 sentences maximum
8. Peer voice only: sharing experience as an equal, never expert presenting findings to an audience`;

const BANNED_WORDS = `
BANNED WORDS — never use these, replace with plain natural language:
game-changer, revolutionary, unleash, leverage, synergy, guaranteed, life-changing, secrets,
Click here, Act now, Exclusive, groundbreaking, cutting-edge, disruptive, innovative,
Delve, landscape, pivotal, testament, Moreover, In conclusion, It is important,
10x, supercharge, streamline, 100% free, best price, Wait until you see`;

const SELF_REVIEW = `
SELF-REVIEW PASS before finalizing — check every post:
1. Does it sound promotional? Rewrite completely.
2. Are there any em-dashes? Replace every one with a comma or period.
3. Any banned words in the list above? Replace them.
4. Does it feel like a peer sharing a real experience? If not, rewrite.
5. Would a real Redditor actually post this? If no, rewrite.`;

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
    await consumeRedditFeatureCredit(userId, "reddit_post");

    const { topic, subreddit, tone, template, isPromoting, analysisContext } = req.body;
    if (!topic) return res.status(400).json({ error: "topic is required" });

    const model = getModelForPlan("free");

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

    const systemPrompt = `You are a Reddit ghostwriter. Generate 3 distinct Reddit post options.
${communitySection}
${HUMAN_WRITING_RULES}
${BANNED_WORDS}
${promoSection}${templateSection}
Each post must have a TITLE and a BODY. Also score anti-ban risk (0-100) for each:
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

    const model = getModelForPlan("free");

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
    try { parsed = JSON.parse(content); } catch {
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

    const model = getModelForPlan("free");

    const systemPrompt = `You are a Reddit ghostwriter. Transform website or product content into 3 authentic Reddit posts that provide genuine value.
${HUMAN_WRITING_RULES}
${BANNED_WORDS}

CRITICAL FRAMING RULE — the post must NEVER read like an advertisement. Use exactly one of these frames:
1. Personal experience: "I was struggling with X, tried Y, here is what happened."
2. Lesson learned: "Spent N weeks dealing with X. Here are the things I figured out."
3. Community question: "Working on X and ran into Y. How do others deal with this?"

Structure: Problem the author faced → Journey/struggle → What they discovered → (Product or service mentioned in ONE natural sentence at the end only, as part of "what helped")
The post must provide real value even if the reader never clicks any link.
${subreddit ? `\nWriting for ${subreddit}. Match that community's tone and style.` : ""}
${SELF_REVIEW}
Respond with JSON only:
{"posts":[{"title":"...","body":"...","antiBanScore":15},{"title":"...","body":"...","antiBanScore":22},{"title":"...","body":"...","antiBanScore":35}]}`;

    const userPrompt = `Extract the core value from this content and write 3 Reddit posts:\n\n${urlContent}`;

    const content = await callOpenRouter(model, systemPrompt, userPrompt);
    let parsed;
    try { parsed = JSON.parse(content); } catch {
      return res.status(502).json({ error: "Failed to parse AI response" });
    }

    const posts = (parsed.posts || []).slice(0, 3).map((p) => ({
      title: String(p.title || "").trim(),
      body:  String(p.body  || "").trim(),
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
    await consumeRedditFeatureCredit(userId, "reddit_reply");

    const { commentText, postContext, persona = "mentor" } = req.body;
    if (!commentText) return res.status(400).json({ error: "commentText is required" });

    const model = getModelForPlan("free");

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
    await consumeRedditFeatureCredit(userId, "reddit_subreddit");

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
    await consumeRedditFeatureCredit(userId, "reddit_post");

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
    await consumeRedditFeatureCredit(userId, "reddit_post");

    const { draft, subreddit } = req.body;
    if (!draft) return res.status(400).json({ error: "draft is required" });

    const model = getModelForPlan("free");

    const systemPrompt = `You are a Reddit viral ghostwriter. Transform the draft into ONE viral Reddit post${subreddit ? ` specifically for ${subreddit}` : ""}.${subreddit ? ` Follow that subreddit's culture and norms.` : ""}

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
