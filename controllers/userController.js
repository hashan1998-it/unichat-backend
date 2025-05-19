const User = require('../models/User');
const mongoose = require('mongoose');
const { uploadToCloudinary } = require('../utils/imageUpload');
const redis = require('redis');
const logger = require('../utils/logger');

let redisClient = null;
let redisConnected = false;

const connectRedisWithRetry = async (retries = 3, delay = 5000) => {
  redisClient = redis.createClient({ url: process.env.REDIS_URL });

  redisClient.on('error', (err) => {
    logger.error('Redis Client Error:', { message: err.message });
    if (err.code === 'ECONNREFUSED') {
      logger.error('Redis connection refused. Please check:', {
        checks: [
          'Redis server is running (redis-cli ping)',
          'REDIS_URL is correct in .env',
          'Network/firewall allows port 6379'
        ]
      });
    }
    redisConnected = false;
  });

  for (let i = 0; i < retries; i++) {
    try {
      await redisClient.connect();
      redisConnected = true;
      logger.info('Redis connected successfully');
      return;
    } catch (err) {
      logger.error(`Redis connection attempt ${i + 1} failed:`, { message: err.message });
      if (i < retries - 1) {
        logger.info(`Retrying Redis connection in ${delay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  logger.error('Redis connection failed after all retries. Falling back to database.');
  redisConnected = false;
};

// Initialize Redis connection
connectRedisWithRetry();

exports.getProfile = async (req, res) => {
  try {
    const cacheKey = `profile:${req.params.id}`;
    
    if (redisConnected && redisClient) {
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          return res.json(JSON.parse(cached));
        }
      } catch (err) {
        logger.error('Redis get error:', { message: err.message });
      }
    }

    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('followers', 'username profilePicture')
      .populate('following', 'username profilePicture');
    
    if (!user) {
      throw Object.assign(new Error('User not found'), { status: 404 });
    }
    
    if (redisConnected && redisClient) {
      try {
        await redisClient.setEx(cacheKey, 3600, JSON.stringify(user));
      } catch (err) {
        logger.error('Redis set error:', { message: err.message });
      }
    }
    
    res.json(user);
  } catch (error) {
    logger.error('Get profile error', { error: error.message });
    throw error;
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, bio } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user,
      { firstName, lastName, bio },
      { new: true }
    ).select('-password');

    if (!user) {
      throw Object.assign(new Error('User not found'), { status: 404 });
    }

    res.json(user);
  } catch (error) {
    logger.error('Update profile error', { error: error.message });
    throw error;
  }
};

exports.followUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user;

    if (userId === currentUserId.toString()) {
      throw Object.assign(new Error('Cannot follow yourself'), { status: 400 });
    }

    const userToFollow = await User.findById(userId);
    if (!userToFollow) {
      throw Object.assign(new Error('User not found'), { status: 404 });
    }

    const currentUser = await User.findById(currentUserId);
    if (currentUser.following.includes(userId)) {
      throw Object.assign(new Error('Already following this user'), { status: 400 });
    }

    await User.findByIdAndUpdate(currentUserId, { $addToSet: { following: userId } });
    await User.findByIdAndUpdate(userId, { $addToSet: { followers: currentUserId } });

    res.json({ message: 'Followed successfully' });
  } catch (error) {
    logger.error('Follow user error', { error: error.message });
    throw error;
  }
};

exports.unfollowUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user;

    if (userId === currentUserId.toString()) {
      throw Object.assign(new Error('Cannot unfollow yourself'), { status: 400 });
    }

    const userToUnfollow = await User.findById(userId);
    if (!userToUnfollow) {
      throw Object.assign(new Error('User not found'), { status: 404 });
    }

    const currentUser = await User.findById(currentUserId);
    if (!currentUser.following.includes(userId)) {
      throw Object.assign(new Error('Not following this user'), { status: 400 });
    }

    await User.findByIdAndUpdate(currentUserId, { $pull: { following: userId } });
    await User.findByIdAndUpdate(userId, { $pull: { followers: currentUserId } });

    res.json({ message: 'Unfollowed successfully' });
  } catch (error) {
    logger.error('Unfollow user error', { error: error.message });
    throw error;
  }
};

exports.uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      throw Object.assign(new Error('No file uploaded'), { status: 400 });
    }

    const imageUrl = await uploadToCloudinary(req.file, 'profile-pictures', { width: 200, height: 200 });

    const user = await User.findByIdAndUpdate(
      req.user,
      { profilePicture: imageUrl },
      { new: true }
    ).select('-password');
    
    if (!user) {
      throw Object.assign(new Error('User not found'), { status: 404 });
    }

    res.json(user);
  } catch (error) {
    logger.error('Upload profile picture error', { error: error.message });
    throw error;
  }
};

