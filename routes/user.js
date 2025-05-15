const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');
const multer = require('multer');
const User = require('../models/User');

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, `profile-${req.user}-${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Get a single user by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('connections', 'name universityId profilePicture');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/profile/:id', auth, userController.getProfile);
router.put('/profile', auth, userController.updateProfile);
router.post('/follow/:userId', auth, userController.followUser);
router.post('/unfollow/:userId', auth, userController.unfollowUser);
router.post('/profile-picture', auth, upload.single('profilePicture'), userController.uploadProfilePicture);

// Get user's connections
router.get('/:id/connections', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('connections', 'name universityId profilePicture')
      .select('connections');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user.connections);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;