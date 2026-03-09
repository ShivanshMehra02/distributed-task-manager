const authService = require('../services/authService');

const register = async (req, res, next) => {
  try {
    const result = await authService.register(req.validatedBody);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.validatedBody);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login };
