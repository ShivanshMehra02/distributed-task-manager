const taskService = require('../services/taskService');

const create = async (req, res, next) => {
  try {
    const task = await taskService.createTask({
      ...req.validatedBody,
      createdBy: req.userId,
    });

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(task.projectId.toString()).emit('taskCreated', task);
    }

    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const task = await taskService.getTaskById(req.params.id);
    res.json(task);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const { task, statusChanged } = await taskService.updateTask(
      req.params.id,
      req.validatedBody,
      req.userId
    );

    const io = req.app.get('io');
    if (io) {
      io.to(task.projectId.toString()).emit('taskUpdated', task);
      if (statusChanged) {
        io.to(task.projectId.toString()).emit('taskStatusChanged', task);
      }
    }

    res.json(task);
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const task = await taskService.deleteTask(req.params.id);

    const io = req.app.get('io');
    if (io) {
      io.to(task.projectId.toString()).emit('taskDeleted', {
        taskId: task._id,
        projectId: task.projectId,
      });
    }

    res.json({ message: 'Task deleted' });
  } catch (err) {
    next(err);
  }
};

const assign = async (req, res, next) => {
  try {
    const task = await taskService.assignUserToTask(
      req.params.id,
      req.validatedBody.userId
    );

    const io = req.app.get('io');
    if (io) {
      io.to(task.projectId.toString()).emit('taskUpdated', task);
    }

    res.json(task);
  } catch (err) {
    next(err);
  }
};

const unassign = async (req, res, next) => {
  try {
    const task = await taskService.unassignUserFromTask(
      req.params.id,
      req.validatedBody.userId
    );

    const io = req.app.get('io');
    if (io) {
      io.to(task.projectId.toString()).emit('taskUpdated', task);
    }

    res.json(task);
  } catch (err) {
    next(err);
  }
};

const getProjectTasks = async (req, res, next) => {
  try {
    const { status, assignee, cursor, limit } = req.query;
    const result = await taskService.getProjectTasks(req.params.id, {
      status,
      assignee,
      cursor,
      limit: limit || 20,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = { create, getById, update, remove, assign, unassign, getProjectTasks };
