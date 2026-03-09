const Task = require('../models/Task');
const Comment = require('../models/Comment');

const search = async (query, userId) => {
  if (!query || query.trim().length === 0) {
    return { tasks: [], comments: [] };
  }

  const regex = new RegExp(query, 'i');

  const [tasks, comments] = await Promise.all([
    Task.find({
      $or: [
        { title: regex },
        { description: regex },
      ],
    })
      .populate('assignees', 'name email avatar')
      .populate('createdBy', 'name email avatar')
      .limit(50),
    Comment.find({ text: regex })
      .populate('userId', 'name email avatar')
      .populate('taskId', 'title projectId')
      .limit(50),
  ]);

  return { tasks, comments };
};

module.exports = { search };
