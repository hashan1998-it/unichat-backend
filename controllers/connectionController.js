const ConnectionRequest = require('../models/ConnectionRequest');
const User = require('../models/User');
const notificationController = require('./notificationController');

// Helper function to get user ID
const getUserId = (req) => {
    return req.user?._id || req.user;
};

// Send a connection request
exports.sendRequest = async (req, res) => {
    try {
        const { receiverId } = req.params;
        const senderId = getUserId(req);

        console.log('Connection request - Sender:', senderId, 'Receiver:', receiverId);

        // Check if receiver exists
        const receiver = await User.findById(receiverId);
        if (!receiver) {
            console.log('Receiver not found:', receiverId);
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if users are already connected
        const sender = await User.findById(senderId);
        if (sender.connections?.includes(receiverId)) {
            console.log('Users already connected');
            return res.status(400).json({ message: 'Users are already connected' });
        }

        // Check if request already exists
        const existingRequest = await ConnectionRequest.findOne({
            sender: senderId,
            receiver: receiverId,
            status: 'pending'
        });

        if (existingRequest) {
            console.log('Request already exists:', existingRequest._id);
            return res.status(400).json({ message: 'Connection request already sent' });
        }

        // Check if there was a previously rejected request
        const previousRequest = await ConnectionRequest.findOne({
            sender: senderId,
            receiver: receiverId,
            status: 'rejected'
        });

        let request;
        if (previousRequest) {
            // Update the previous request to pending
            previousRequest.status = 'pending';
            previousRequest.createdAt = new Date();
            request = await previousRequest.save();
            console.log('Updated previous request:', request._id);
        } else {
            // Create new request
            request = new ConnectionRequest({
                sender: senderId,
                receiver: receiverId
            });
            console.log('Creating new request:', request);
            await request.save();
        }

        // Create notification for receiver
        await notificationController.createNotification(
            receiverId,
            senderId,
            'connection_request',
            `${sender.username} sent you a connection request`,
            `/profile/${senderId}`
        );

        console.log('Request saved successfully');

        // Return the populated request
        const populatedRequest = await ConnectionRequest.findById(request._id)
            .populate('sender', 'username profilePicture')
            .populate('receiver', 'username profilePicture');

        res.status(201).json(populatedRequest);
    } catch (error) {
        console.error('Error in sendRequest:', error);
        res.status(500).json({ 
            message: 'Server error',
            error: error.message 
        });
    }
};

// Accept a connection request
exports.acceptRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const userId = getUserId(req);

        const request = await ConnectionRequest.findById(requestId)
            .populate('sender', 'username profilePicture')
            .populate('receiver', 'username profilePicture');
            
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        if (request.receiver._id.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (request.status !== 'pending') {
            return res.status(400).json({ message: 'Request already processed' });
        }

        // Update request status
        request.status = 'accepted';
        await request.save();

        // Add users to each other's connections
        await User.findByIdAndUpdate(request.sender._id, {
            $addToSet: { connections: request.receiver._id }
        });
        await User.findByIdAndUpdate(request.receiver._id, {
            $addToSet: { connections: request.sender._id }
        });

        // Create notification for sender
        await notificationController.createNotification(
            request.sender._id,
            request.receiver._id,
            'connection_accepted',
            `${request.receiver.username} accepted your connection request`,
            `/profile/${request.receiver._id}`
        );

        res.json({ message: 'Connection request accepted' });
    } catch (error) {
        console.error('Error accepting connection request:', error);
        res.status(500).json({ message: 'Error accepting connection request' });
    }
};

// Get pending requests
exports.getPendingRequests = async (req, res) => {
    try {
        const userId = getUserId(req);
        console.log('Getting pending requests for user:', userId);

        if (!userId) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        const requests = await ConnectionRequest.find({
            receiver: userId,
            status: 'pending'
        }).populate({
            path: 'sender',
            select: 'username universityId profilePicture email role',
            model: 'User'
        });

        console.log('Found pending requests:', requests.length);
        res.json(requests || []);
    } catch (error) {
        console.error('Error in getPendingRequests:', error);
        res.status(500).json({ 
            message: 'Server error while fetching pending requests',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// Reject a connection request
exports.rejectRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const userId = getUserId(req);

        const request = await ConnectionRequest.findById(requestId);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        if (request.receiver.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (request.status !== 'pending') {
            return res.status(400).json({ message: 'Request already processed' });
        }

        request.status = 'rejected';
        await request.save();

        res.json({ message: 'Connection request rejected' });
    } catch (error) {
        console.error('Error rejecting connection request:', error);
        res.status(500).json({ message: 'Error rejecting connection request' });
    }
};

// Cancel a connection request (by sender)
exports.cancelRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const userId = getUserId(req);

        const request = await ConnectionRequest.findById(requestId);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        if (request.sender.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        await request.remove();

        res.json({ message: 'Connection request cancelled' });
    } catch (error) {
        console.error('Error cancelling connection request:', error);
        res.status(500).json({ message: 'Error cancelling connection request' });
    }
};