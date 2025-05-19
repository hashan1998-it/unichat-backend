const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');

// Load environment-specific configuration
const envFile = process.env.NODE_ENV === 'production' 
  ? '.env.production' 
  : '.env.development';

dotenv.config({ 
  path: path.resolve(__dirname, envFile) 
});

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be at least 32 characters long');
  process.exit(1);
};

// Log which config file is being used
console.log(`Loading environment from: ${envFile}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://unichat-frontend.vercel.app', 
    /https:\/\/.*\.vercel\.app$/, 
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200 
};

// Apply CORS first
app.use(cors(corsOptions));

// Middleware
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Socket setup - needs to be after CORS setup
const setupSocket = require('./utils/socket');
const io = setupSocket(server, corsOptions); 

// Rate limiting for auth endpoints
app.use('/api/auth/', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: 'Too many requests, please try again later.'
}));

// Export io for use in controllers
exports.io = io;

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/user'));
app.use('/api/posts', require('./routes/post'));
app.use('/api/search', require('./routes/search'));
app.use('/api/notifications', require('./routes/notification'));
app.use('/api/connections', require('./routes/connection'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// 404 handler - must be after all routes
app.use((req, res) => {
  console.log('404 - Not Found:', req.method, req.url);
  res.status(404).json({ message: 'Route not found', path: req.url });
})

// Validate MongoDB URI exists
if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not defined in environment variables');
  console.error(`Attempted to load from: ${envFile}`);
  process.exit(1);
}

// Log sanitized URI for debugging (hide password)
const sanitizedUri = process.env.MONGODB_URI.replace(/:([^@]+)@/, ':****@');
console.log('Connecting to MongoDB:', sanitizedUri);
const mongooseOptions = {
  serverSelectionTimeoutMS: 30000, 
  socketTimeoutMS: 45000,
  family: 4 
};

// MongoDB connection with error handling
mongoose.connect(process.env.MONGODB_URI, mongooseOptions)
.then(() => {
  console.log('MongoDB connected successfully');
  console.log(`Database: ${process.env.NODE_ENV === 'production' ? 'Production' : 'Development'}`);
  
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });
})
.catch((err) => {
  console.error('MongoDB connection error:', err);
  console.error('MongoDB URI:', process.env.MONGODB_URI);
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