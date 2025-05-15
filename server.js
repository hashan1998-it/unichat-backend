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

// Log sanitized URI for debugging (hide password)
const sanitizedUri = process.env.MONGODB_URI.replace(/:([^@]+)@/, ':****@');
console.log('Connecting to MongoDB:', sanitizedUri);

// Define mongooseOptions before using it
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
})
.catch((err) => {
  console.error('MongoDB connection error:', err);
  console.error('MongoDB URI:', process.env.MONGODB_URI);
  process.exit(1);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});