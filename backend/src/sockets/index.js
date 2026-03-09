const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');

// In-memory presence tracking
const projectPresence = {};

const initializeSocket = (io) => {
  // Authenticate socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, config.jwtSecret);
      const user = await User.findById(decoded.userId);
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = user._id.toString();
      socket.userName = user.name;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userName} (${socket.userId})`);

    // Join a project room
    socket.on('joinProject', (projectId) => {
      socket.join(projectId);
      socket.currentProject = projectId;

      // Add to presence
      if (!projectPresence[projectId]) {
        projectPresence[projectId] = [];
      }

      const alreadyPresent = projectPresence[projectId].some(
        (u) => u.userId === socket.userId
      );
      if (!alreadyPresent) {
        projectPresence[projectId].push({
          userId: socket.userId,
          name: socket.userName,
        });
      }

      // Broadcast presence update
      io.to(projectId).emit('presenceUpdate', projectPresence[projectId]);
    });

    // Leave a project room
    socket.on('leaveProject', (projectId) => {
      socket.leave(projectId);
      removeFromPresence(socket.userId, projectId);
      io.to(projectId).emit('presenceUpdate', projectPresence[projectId] || []);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userName} (${socket.userId})`);
      if (socket.currentProject) {
        removeFromPresence(socket.userId, socket.currentProject);
        io.to(socket.currentProject).emit(
          'presenceUpdate',
          projectPresence[socket.currentProject] || []
        );
      }
    });
  });
};

const removeFromPresence = (userId, projectId) => {
  if (projectPresence[projectId]) {
    projectPresence[projectId] = projectPresence[projectId].filter(
      (u) => u.userId !== userId
    );
    if (projectPresence[projectId].length === 0) {
      delete projectPresence[projectId];
    }
  }
};

module.exports = { initializeSocket, projectPresence };
