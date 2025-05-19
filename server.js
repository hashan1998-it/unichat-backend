const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const rateLimit = require('express-rate-limit');

// Load environment-specific configuration
const envFile = process.env.NODE_ENV === 'production' 
  ? '.env.production' 
  : '.env.development';

dotenv.config({ 
  path: path.resolve(__dirname, envFile) 
});

// Log which config file is being used
console.log(`Loading environment from: ${envFile}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);

// Validate JWT_SECRET
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be at least 32 characters long');
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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
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

// Validate MongoDB URI exists
if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not defined in environment variables');
  console.error(`Attempted to load from: ${envFile}`);
  process.exit(1);
}

// MongoDB connection with retry logic
const mongooseOptions = {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000
};

// Retry connection function
const connectWithRetry = async (retries = 5, delay = 5000) => {
  for (let i = 0; i < retries; i++) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, mongooseOptions);
      console.log('MongoDB connected successfully');
      console.log(`Database: ${process.env.NODE_ENV === 'production' ? 'Production' : 'Development'}`);
      return;
    } catch (err) {
      console.error(`MongoDB connection attempt ${i + 1} failed:`, err.message);
      if (err.code === 'ENOTFOUND' && err.syscall === 'querySrv') {
        console.error('DNS resolution failed. Please check:');
        console.error('- Network connectivity');
        console.error('- DNS server configuration (try Google DNS: 8.8.8.8)');
        console.error('- MongoDB Atlas cluster status and credentials');
      }
      if (i < retries - 1) {
        console.log(`Retrying in ${delay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  console.error('MongoDB connection failed after all retries');
  process.exit(1);
};

// Connect to MongoDB
connectWithRetry()
  .then(() => {
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// MongoDB connection event handlers
mongoose.connection.on('connected', () => {
  console.log('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected from MongoDB');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed due to app termination');
  process.exit(0);
});