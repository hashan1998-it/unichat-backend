const User = require('../models/User');
const Post = require('../models/Post');

exports.searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    
    const users = await User.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { firstName: { $regex: query, $options: 'i' } },
        { lastName: { $regex: query, $options: 'i' } }
      ]
    }).select('username firstName lastName profilePicture');
    
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.searchPosts = async (req, res) => {
  try {
    const { query } = req.query;
    
    const posts = await Post.find({
      content: { $regex: query, $options: 'i' }
    }).populate('user', 'username profilePicture');
    
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};