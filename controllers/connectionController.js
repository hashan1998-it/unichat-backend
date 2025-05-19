const ConnectionRequest = require('../models/ConnectionRequest');
const User = require('../models/User');
const notificationController = require('./notificationController');
const logger = require('../utils/logger');

/**
 * Sends a connection request to another user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.sendRequest = async (req, res) => {
  try {
    const { receiverId } = req.params;
    const senderId = req.user._id;

    const receiver = await User.findById(receiverId);
    if (!receiver) {
      throw Object.assign(new Error('User not found'), { status: 404 });
    }

    const sender = await User.findById(senderId);
    if (sender.connections?.includes(receiverId)) {
      throw Object.assign(new Error('Users are already connected'), { status: 400 });
    }

    const existingRequest = await ConnectionRequest.findOne({
      sender: senderId,
      receiver: receiverId,
      status: 'pending'
    });

    if (existingRequest) {
      throw Object.assign(new Error('Connection request already sent'), { status: 400 });
    }

    const previousRequest = await ConnectionRequest.findOne({
      sender: senderId,
      receiver: receiverId,
      status: 'rejected'
    });

    let request;
    if (previousRequest) {
      previousRequest.status = 'pending';
      previousRequest.createdAt = new Date();
      request = await previousRequest.save();
    } else {
      request = new ConnectionRequest({
        sender: senderId,
        receiver: receiverId
      });
      await request.save();
    }

    await notificationController.createNotification(
      receiverId,
      senderId,
      'connection_request',
      `${sender.username} sent you a connection request`,
      `/profile/${senderId}`
    );

    res.status(201).json(request);
  } catch (error) {
    logger.error('Send connection request error', { error: error.message });
    throw error;
  }
};

/**
 * Accepts a connection request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.acceptRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user._id;

    const request = await ConnectionRequest.findById(requestId);
    if (!request) {
      throw Object.assign(new Error('Request not found'), { status: 404 });
    }

    if (request.receiver.toString() !== userId.toString()) {
      throw Object.assign(new Error('Not authorized'), { status: 403 });
    }

    if (request.status !== 'pending') {
      throw Object.assign(new Error('Request already processed'), { status: 400 });
    }

    request.status = 'accepted';
    await request.save();

    await User.findByIdAndUpdate(request.sender, {
      $addToSet: { connections: request.receiver }
    });
    await User.findByIdAndUpdate(request.receiver, {
      $addToSet: { connections: request.sender }
    });

    const receiver = await User.findById(req.user._id);
    await notificationController.createNotification(
      request.sender,
      request.receiver,
      'connection_accepted',
      `${receiver.username} accepted your connection request`,
      `/profile/${receiver._id}`
    );

    res.json({ message: 'Connection request accepted' });
  } catch (error) {
    logger.error('Accept connection request error', { error: error.message });
    throw error;
  }
};

/**
 * Rejects a connection request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.rejectRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user._id;

    const request = await ConnectionRequest.findById(requestId);
    if (!request) {
      throw Object.assign(new Error('Request not found'), { status: 404 });
    }

    if (request.receiver.toString() !== userId.toString()) {
      throw Object.assign(new Error('Not authorized'), { status: 403 });
    }

    if (request.status !== 'pending') {
      throw Object.assign(new Error('Request already processed'), { status: 400 });
    }

    request.status = 'rejected';
    await request.save();

    res.json({ message: 'Connection request rejected' });
  } catch (error) {
    logger.error('Reject connection request error', { error: error.message });
    throw error;
  }
};

/**
 * Cancels a pending connection request sent by the user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.cancelRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      throw Object.assign(new Error('Invalid request ID'), { status: 400 });
    }

    const request = await ConnectionRequest.findById(requestId);
    if (!request) {
      throw Object.assign(new Error('Request not found'), { status: 404 });
    }

    if (request.sender.toString() !== userId.toString()) {
      throw Object.assign(new Error('Not authorized'), { status: 403 });
    }

    if (request.status !== 'pending') {
      throw Object.assign(new Error('Request already processed'), { status: 400 });
    }

    request.status = 'cancelled';
    await request.save();

    res.json({ message: 'Connection request cancelled' });
  } catch (error) {
    logger.error('Cancel connection request error', { error: error.message });
    throw error;
  }
};

/**
 * Retrieves pending connection requests for the user (sent or received)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.getPendingRequests = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const requests = await populateUserFields(
      ConnectionRequest.find({
        $and: [
          { status: 'pending' },
          { $or: [{ sender: userId }, { receiver: userId }] }
        ]
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
    );

    res.json(requests);
  } catch (error) {
    logger.error('Get pending requests error', { error: error.message });
    throw error;
  }
};
