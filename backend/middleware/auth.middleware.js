const jwt = require('jsonwebtoken');
const { invalidatedTokens } = require('../config/database');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: true,
        message: 'No token provided',
        code: 'NO_TOKEN'
      });
    }

    const token = authHeader.substring(7);

    // Check if token is invalidated
    if (invalidatedTokens.has(token)) {
      return res.status(401).json({
        error: true,
        message: 'Token has been invalidated',
        code: 'TOKEN_INVALIDATED'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user still exists
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        error: true,
        message: 'User no longer exists',
        code: 'USER_NOT_FOUND'
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      error: true,
      message: 'Invalid or expired token',
      code: 'INVALID_TOKEN'
    });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: true,
        message: 'Unauthorized',
        code: 'UNAUTHORIZED'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: true,
        message: 'Forbidden - Insufficient permissions',
        code: 'FORBIDDEN'
      });
    }

    next();
  };
};

module.exports = { authenticate, authorize };
