const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const commentController = require('../controllers/commentController');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createTaskSchema, updateTaskSchema, assignUserSchema } = require('../validations/task');
const { createCommentSchema } = require('../validations/comment');

router.use(authenticate);

router.post('/', validate(createTaskSchema), taskController.create);
router.get('/:id', taskController.getById);
router.put('/:id', validate(updateTaskSchema), taskController.update);
router.delete('/:id', taskController.remove);

router.post('/:id/assign', validate(assignUserSchema), taskController.assign);
router.post('/:id/unassign', validate(assignUserSchema), taskController.unassign);

router.post('/:id/comments', validate(createCommentSchema), commentController.create);
router.get('/:id/comments', commentController.getByTask);

module.exports = router;
