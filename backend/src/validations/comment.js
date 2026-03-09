const { z } = require('zod');

const createCommentSchema = z.object({
  text: z.string().min(1, 'Comment text is required').max(2000),
});

module.exports = { createCommentSchema };
