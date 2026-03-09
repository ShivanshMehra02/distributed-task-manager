const { z } = require('zod');

const createTaskSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  title: z.string().min(1, 'Title is required').max(300),
  description: z.string().optional(),
  status: z.enum(['todo', 'in-progress', 'done']).optional(),
  assignees: z.array(z.string()).optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().optional(),
  status: z.enum(['todo', 'in-progress', 'done']).optional(),
  assignees: z.array(z.string()).optional(),
});

const assignUserSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

module.exports = { createTaskSchema, updateTaskSchema, assignUserSchema };
