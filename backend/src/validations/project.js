const { z } = require('zod');

const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(200),
  description: z.string().optional(),
});

const addMemberSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

module.exports = { createProjectSchema, addMemberSchema };
