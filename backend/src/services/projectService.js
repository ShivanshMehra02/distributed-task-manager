const Project = require('../models/Project');
const User = require('../models/User');
const mongoose = require('mongoose');

const createProject = async ({ name, description, ownerId }) => {
  const project = await Project.create({
    name,
    description,
    owner: ownerId,
    members: [ownerId],
  });
  return project.toJSON();
};

const getProjects = async (userId) => {
  const projects = await Project.find({ members: userId })
    .populate('owner', 'name email avatar')
    .populate('members', 'name email avatar')
    .sort({ createdAt: -1 });
  return projects;
};

const getProjectById = async (projectId, userId) => {
  const project = await Project.findById(projectId)
    .populate('owner', 'name email avatar')
    .populate('members', 'name email avatar');

  if (!project) {
    const err = new Error('Project not found');
    err.statusCode = 404;
    throw err;
  }

  const isMember = project.members.some(
    (m) => m._id.toString() === userId.toString()
  );
  if (!isMember) {
    const err = new Error('Access denied');
    err.statusCode = 403;
    throw err;
  }

  return project;
};

const addMember = async (projectId, userId, requesterId) => {
  const project = await Project.findById(projectId);
  if (!project) {
    const err = new Error('Project not found');
    err.statusCode = 404;
    throw err;
  }

  const isOwnerOrMember = project.members.some(
    (m) => m.toString() === requesterId.toString()
  );
  if (!isOwnerOrMember) {
    const err = new Error('Access denied');
    err.statusCode = 403;
    throw err;
  }

  const userToAdd = await User.findById(userId);
  if (!userToAdd) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  const alreadyMember = project.members.some(
    (m) => m.toString() === userId
  );
  if (alreadyMember) {
    const err = new Error('User is already a member');
    err.statusCode = 409;
    throw err;
  }

  project.members.push(userId);
  await project.save();

  const updated = await Project.findById(projectId)
    .populate('owner', 'name email avatar')
    .populate('members', 'name email avatar');

  return updated;
};

module.exports = { createProject, getProjects, getProjectById, addMember };
