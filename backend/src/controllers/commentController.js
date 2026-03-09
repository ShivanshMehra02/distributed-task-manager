const commentService = require('../services/commentService');

const create = async (req, res, next) => {
  try {
    const comment = await commentService.createComment({
      taskId: req.params.id,
      userId: req.userId,
      text: req.validatedBody.text,
    });

    // Get task to find projectId for socket room
    const Task = require('../models/Task');
    const task = await Task.findById(req.params.id);
    if (task) {
      const io = req.app.get('io');
      if (io) {
        io.to(task.projectId.toString()).emit('commentAdded', comment);
      }
    }

    res.status(201).json(comment);
  } catch (err) {
    next(err);
  }
};

const getByTask = async (req, res, next) => {
  try {
    const comments = await commentService.getCommentsByTask(req.params.id);
    res.json(comments);
  } catch (err) {
    next(err);
  }
};

module.exports = { create, getByTask };
