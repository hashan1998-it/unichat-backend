const Notification = require('../models/Notification');
const User = require('../models/User');
const { populateUserFields } = require('../utils/db');
const logger = require('../utils/logger');

exports.getNotifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const notifications = await populateUserFields(
      Notification.find({ recipient: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
    );

    res.json(notifications);
  } catch (error) {
    logger.error('Get notifications error', { error: error.message });
    throw error;
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      throw Object.assign(new Error('Notification not found'), { status: 404 });
    }

    if (notification.recipient.toString() !== req.user._id.toString()) {
      throw Object.assign(new Error('Not authorized'), { status: 403 });
    }

    notification.read = true;
    await notification.save();

    res.json(notification);
  } catch (error) {
    logger.error('Mark notification as read error', { error: error.message });
    throw error;
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, read: false },
      { read: true }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    logger.error('Mark all notifications as read error', { error: error.message });
    throw error;
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user._id,
      read: false
    });

    res.json({ count });
  } catch (error) {
    logger.error('Get unread count error', { error: error.message });
    throw error;
  }
};

exports.createNotification = async (recipientId, senderId, type, content, link) => {
  try {
    const notification = new Notification({
      recipient: recipientId,
      sender: senderId,
      type,
      content,
      link
    });

    await notification.save();
    return notification;
  } catch (error) {
    logger.error('Create notification error', { error: error.message });
    throw error;
  }
};
