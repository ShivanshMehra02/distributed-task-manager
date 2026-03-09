const searchService = require('../services/searchService');

const search = async (req, res, next) => {
  try {
    const { q } = req.query;
    const results = await searchService.search(q, req.userId);
    res.json(results);
  } catch (err) {
    next(err);
  }
};

module.exports = { search };
