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

// Debug middleware
router.use((req, res, next) => {
  console.log('Post route - Method:', req.method);
  console.log('Post route - Path:', req.path);
  console.log('Post route - Headers:', req.headers);
  next();
});

router.post('/', auth, upload.single('image'), (req, res, next) => {
  console.log('Post route - After auth - req.user:', req.user);
  console.log('Post route - req.body:', req.body);
  next();
}, postController.createPost);

router.get('/feed', auth, postController.getFeed);
router.get('/user/:userId', auth, postController.getUserPosts);
router.post('/:postId/like', auth, postController.likePost);
router.post('/:postId/comment', auth, postController.addComment);

module.exports = router;