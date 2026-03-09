const Comment = require('../models/Comment');
const Task = require('../models/Task');

const createComment = async ({ taskId, userId, text }) => {
  const task = await Task.findById(taskId);
  if (!task) {
    const err = new Error('Task not found');
    err.statusCode = 404;
    throw err;
  }

  const comment = await Comment.create({ taskId, userId, text });
  const populated = await Comment.findById(comment._id)
    .populate('userId', 'name email avatar');

  return populated;
};

const getCommentsByTask = async (taskId) => {
  const comments = await Comment.find({ taskId })
    .populate('userId', 'name email avatar')
    .sort({ createdAt: -1 });
  return comments;
};

module.exports = { createComment, getCommentsByTask };
