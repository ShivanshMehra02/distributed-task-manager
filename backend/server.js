const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const config = require('./src/config');
const errorHandler = require('./src/middleware/errorHandler');
const { initializeSocket } = require('./src/sockets');

// Route imports
const authRoutes = require('./src/routes/auth');
const projectRoutes = require('./src/routes/projects');
const taskRoutes = require('./src/routes/tasks');
const searchRoutes = require('./src/routes/search');

const app = express();
const server = http.createServer(app);

// Socket.io setup with /api/socket.io path for ingress routing
const io = new Server(server, {
  path: '/api/socket.io',
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

// Store io instance on app for use in controllers
app.set('io', io);

// Initialize socket handlers
initializeSocket(io);

// Middleware
app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Routes - all prefixed with /api
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/search', searchRoutes);

// Health check
app.get('/api', (req, res) => {
  res.json({ status: 'ok', message: 'Collaborative Task Manager API' });
});

// Global error handler
app.use(errorHandler);

// Connect to MongoDB and start server
const start = async () => {
  try {
    const mongoUrl = config.mongoUrl;
    await mongoose.connect(`${mongoUrl}/${config.dbName}`);
    console.log('Connected to MongoDB');

    server.listen(config.port, '0.0.0.0', () => {
      console.log(`Server running on port ${config.port}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

start();
