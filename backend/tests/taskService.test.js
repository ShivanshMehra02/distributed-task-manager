const { describe, it, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');

// Mock mongoose
const mockSave = jest.fn();
const mockFindById = jest.fn();
const mockFindOne = jest.fn();
const mockCreate = jest.fn();
const mockFind = jest.fn();

jest.mock('../src/models/Task', () => {
  const mockModel = jest.fn().mockImplementation((data) => ({
    ...data,
    save: mockSave,
    toJSON: () => data,
  }));
  mockModel.create = mockCreate;
  mockModel.findById = mockFindById;
  mockModel.find = mockFind;
  return mockModel;
});

jest.mock('../src/models/Project', () => {
  const mockModel = jest.fn();
  mockModel.findById = jest.fn();
  return mockModel;
});

jest.mock('../src/models/Comment', () => {
  const mockModel = jest.fn();
  return mockModel;
});

const Task = require('../src/models/Task');
const Project = require('../src/models/Project');

describe('Task Service - createTask', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a task successfully when project exists and user is a member', async () => {
    const projectId = '507f1f77bcf86cd799439011';
    const userId = '507f1f77bcf86cd799439012';

    const mockProject = {
      _id: projectId,
      members: [{ toString: () => userId }],
    };

    Project.findById.mockResolvedValue(mockProject);

    const mockCreatedTask = {
      _id: '507f1f77bcf86cd799439013',
      projectId,
      title: 'Test Task',
      description: 'Test description',
      status: 'todo',
      assignees: [],
      createdBy: userId,
    };

    mockCreate.mockResolvedValue(mockCreatedTask);

    const mockPopulated = {
      ...mockCreatedTask,
      assignees: [],
      createdBy: { _id: userId, name: 'Test User', email: 'test@test.com' },
    };

    const populateMock2 = jest.fn().mockResolvedValue(mockPopulated);
    const populateMock1 = jest.fn().mockReturnValue({ populate: populateMock2 });
    mockFindById.mockReturnValue({ populate: populateMock1 });

    // Import and test the service function logic
    const taskService = require('../src/services/taskService');
    const result = await taskService.createTask({
      projectId,
      title: 'Test Task',
      description: 'Test description',
      createdBy: userId,
    });

    expect(Project.findById).toHaveBeenCalledWith(projectId);
    expect(mockCreate).toHaveBeenCalled();
    expect(result).toBeDefined();
    expect(result.title).toBe('Test Task');
  });

  it('should throw error when project is not found', async () => {
    Project.findById.mockResolvedValue(null);

    const taskService = require('../src/services/taskService');

    await expect(
      taskService.createTask({
        projectId: 'nonexistent',
        title: 'Test',
        createdBy: 'user123',
      })
    ).rejects.toThrow('Project not found');
  });

  it('should throw error when user is not a project member', async () => {
    const mockProject = {
      _id: '507f1f77bcf86cd799439011',
      members: [{ toString: () => 'differentUser' }],
    };

    Project.findById.mockResolvedValue(mockProject);

    const taskService = require('../src/services/taskService');

    await expect(
      taskService.createTask({
        projectId: '507f1f77bcf86cd799439011',
        title: 'Test',
        createdBy: 'unauthorizedUser',
      })
    ).rejects.toThrow('Access denied');
  });
});

describe('Task Service - assignUserToTask', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should assign a user to a task successfully', async () => {
    const taskId = '507f1f77bcf86cd799439013';
    const userId = '507f1f77bcf86cd799439012';

    const mockTask = {
      _id: taskId,
      assignees: [],
      save: mockSave.mockResolvedValue(true),
    };
    mockTask.assignees.some = jest.fn().mockReturnValue(false);
    mockTask.assignees.push = jest.fn();

    mockFindById.mockResolvedValueOnce(mockTask);

    const mockPopulated = {
      _id: taskId,
      assignees: [{ _id: userId, name: 'Test User' }],
      projectId: '507f1f77bcf86cd799439011',
    };

    const populateMock2 = jest.fn().mockResolvedValue(mockPopulated);
    const populateMock1 = jest.fn().mockReturnValue({ populate: populateMock2 });
    mockFindById.mockReturnValueOnce({ populate: populateMock1 });

    const taskService = require('../src/services/taskService');
    const result = await taskService.assignUserToTask(taskId, userId);

    expect(mockFindById).toHaveBeenCalledWith(taskId);
    expect(mockSave).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('should throw error when task is not found', async () => {
    mockFindById.mockResolvedValueOnce(null);

    const taskService = require('../src/services/taskService');

    await expect(
      taskService.assignUserToTask('nonexistent', 'user123')
    ).rejects.toThrow('Task not found');
  });

  it('should throw error when user is already assigned', async () => {
    const taskId = '507f1f77bcf86cd799439013';
    const userId = '507f1f77bcf86cd799439012';

    const mockTask = {
      _id: taskId,
      assignees: [{ toString: () => userId }],
    };

    mockFindById.mockResolvedValueOnce(mockTask);

    const taskService = require('../src/services/taskService');

    await expect(
      taskService.assignUserToTask(taskId, userId)
    ).rejects.toThrow('User already assigned');
  });
});
