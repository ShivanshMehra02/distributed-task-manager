const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['todo', 'in-progress', 'done'],
    default: 'todo',
  },
  assignees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

// Compound indexes for dashboard queries
taskSchema.index({ projectId: 1, createdAt: -1 });
taskSchema.index({ projectId: 1, status: 1 });
taskSchema.index({ projectId: 1, assignees: 1 });

taskSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('Task', taskSchema);
