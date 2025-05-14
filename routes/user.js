const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');
const multer = require('multer');

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, `profile-${req.user}-${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

router.get('/profile/:id', auth, userController.getProfile);
router.put('/profile', auth, userController.updateProfile);
router.post('/follow/:userId', auth, userController.followUser);
router.post('/unfollow/:userId', auth, userController.unfollowUser);
router.post('/profile-picture', auth, upload.single('profilePicture'), userController.uploadProfilePicture);

module.exports = router;