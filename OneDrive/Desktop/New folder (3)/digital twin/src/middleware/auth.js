const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function optionalAuth(req, res, next) {
  try {
    const token = req.header("authorization")?.replace("Bearer ", "");
    if (!token) return next();
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    const user = await User.findById(payload.userId).select("-passwordHash");
    if (user) req.user = user;
    return next();
  } catch (error) {
    return next();
  }
}

async function requireAuth(req, res, next) {
  try {
    const token = req.header("authorization")?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ message: "Authentication required." });
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    const user = await User.findById(payload.userId).select("-passwordHash");
    if (!user) return res.status(401).json({ message: "Invalid token." });
    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Authentication required." });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Insufficient permissions." });
    }
    return next();
  };
}

module.exports = { optionalAuth, requireAuth, requireRole };
