const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const auth = require('../middleware/auth');

// Get all notifications
router.get('/', auth, notificationController.getNotifications);

// Get unread notification count
router.get('/unread/count', auth, notificationController.getUnreadCount);

// Mark a notification as read
router.put('/:id/read', auth, notificationController.markAsRead);

// Mark all notifications as read
router.put('/read/all', auth, notificationController.markAllAsRead);

module.exports = router; 