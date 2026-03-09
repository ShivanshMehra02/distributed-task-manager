const projectService = require('../services/projectService');

const create = async (req, res, next) => {
  try {
    const project = await projectService.createProject({
      ...req.validatedBody,
      ownerId: req.userId,
    });
    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
};

const getAll = async (req, res, next) => {
  try {
    const projects = await projectService.getProjects(req.userId);
    res.json(projects);
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const project = await projectService.getProjectById(req.params.id, req.userId);
    res.json(project);
  } catch (err) {
    next(err);
  }
};

const addMember = async (req, res, next) => {
  try {
    const project = await projectService.addMember(
      req.params.id,
      req.validatedBody.userId,
      req.userId
    );
    res.json(project);
  } catch (err) {
    next(err);
  }
};

module.exports = { create, getAll, getById, addMember };
