const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');

// All order routes require authentication
router.use(authenticate);

// GET /api/orders/:orderId
router.get('/:orderId', (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    const order = db.orders.find(o => o.orderId === orderId);

    if (!order) {
      return res.status(404).json({
        error: true,
        message: 'Order not found',
        code: 'ORDER_NOT_FOUND'
      });
    }

    // Admin can see all orders
    if (userRole === 'admin') {
      return res.json(order);
    }

    // Driver can only see their assigned orders
    if (userRole === 'driver') {
      const deliveryBoy = db.deliveryBoys.find(db => db.userId === userId);
      if (!deliveryBoy) {
        return res.status(403).json({
          error: true,
          message: 'Forbidden',
          code: 'FORBIDDEN'
        });
      }

      if (!order.assignedDeliveryBoy || order.assignedDeliveryBoy.id !== deliveryBoy.id) {
        return res.status(403).json({
          error: true,
          message: 'Forbidden - Order not assigned to you',
          code: 'FORBIDDEN'
        });
      }

      return res.json(order);
    }

    res.status(403).json({
      error: true,
      message: 'Forbidden',
      code: 'FORBIDDEN'
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to get order',
      code: 'GET_ORDER_ERROR'
    });
  }
});

// PUT /api/orders/:orderId/status
router.put('/:orderId/status', (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const userRole = req.user.role;

    // Only admin can update order status
    if (userRole !== 'admin') {
      return res.status(403).json({
        error: true,
        message: 'Forbidden - Admin only',
        code: 'FORBIDDEN'
      });
    }

    const order = db.orders.find(o => o.orderId === orderId);
    if (!order) {
      return res.status(404).json({
        error: true,
        message: 'Order not found',
        code: 'ORDER_NOT_FOUND'
      });
    }

    const validStatuses = ['pending', 'in_transit', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: true,
        message: 'Invalid status',
        code: 'INVALID_STATUS'
      });
    }

    order.deliveryStatus = status;
    order.statusUpdatedAt = new Date().toISOString();

    res.json(order);
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to update order status',
      code: 'UPDATE_STATUS_ERROR'
    });
  }
});

module.exports = router;
