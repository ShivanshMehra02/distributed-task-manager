const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  text: {
    type: String,
    required: true,
    trim: true,
  },
}, {
  timestamps: true,
});

// Compound index for fetching comments by task
commentSchema.index({ taskId: 1, createdAt: -1 });

commentSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('Comment', commentSchema);
