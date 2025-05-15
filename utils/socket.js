const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');

module.exports = (server, corsOptions) => {
  const io = socketIO(server, {
    cors: corsOptions
  });
  
  // Authentication middleware for socket
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (token) {
      jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
          return next(new Error('Authentication error'));
        }
        socket.userId = decoded.userId;
        next();
      });
    } else {
      next(new Error('Authentication error'));
    }
  });
  
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id, 'User ID:', socket.userId);
    
    // Join user to their own room
    if (socket.userId) {
      socket.join(socket.userId.toString());
      console.log(`User ${socket.userId} joined their room`);
    }
    
    // Handle notifications
    socket.on('notification', (data) => {
      console.log('Notification received:', data);
      io.to(data.receiverId.toString()).emit('newNotification', data);
    });
    
    // Handle new comments
    socket.on('newComment', (data) => {
      console.log('New comment:', data);
      io.emit('new-comment', data);
    });
    
    // Handle post updates
    socket.on('postUpdate', (data) => {
      console.log('Post update:', data);
      io.emit('post-updated', data);
    });
    
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
  
  return io;
};