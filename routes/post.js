const express = require("express");
const router = express.Router();
const postController = require("../controllers/postController");
const auth = require("../middleware/auth");
const multer = require("multer");

// Multer configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    if (mimetype && extname) return cb(null, true);
    cb(new Error("Only JPEG/PNG images are allowed"));
  },
});

router.get("/feed", auth, postController.getFeed);
router.get("/user/:userId", auth, postController.getUserPosts);
router.post("/:postId/like", auth, postController.likePost);
router.post("/:postId/comment", auth, postController.addComment);

module.exports = router;
