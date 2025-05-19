const Notification = require('../models/Notification');
const User = require('../models/User');

// Get all notifications for a user
exports.getNotifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const userId = req.user._id || req.user;
    
    const notifications = await Notification.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .populate('sender', 'username profilePicture')
      .limit(limit);

    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Error fetching notifications' });
  }
};

// Mark a notification as read
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user._id || req.user;
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    if (notification.user.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    notification.read = true;
    await notification.save();

    res.json(notification);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Error marking notification as read' });
  }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id || req.user;
    
    await Notification.updateMany(
      { user: userId, read: false },
      { read: true }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Error marking all notifications as read' });
  }
};

// Get unread notification count
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id || req.user;
    
    const count = await Notification.countDocuments({
      user: userId,
      read: false
    });

    res.json({ count });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ message: 'Error getting unread count' });
  }
};

// Create a notification (helper function)
exports.createNotification = async (recipientId, senderId, type, content, link) => {
  try {
    // Ensure recipientId is a valid ID
    if (!recipientId) {
      throw new Error('Recipient ID is required');
    }
    
    const notification = new Notification({
      user: recipientId,
      sender: senderId,
      type,
      content,
      link,
      read: false
    });

    await notification.save();
    
    // Emit socket event for real-time notification
    const io = require('../server').io;
    
    // Populate sender information for the socket event
    const populatedNotification = await Notification.findById(notification._id)
      .populate('sender', 'username profilePicture');
    
    if (io) {
      io.to(recipientId.toString()).emit('newNotification', populatedNotification);
    }
    
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};