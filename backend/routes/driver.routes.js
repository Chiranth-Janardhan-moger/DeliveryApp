const express = require('express');
const router = express.Router();
const DeliveryBoy = require('../models/DeliveryBoy');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { broadcast } = require('../websocket/websocket');

// All driver routes require authentication and driver role
router.use(authenticate);
router.use(authorize('driver'));

// GET /api/driver/orders
router.get('/orders', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;

    // Show all orders (both available and assigned, but not delivered)
    const query = {
      deliveryStatus: { $nin: ['Delivered', 'delivered', 'Cancelled', 'cancelled'] }
    };

    const skip = (page - 1) * limit;
    
    const orders = await Order.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });
    
    const total = await Order.countDocuments(query);

    res.json({
      orders,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Get driver orders error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to get orders',
      code: 'GET_ORDERS_ERROR'
    });
  }
});

// POST /api/driver/orders/:orderId/take
router.post('/orders/:orderId/take', async (req, res) => {
  try {
    const { orderId } = req.params;
    const driverId = req.user.userId;

    const deliveryBoy = await DeliveryBoy.findOne({ userId: driverId });
    if (!deliveryBoy) {
      return res.status(404).json({
        error: true,
        message: 'Delivery boy profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        error: true,
        message: 'Order not found',
        code: 'ORDER_NOT_FOUND'
      });
    }

    // Check if order is already assigned
    if (order.assignedDeliveryBoy && order.assignedDeliveryBoy.id) {
      return res.status(400).json({
        error: true,
        message: 'Order already assigned to another delivery boy',
        code: 'ORDER_ALREADY_ASSIGNED'
      });
    }

    // Assign order to this delivery boy (store id as string for consistency)
    order.assignedDeliveryBoy = {
      id: deliveryBoy._id.toString(),
      name: deliveryBoy.name,
      phone: deliveryBoy.phone
    };
    order.deliveryStatus = 'Assigned';
    order.assignedAt = new Date();

    await order.save();

    // Broadcast to all clients that order was taken
    broadcast({
      type: 'ORDER_TAKEN',
      orderId: order._id,
      driverId: deliveryBoy._id.toString(),
      driverName: deliveryBoy.name
    });

    res.json({
      message: 'Order assigned successfully',
      order: {
        _id: order._id,
        orderId: order.orderId,
        customerName: order.customerName,
        deliveryStatus: order.deliveryStatus,
        assignedDeliveryBoy: order.assignedDeliveryBoy
      }
    });
  } catch (error) {
    console.error('Take order error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to take order',
      code: 'TAKE_ORDER_ERROR'
    });
  }
});

// GET /api/driver/orders/:orderId
router.get('/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const mongoose = require('mongoose');

    console.log('🔍 Looking for order with ID:', orderId);
    console.log('🔍 Is valid ObjectId:', mongoose.Types.ObjectId.isValid(orderId));

    // Check if orderId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      console.log('❌ Invalid ObjectId format');
      return res.status(400).json({
        error: true,
        message: 'Invalid order ID format',
        code: 'INVALID_ORDER_ID'
      });
    }

    // Find order by MongoDB _id
    const order = await Order.findById(orderId);

    console.log('📦 Found order:', order ? 'Yes' : 'No');
    if (order) {
      console.log('📦 Order details:', {
        _id: order._id,
        orderId: order.orderId,
        customerName: order.customerName
      });
    }

    if (!order) {
      return res.status(404).json({
        error: true,
        message: 'Order not found',
        code: 'ORDER_NOT_FOUND'
      });
    }

    res.json(order);
  } catch (error) {
    console.error('❌ Get driver order error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to get order',
      code: 'GET_ORDER_ERROR'
    });
  }
});

// POST /api/driver/orders/:orderId/confirm
router.post('/orders/:orderId/confirm', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { latitude, longitude, photo, notes } = req.body;
    const driverId = req.user.userId;

    const deliveryBoy = await DeliveryBoy.findOne({ userId: driverId });
    if (!deliveryBoy) {
      return res.status(404).json({
        error: true,
        message: 'Delivery boy profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    const order = await Order.findOne({
      orderId,
      'assignedDeliveryBoy.id': deliveryBoy._id
    });

    if (!order) {
      return res.status(404).json({
        error: true,
        message: 'Order not found',
        code: 'ORDER_NOT_FOUND'
      });
    }

    // Update order
    order.deliveryStatus = 'Delivered';
    order.paymentStatus = 'Completed';
    order.deliveredAt = new Date();
    order.deliveredBy = deliveryBoy.name;
    order.deliveryLocation = { latitude, longitude };
    if (photo) order.deliveryPhoto = photo;
    if (notes) order.deliveryNotes = notes;

    await order.save();

    // Update delivery boy stats
    deliveryBoy.completedDeliveries += 1;
    deliveryBoy.totalDeliveries += 1;
    await deliveryBoy.save();

    // Create transaction
    await Transaction.create({
      orderId: order.orderId,
      amount: order.totalAmount,
      paymentMode: order.paymentMode,
      paymentStatus: order.paymentStatus,
      driverId: deliveryBoy._id.toString(),
      customerId: order.customerName,
    });

    // Broadcast to admin via WebSocket
    broadcast({
      type: 'ORDER_DELIVERED',
      order: {
        orderId: order.orderId,
        deliveryStatus: order.deliveryStatus,
        paymentStatus: order.paymentStatus,
        deliveredAt: order.deliveredAt,
        deliveredBy: order.deliveredBy,
        latitude,
        longitude
      }
    });

    res.json({
      message: 'Delivery confirmed successfully',
      orderId: order.orderId,
      deliveryStatus: order.deliveryStatus,
      paymentStatus: order.paymentStatus,
      deliveredAt: order.deliveredAt
    });
  } catch (error) {
    console.error('Confirm delivery error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to confirm delivery',
      code: 'CONFIRM_DELIVERY_ERROR'
    });
  }
});

// PUT /api/driver/orders/:orderId/complete - Complete delivery with payment method
router.put('/orders/:orderId/complete', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { paymentMethod } = req.body;
    const driverId = req.user.userId;
    const mongoose = require('mongoose');

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        error: true,
        message: 'Invalid order ID format',
        code: 'INVALID_ORDER_ID'
      });
    }

    const deliveryBoy = await DeliveryBoy.findOne({ userId: driverId });
    if (!deliveryBoy) {
      return res.status(404).json({
        error: true,
        message: 'Delivery boy profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        error: true,
        message: 'Order not found',
        code: 'ORDER_NOT_FOUND'
      });
    }

    // Update order status
    order.deliveryStatus = 'Delivered';
    order.paymentStatus = 'Completed';
    order.paymentMode = paymentMethod || order.paymentMode;
    order.deliveredAt = new Date();
    order.deliveredBy = deliveryBoy.name;
    
    // Assign delivery boy if not already assigned (store id as string for consistency)
    if (!order.assignedDeliveryBoy || !order.assignedDeliveryBoy.id) {
      order.assignedDeliveryBoy = {
        id: deliveryBoy._id.toString(),
        name: deliveryBoy.name,
        phone: deliveryBoy.phone
      };
    }

    await order.save();

    // Update delivery boy stats
    deliveryBoy.completedDeliveries = (deliveryBoy.completedDeliveries || 0) + 1;
    deliveryBoy.totalDeliveries = (deliveryBoy.totalDeliveries || 0) + 1;
    await deliveryBoy.save();

    // Create transaction record
    await Transaction.create({
      orderId: order.orderId || order._id.toString(),
      amount: order.totalAmount,
      paymentMode: paymentMethod || order.paymentMode,
      paymentStatus: 'Completed',
      driverId: deliveryBoy._id.toString(),
      customerId: order.customerName,
    });

    // Broadcast to admin via WebSocket
    broadcast({
      type: 'ORDER_DELIVERED',
      order: {
        _id: order._id,
        orderId: order.orderId,
        deliveryStatus: order.deliveryStatus,
        paymentStatus: order.paymentStatus,
        paymentMode: paymentMethod,
        deliveredAt: order.deliveredAt,
        deliveredBy: order.deliveredBy
      }
    });

    res.json({
      message: 'Delivery confirmed successfully',
      order: {
        _id: order._id,
        orderId: order.orderId,
        deliveryStatus: order.deliveryStatus,
        paymentStatus: order.paymentStatus,
        deliveredAt: order.deliveredAt
      }
    });
  } catch (error) {
    console.error('❌ Complete delivery error:', error.message);
    console.error('❌ Full error:', error);
    res.status(500).json({
      error: true,
      message: `Failed to complete delivery: ${error.message}`,
      code: 'COMPLETE_DELIVERY_ERROR'
    });
  }
});

// POST /api/driver/orders/:orderId/validate-scan
router.post('/orders/:orderId/validate-scan', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { packageCode } = req.body;

    if (!packageCode) {
      return res.status(400).json({
        error: true,
        message: 'Package code is required',
        code: 'MISSING_PACKAGE_CODE'
      });
    }

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({
        error: true,
        message: 'Order not found',
        code: 'ORDER_NOT_FOUND'
      });
    }

    const isValid = packageCode.startsWith('PKG');

    res.json({
      valid: isValid,
      message: isValid ? 'Package verified' : 'Invalid package code'
    });
  } catch (error) {
    console.error('Validate scan error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to validate package',
      code: 'VALIDATE_SCAN_ERROR'
    });
  }
});

// GET /api/driver/history
router.get('/history', async (req, res) => {
  try {
    const { page = 1, limit = 20, startDate, endDate } = req.query;
    const driverId = req.user.userId;

    const deliveryBoy = await DeliveryBoy.findOne({ userId: driverId });
    if (!deliveryBoy) {
      return res.status(404).json({
        error: true,
        message: 'Delivery boy profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    // Query by delivery boy id (stored as string)
    const query = {
      'assignedDeliveryBoy.id': deliveryBoy._id.toString(),
      deliveryStatus: 'Delivered'
    };

    if (startDate || endDate) {
      query.deliveredAt = {};
      if (startDate) query.deliveredAt.$gte = new Date(startDate);
      if (endDate) query.deliveredAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    
    const orders = await Order.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ deliveredAt: -1 });
    
    const total = await Order.countDocuments(query);

    res.json({
      orders,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to get history',
      code: 'GET_HISTORY_ERROR'
    });
  }
});

// GET /api/driver/profile
router.get('/profile', async (req, res) => {
  try {
    const driverId = req.user.userId;

    const deliveryBoy = await DeliveryBoy.findOne({ userId: driverId });
    if (!deliveryBoy) {
      return res.status(404).json({
        error: true,
        message: 'Delivery boy profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    res.json(deliveryBoy);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to get profile',
      code: 'GET_PROFILE_ERROR'
    });
  }
});

// PUT /api/driver/profile
router.put('/profile', async (req, res) => {
  try {
    const driverId = req.user.userId;
    const { name, phone, email } = req.body;

    const deliveryBoy = await DeliveryBoy.findOne({ userId: driverId });
    if (!deliveryBoy) {
      return res.status(404).json({
        error: true,
        message: 'Delivery boy profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    const User = require('../models/User');
    const user = await User.findById(driverId);
    if (!user) {
      return res.status(404).json({
        error: true,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    if (name) {
      deliveryBoy.name = name;
      user.name = name;
    }
    if (phone) {
      deliveryBoy.phone = phone;
      user.phone = phone;
    }
    if (email) {
      user.email = email;
    }

    await deliveryBoy.save();
    await user.save();

    res.json(deliveryBoy);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to update profile',
      code: 'UPDATE_PROFILE_ERROR'
    });
  }
});

// POST /api/driver/location - Update driver location (every 30 seconds from app)
router.post('/location', async (req, res) => {
  try {
    const { latitude, longitude, accuracy } = req.body;
    const driverId = req.user.userId;

    if (!latitude || !longitude) {
      return res.status(400).json({
        error: true,
        message: 'Latitude and longitude are required',
        code: 'MISSING_LOCATION'
      });
    }

    // Filter out very inaccurate locations (> 200m)
    if (accuracy && accuracy > 200) {
      return res.status(400).json({
        error: true,
        message: 'Location accuracy too low',
        code: 'LOW_ACCURACY'
      });
    }

    const deliveryBoy = await DeliveryBoy.findOne({ userId: driverId });
    if (!deliveryBoy) {
      return res.status(404).json({
        error: true,
        message: 'Delivery boy profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    // Update location in database
    const locationData = {
      latitude,
      longitude,
      accuracy: accuracy || null,
      updatedAt: new Date()
    };
    deliveryBoy.lastLocation = locationData;
    await deliveryBoy.save();

    // Broadcast location to all tracking admin clients via WebSocket
    const { sendToTrackingAdmins, broadcast } = require('../websocket/websocket');
    const locationUpdate = {
      type: 'DRIVER_LOCATION_UPDATE',
      driverId: deliveryBoy._id,
      driverName: deliveryBoy.name,
      location: locationData
    };
    
    // Send to tracking admins first (priority) - real-time update
    sendToTrackingAdmins(locationUpdate);
    
    // Also broadcast to all clients (for any page that might need it)
    broadcast(locationUpdate);

    res.json({
      message: 'Location updated successfully',
      location: locationData
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to update location',
      code: 'UPDATE_LOCATION_ERROR'
    });
  }
});

// POST /api/driver/fcm-token - Register FCM token for push notifications
router.post('/fcm-token', async (req, res) => {
  try {
    const { fcmToken } = req.body;
    const driverId = req.user.userId;

    if (!fcmToken) {
      return res.status(400).json({
        error: true,
        message: 'FCM token is required',
        code: 'MISSING_TOKEN'
      });
    }

    const deliveryBoy = await DeliveryBoy.findOne({ userId: driverId });
    if (!deliveryBoy) {
      return res.status(404).json({
        error: true,
        message: 'Delivery boy profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    deliveryBoy.fcmToken = fcmToken;
    await deliveryBoy.save();

    console.log(`📱 FCM token registered for ${deliveryBoy.name}`);

    res.json({
      message: 'FCM token registered successfully'
    });
  } catch (error) {
    console.error('Register FCM token error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to register FCM token',
      code: 'FCM_TOKEN_ERROR'
    });
  }
});

module.exports = router;
