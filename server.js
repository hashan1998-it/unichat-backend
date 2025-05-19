const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv-flow');
const http = require('http');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');

// Load environment variables with dotenv-flow
dotenv.config();

// Log environment
logger.info(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);

// Validate JWT_SECRET
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  logger.error('JWT_SECRET must be at least 32 characters long');
  process.exit(1);
}

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? ['https://unichat-frontend.vercel.app']
    : ['http://localhost:3000', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

// Apply CORS first
app.use(cors(corsOptions));

// Middleware
app.use(express.json());

// Rate limiting for auth endpoints
app.use('/api/auth/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.'
}));

// Socket setup
const setupSocket = require('./utils/socket');
const io = setupSocket(server, corsOptions);

// Export io for use in controllers
exports.io = io;

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/user'));
app.use('/api/posts', require('./routes/post'));
app.use('/api/search', require('./routes/search'));
app.use('/api/notifications', require('./routes/notification'));
app.use('/api/connections', require('./routes/connection'));

// Centralized error handling middleware
app.use((err, req, res, next) => {
  logger.error('Error:', { stack: err.stack });
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ message });
});

// Validate MongoDB URI exists
if (!process.env.MONGODB_URI) {
  logger.error('MONGODB_URI is not defined in environment variables');
  process.exit(1);
}

// MongoDB connection with retry logic
const mongooseOptions = {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10
};

const connectWithRetry = async (retries = 5, delay = 5) => {
  for (let i = 0; i < retries; i++) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, mongooseOptions);
      logger.info('MongoDB connected successfully');
      logger.info(`Database: ${process.env.NODE_ENV === 'production' ? 'Production' : 'Development'}`);
      return;
    } catch (err) {
      logger.error(`MongoDB connection attempt ${i + 1} failed: ${err.message}`);
      if (err.code === 'ENOTFOUND' && err.syscall === 'querySrv') {
        logger.error('DNS resolution failed. Please check:');
      }
      if (i < retries - 1) {
        logger.info(`Retrying in ${delay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  logger.error('MongoDB connection failed after all retries');
  process.exit(1);
};

// Connect to MongoDB
connectWithRetry()
  .then(() => {
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });
  })
  .catch(err => {
    logger.error('MongoDB connection error:', err);
    process.exit(1);
  });

// MongoDB connection event handlers
mongoose.connection.on('connected', () => {
  logger.info('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  logger.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  logger.info('Mongoose disconnected from MongoDB');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed due to app termination');
  process.exit(0);
});