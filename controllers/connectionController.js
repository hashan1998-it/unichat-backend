const ConnectionRequest = require('../models/ConnectionRequest');
const User = require('../models/User');
const notificationController = require('./notificationController');

// Send a connection request
exports.sendRequest = async (req, res) => {
    try {
        const { receiverId } = req.params;
        const senderId = req.user._id;

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

        res.status(201).json(request);
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
        const userId = req.user._id;

        const request = await ConnectionRequest.findById(requestId);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        if (request.receiver.toString() !== userId) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (request.status !== 'pending') {
            return res.status(400).json({ message: 'Request already processed' });
        }

        // Update request status
        request.status = 'accepted';
        await request.save();

        // Add users to each other's connections
        await User.findByIdAndUpdate(request.sender, {
            $addToSet: { connections: request.receiver }
        });
        await User.findByIdAndUpdate(request.receiver, {
            $addToSet: { connections: request.sender }
        });

        // Create notification for sender
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
        console.error('Error accepting connection request:', error);
        res.status(500).json({ message: 'Error accepting connection request' });
    }
};

// Get pending requests
exports.getPendingRequests = async (req, res) => {
    try {
        const userId = req.user._id;
        console.log('Getting pending requests for user:', userId);

        // First verify the user exists
        const user = await User.findById(userId);
        if (!user) {
            console.log('User not found:', userId);
            return res.status(404).json({ message: 'User not found' });
        }

        const requests = await ConnectionRequest.find({
            receiver: userId,
            status: 'pending'
        }).populate({
            path: 'sender',
            select: 'username universityId profilePicture',
            model: 'User'
        });

        console.log('Found pending requests:', requests.length);
        res.json(requests);
    } catch (error) {
        console.error('Error in getPendingRequests:', error);
        // Send more detailed error information
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
        const userId = req.user._id;

        const request = await ConnectionRequest.findById(requestId);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        if (request.receiver.toString() !== userId) {
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