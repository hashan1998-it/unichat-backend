const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header("Authorization");
    
    if (!authHeader) {
      return res.status(401).json({ message: "No token, authorization denied" });
    }
    
    const token = authHeader.replace("Bearer ", "");
    
    if (!token) {
      return res.status(401).json({ message: "No token, authorization denied" });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach user to request - handle both string and object IDs
    if (decoded.userId) {
      req.user = { _id: decoded.userId };
    } else if (decoded.id) {
      req.user = { _id: decoded.id };
    } else if (decoded._id) {
      req.user = { _id: decoded._id };
    } else {
      return res.status(401).json({ message: "Invalid token format" });
    }
    
    // Log for debugging
    console.log("Auth middleware - decoded:", decoded);
    console.log("Auth middleware - req.user set to:", req.user);
    
    next();
  } catch (error) {
    console.error("Auth error:", error);
    res.status(401).json({ message: "Token is not valid" });
  }
};