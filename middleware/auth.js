const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  try {
    const token = req.header("Authorization").replace("Bearer ", "");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded.userId;
    next();
  } catch (error) {
    console.error("Auth error:", error); // Add logging
    res.status(401).json({ message: "Authentication failed" });
  }
};
