/**
 * Reddit Post Generator module.
 * Called from backend route — this file documents the expected API contract.
 *
 * POST /api/reddit/generate
 * Body: { userId, email, topic, subreddit, tone }
 * Response: { posts: [{ title, body, antiBanScore }] }
 */
