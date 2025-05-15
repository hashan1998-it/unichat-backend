const express = require('express');
const router = express.Router();
const connectionController = require('../controllers/connectionController');
const auth = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// Send a connection request
router.post('/send/:receiverId', connectionController.sendRequest);

// Accept a connection request
router.post('/accept/:requestId', connectionController.acceptRequest);

// Reject a connection request
router.post('/reject/:requestId', connectionController.rejectRequest);

// Get pending requests
router.get('/pending', connectionController.getPendingRequests);

module.exports = router; 