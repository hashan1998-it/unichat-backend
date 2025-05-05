const User = require('../models/User');

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('followers', 'username profilePicture')
      .populate('following', 'username profilePicture');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
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
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.followUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (userId === req.user) {
      return res.status(400).json({ message: 'Cannot follow yourself' });
    }
    
    // Update current user
    const currentUser = await User.findById(req.user);
    if (!currentUser.following.includes(userId)) {
      currentUser.following.push(userId);
      await currentUser.save();
    }
    
    // Update target user
    const targetUser = await User.findById(userId);
    if (!targetUser.followers.includes(req.user)) {
      targetUser.followers.push(req.user);
      await targetUser.save();
    }
    
    res.json({ message: 'User followed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.unfollowUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Update current user
    const currentUser = await User.findById(req.user);
    currentUser.following = currentUser.following.filter(id => id.toString() !== userId);
    await currentUser.save();
    
    // Update target user
    const targetUser = await User.findById(userId);
    targetUser.followers = targetUser.followers.filter(id => id.toString() !== req.user);
    await targetUser.save();
    
    res.json({ message: 'User unfollowed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};