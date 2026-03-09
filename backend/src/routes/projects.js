const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const taskController = require('../controllers/taskController');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createProjectSchema, addMemberSchema } = require('../validations/project');

router.use(authenticate);

router.post('/', validate(createProjectSchema), projectController.create);
router.get('/', projectController.getAll);
router.get('/:id', projectController.getById);
router.post('/:id/members', validate(addMemberSchema), projectController.addMember);
router.get('/:id/tasks', taskController.getProjectTasks);

module.exports = router;
