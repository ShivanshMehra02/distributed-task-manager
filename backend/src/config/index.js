const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

module.exports = {
  port: process.env.PORT || 8001,
  mongoUrl: process.env.MONGO_URL,
  dbName: process.env.DB_NAME || 'task_manager',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
};
