const User = require('../models/User')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

exports.register = async (req, res) => {
  try {
      // Get user data from request body
      const { username, email, password, role, universityId } = req.body

      // Check if user already exists
      const existingUser = await User.findOne({ $or: [{ username }, { email }] })
      if (existingUser) {
          return res.status(400).json({ message: 'User already exists' })
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10)

      // Create new user
      const newUser = new User({
          username,
          email,
          password: hashedPassword,
          role: role || 'student',
          universityId
      })

      // Save user to database
      await newUser.save()

      // Respond with success message
      res.status(201).json({ message: 'User registered successfully' })
  } catch (error) {
      console.error(error)
      res.status(500).json({ message: 'Server error' })
  }
}

exports.login = async (req, res) => {
    try {
      const { email, password } = req.body;
      
      // Check if email and password are provided
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }
      
      // Find user
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }
      
      // Check if password exists in DB
      if (!user.password) {
        return res.status(400).json({ message: 'User password not found' });
      }
      
      // Verify password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }
      
      // Generate token
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
      
      res.json({ token, userId: user._id });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: error.message });
    }
  };
