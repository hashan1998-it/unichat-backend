const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const logger = require('../utils/logger');

const registerSchema = Joi.object({
  username: Joi.string().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required(),
  universityId: Joi.string().required(),
  role: Joi.string().valid('student', 'professor').optional()
});

const loginSchema = Joi.object({
  universityId: Joi.string().required(),
  password: Joi.string().required()
});

exports.register = async (req, res) => {
  try {
    const { error } = registerSchema.validate(req.body);
    if (error) {
      logger.debug('Registration validation failed', { error: error.details[0].message });
      throw Object.assign(new Error(error.details[0].message), { status: 400 });
    }

    const { username, email, password, role, universityId } = req.body;

    const existingUser = await User.findOne({ 
      $or: [{ username }, { email }, { universityId }] 
    });
    if (existingUser) {
      if (existingUser.username === username) {
        throw Object.assign(new Error('Username already exists'), { status: 400 });
      }
      if (existingUser.email === email) {
        throw Object.assign(new Error('Email already exists'), { status: 400 });
      }
      if (existingUser.universityId === universityId) {
        throw Object.assign(new Error('University ID already exists'), { status: 400 });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      role: role || 'student',
      universityId
    });

    await newUser.save();

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    logger.error('Registration error', { error: error.message });
    throw error;
  }
};

exports.login = async (req, res) => {
  try {
    const { error } = loginSchema.validate(req.body);
    if (error) {
      logger.debug('Login validation failed', { error: error.details[0].message });
      throw Object.assign(new Error(error.details[0].message), { status: 400 });
    }

    const { universityId, password } = req.body;

    if (!universityId || !password) {
      throw Object.assign(new Error('University ID and password are required'), { status: 400 });
    }

    const user = await User.findOne({ universityId });
    if (!user) {
      throw Object.assign(new Error('Invalid credentials'), { status: 400 });
    }

    if (!user.password) {
      throw Object.assign(new Error('User password not found'), { status: 400 });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw Object.assign(new Error('Invalid credentials'), { status: 400 });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, userId: user._id });
  } catch (error) {
    logger.error('Login error', { error: error.message });
    throw error;
  }
};