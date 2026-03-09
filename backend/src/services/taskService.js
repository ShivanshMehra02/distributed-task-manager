const Task = require('../models/Task');
const Project = require('../models/Project');
const mongoose = require('mongoose');

const createTask = async ({ projectId, title, description, status, assignees, createdBy }) => {
  const project = await Project.findById(projectId);
  if (!project) {
    const err = new Error('Project not found');
    err.statusCode = 404;
    throw err;
  }

  const isMember = project.members.some(
    (m) => m.toString() === createdBy.toString()
  );
  if (!isMember) {
    const err = new Error('Access denied');
    err.statusCode = 403;
    throw err;
  }

  const task = await Task.create({
    projectId,
    title,
    description: description || '',
    status: status || 'todo',
    assignees: assignees || [],
    createdBy,
  });

  const populated = await Task.findById(task._id)
    .populate('assignees', 'name email avatar')
    .populate('createdBy', 'name email avatar');

  return populated;
};

const getTaskById = async (taskId) => {
  const task = await Task.findById(taskId)
    .populate('assignees', 'name email avatar')
    .populate('createdBy', 'name email avatar');

  if (!task) {
    const err = new Error('Task not found');
    err.statusCode = 404;
    throw err;
  }
  return task;
};

const updateTask = async (taskId, updates, userId) => {
  const task = await Task.findById(taskId);
  if (!task) {
    const err = new Error('Task not found');
    err.statusCode = 404;
    throw err;
  }

  const previousStatus = task.status;
  Object.assign(task, updates);
  await task.save();

  const populated = await Task.findById(taskId)
    .populate('assignees', 'name email avatar')
    .populate('createdBy', 'name email avatar');

  return { task: populated, statusChanged: previousStatus !== populated.status };
};

const deleteTask = async (taskId) => {
  const task = await Task.findByIdAndDelete(taskId);
  if (!task) {
    const err = new Error('Task not found');
    err.statusCode = 404;
    throw err;
  }
  return task;
};

const assignUserToTask = async (taskId, userId) => {
  const task = await Task.findById(taskId);
  if (!task) {
    const err = new Error('Task not found');
    err.statusCode = 404;
    throw err;
  }

  const alreadyAssigned = task.assignees.some(
    (a) => a.toString() === userId
  );
  if (alreadyAssigned) {
    const err = new Error('User already assigned');
    err.statusCode = 409;
    throw err;
  }

  task.assignees.push(userId);
  await task.save();

  const populated = await Task.findById(taskId)
    .populate('assignees', 'name email avatar')
    .populate('createdBy', 'name email avatar');

  return populated;
};

const unassignUserFromTask = async (taskId, userId) => {
  const task = await Task.findById(taskId);
  if (!task) {
    const err = new Error('Task not found');
    err.statusCode = 404;
    throw err;
  }

  task.assignees = task.assignees.filter(
    (a) => a.toString() !== userId
  );
  await task.save();

  const populated = await Task.findById(taskId)
    .populate('assignees', 'name email avatar')
    .populate('createdBy', 'name email avatar');

  return populated;
};

const getProjectTasks = async (projectId, { status, assignee, cursor, limit = 20 }) => {
  const query = { projectId: new mongoose.Types.ObjectId(projectId) };

  if (status) query.status = status;
  if (assignee) query.assignees = new mongoose.Types.ObjectId(assignee);
  if (cursor) {
    query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
  }

  const tasks = await Task.find(query)
    .sort({ _id: -1 })
    .limit(parseInt(limit) + 1)
    .populate('assignees', 'name email avatar')
    .populate('createdBy', 'name email avatar');

  const hasMore = tasks.length > parseInt(limit);
  const results = hasMore ? tasks.slice(0, parseInt(limit)) : tasks;
  const nextCursor = hasMore ? results[results.length - 1]._id : null;

  return { tasks: results, nextCursor, hasMore };
};

module.exports = {
  createTask,
  getTaskById,
  updateTask,
  deleteTask,
  assignUserToTask,
  unassignUserFromTask,
  getProjectTasks,
};
