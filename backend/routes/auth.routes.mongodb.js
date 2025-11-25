const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth.middleware');
const { loginLimiter } = require('../middleware/rateLimiter');
const { isEmailOrPhone } = require('../utils/helpers');

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;

    if (!emailOrPhone || !password) {
      return res.status(400).json({
        error: true,
        message: 'Email/Phone and password are required',
        code: 'MISSING_CREDENTIALS'
      });
    }

    const loginType = isEmailOrPhone(emailOrPhone);
    if (!loginType) {
      return res.status(400).json({
        error: true,
        message: 'Invalid email or phone format',
        code: 'INVALID_FORMAT'
      });
    }

    // Find user by email or phone
    const user = await User.findOne(
      loginType === 'email' ? { email: emailOrPhone } : { phone: emailOrPhone }
    );

    if (!user) {
      return res.status(401).json({
        error: true,
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: true,
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(403).json({
        error: true,
        message: 'Account is inactive',
        code: 'ACCOUNT_INACTIVE'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    const refreshToken = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
    );

    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
    };

    res.json({
      user: userResponse,
      token,
      refreshToken
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: true,
      message: 'Login failed',
      code: 'LOGIN_ERROR'
    });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        error: true,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to get user',
      code: 'GET_USER_ERROR'
    });
  }
});

// POST /api/auth/refresh-token
router.post('/refresh-token', async (req, res) => {
  try {
    const { token: refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: true,
        message: 'Refresh token is required',
        code: 'MISSING_TOKEN'
      });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    // Check if user still exists
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        error: true,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Generate new tokens
    const newToken = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    const newRefreshToken = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
    );

    res.json({
      token: newToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({
      error: true,
      message: 'Invalid or expired refresh token',
      code: 'INVALID_REFRESH_TOKEN'
    });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        error: true,
        message: 'Token and password are required',
        code: 'MISSING_FIELDS'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({
        error: true,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    await user.save();

    res.json({
      message: 'Password reset successful'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(400).json({
      error: true,
      message: 'Invalid or expired reset token',
      code: 'INVALID_RESET_TOKEN'
    });
  }
});

module.exports = router;
