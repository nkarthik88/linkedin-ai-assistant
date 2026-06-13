/**
 * Comment Reply module.
 *
 * POST /api/reddit/reply
 * Body: { userId, email, commentText, postContext }
 * Response: { variations: [string, string, string] }
 * Variation order: karma-builder, value-add, conversational
 */
