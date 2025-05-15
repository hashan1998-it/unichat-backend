const User = require('../models/User');
const Post = require('../models/Post');

exports.searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    
    let filter = {};
    
    // If query is provided, search by username, firstName, lastName
    if (query && query.trim() !== '') {
      filter = {
        $or: [
          { username: { $regex: query, $options: 'i' } },
          { firstName: { $regex: query, $options: 'i' } },
          { lastName: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } }
        ]
      };
    }
    
    // Get all users except the current user
    const users = await User.find(filter)
      .select('username firstName lastName profilePicture email bio role universityId connections')
      .where('_id').ne(req.user); // Exclude current user
    
    res.json(users);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.searchPosts = async (req, res) => {
  try {
    const { query } = req.query;
    
    let filter = {};
    
    if (query && query.trim() !== '') {
      filter = {
        content: { $regex: query, $options: 'i' }
      };
    }
    
    const posts = await Post.find(filter)
      .populate('user', 'username profilePicture')
      .sort({ createdAt: -1 })
      .limit(20);
    
    res.json(posts);
  } catch (error) {
    console.error('Search posts error:', error);
    res.status(500).json({ message: error.message });
  }
};