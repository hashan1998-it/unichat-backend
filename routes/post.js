const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const auth = require('../middleware/auth');
const multer = require('multer');

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

router.post('/', auth, upload.single('image'), postController.createPost);
router.get('/feed', auth, postController.getFeed);
router.get('/user/:userId', auth, postController.getUserPosts); // Add this line
router.post('/:postId/like', auth, postController.likePost);
router.post('/:postId/comment', auth, postController.addComment);

module.exports = router;