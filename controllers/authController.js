const User = require('../models/User')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

exports.register = async (req, res) => {
  try {
      // Get user data from request body
      const { username, email, password, role, universityId } = req.body

      // Check if user already exists
      const existingUser = await User.findOne({ 
          $or: [
              { username }, 
              { email },
              { universityId }
          ] 
      })
      if (existingUser) {
          if (existingUser.username === username) {
              return res.status(400).json({ message: 'Username already exists' })
          }
          if (existingUser.email === email) {
              return res.status(400).json({ message: 'Email already exists' })
          }
          if (existingUser.universityId === universityId) {
              return res.status(400).json({ message: 'University ID already exists' })
          }
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12)

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
      if (error.name === 'ValidationError') {
          const messages = Object.values(error.errors).map(err => err.message)
          return res.status(400).json({ message: messages[0] })
      }
      res.status(500).json({ message: 'Server error' })
  }
}

exports.login = async (req, res) => {
    try {
      const { universityId, password } = req.body;
      
      // Check if universityId and password are provided
      if (!universityId || !password) {
        return res.status(400).json({ message: 'University ID and password are required' });
      }
      
      
      // Find user by universityId
      const user = await User.findOne({ universityId });
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
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({ message: messages[0] });
      }
      res.status(500).json({ message: error.message });
    }
  };
