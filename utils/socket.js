const socketIO = require('socket.io');

module.exports = (server) => {
  const io = socketIO(server, {
    cors: {
      origin: "http://localhost:5173", // Your React frontend URL
      methods: ["GET", "POST"],
      credentials: true
    }
  });
  
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    socket.on('join', (userId) => {
      socket.join(userId);
    });
    
    socket.on('notification', (data) => {
      io.to(data.receiverId).emit('newNotification', data);
    });
    
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
  
  return io;
};