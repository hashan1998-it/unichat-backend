const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');

dotenv.config();

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

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
.then(() => {
  console.log('MongoDB connected successfully');
})

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});