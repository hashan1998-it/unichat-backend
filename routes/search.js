const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const auth = require('../middleware/auth');

router.get('/users', auth, searchController.searchUsers);
router.get('/posts', auth, searchController.searchPosts);

module.exports = router;