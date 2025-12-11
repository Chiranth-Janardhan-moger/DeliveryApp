const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const DeliveryBoy = require('../models/DeliveryBoy');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const Address = require('../models/Address');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { generateOrderId } = require('../utils/helpers');
const { broadcastToDrivers, sendToUser } = require('../websocket/websocket');
const { syncOrdersToSheet } = require('../utils/googleSheets');
const { sendLocationRequestToAll } = require('../utils/firebase');

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize('admin'));

// POST /api/admin/change-password - Change admin password
router.post('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: true,
        message: 'Current password and new password are required',
        code: 'MISSING_FIELDS'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: true,
        message: 'New password must be at least 6 characters',
        code: 'PASSWORD_TOO_SHORT'
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        error: true,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        error: true,
        message: 'Current password is incorrect',
        code: 'INVALID_PASSWORD'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to change password',
      code: 'CHANGE_PASSWORD_ERROR'
    });
  }
});

// GET /api/admin/addresses/search - Search saved addresses
router.get('/addresses/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json({ addresses: [] });
    }

    const addresses = await Address.find({
      address: { $regex: q, $options: 'i' }
    })
    .sort({ usageCount: -1 })
    .limit(10);

    res.json({ addresses: addresses.map(a => a.address) });
  } catch (error) {
    console.error('Search addresses error:', error);
    res.status(500).json({ error: true, message: 'Failed to search addresses' });
  }
});

// POST /api/admin/addresses - Save a new address
router.post('/addresses', async (req, res) => {
  try {
    const { address } = req.body;
    if (!address || address.trim().length < 5) {
      return res.json({ saved: false });
    }

    const trimmedAddress = address.trim();
    
    // Try to find existing address and increment usage
    const existing = await Address.findOne({ address: trimmedAddress });
    if (existing) {
      existing.usageCount += 1;
      await existing.save();
      return res.json({ saved: true, existing: true });
    }

    // Create new address
    await Address.create({ address: trimmedAddress });
    res.json({ saved: true, existing: false });
  } catch (error) {
    console.error('Save address error:', error);
    res.json({ saved: false });
  }
});

// GET /api/admin/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ deliveryStatus: 'Pending' });
    const deliveredOrders = await Order.countDocuments({ deliveryStatus: 'Delivered' });
    
    const revenueResult = await Order.aggregate([
      { $match: { paymentStatus: 'Completed' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;
    
    const totalDeliveryBoys = await DeliveryBoy.countDocuments();

    res.json({
      totalOrders,
      pendingOrders,
      deliveredOrders,
      totalRevenue,
      totalDeliveryBoys
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to get dashboard data',
      code: 'DASHBOARD_ERROR'
    });
  }
});

// POST /api/admin/orders
router.post('/orders', async (req, res) => {
  try {
    console.log('📝 Creating order with data:', req.body);
    
    const { customerName, customerPhone, items, deliveryAddress, totalAmount, paymentMode } = req.body;

    if (!customerName || !customerPhone || !items || !deliveryAddress || !totalAmount || !paymentMode) {
      console.log('❌ Missing required fields');
      return res.status(400).json({
        error: true,
        message: 'All fields are required',
        code: 'MISSING_FIELDS'
      });
    }

    console.log('✅ All required fields present, creating order...');

    const orderData = {
      orderId: generateOrderId(),
      customerName,
      customerPhone,
      items,
      deliveryAddress,
      totalAmount,
      paymentMode,
      paymentStatus: paymentMode === 'Paid' ? 'Completed' : 'Pending',
      deliveryStatus: 'Pending',
    };

    console.log('📦 Order data to save:', orderData);

    const newOrder = await Order.create(orderData);
    console.log('✅ Order created successfully:', newOrder.orderId);

    // Try to broadcast to delivery boys (don't fail if WebSocket fails)
    try {
      broadcastToDrivers({
        type: 'ORDER_CREATED',
        order: newOrder
      });
      console.log('📡 Order broadcast to delivery boys');
    } catch (wsError) {
      console.warn('⚠️ WebSocket broadcast failed:', wsError.message);
      // Continue anyway - order was created successfully
    }

    res.status(201).json({
      ...newOrder.toObject(),
      message: 'Order created successfully'
    });
  } catch (error) {
    console.error('❌ Create order error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      error: true,
      message: `Failed to create order: ${error.message}`,
      code: 'CREATE_ORDER_ERROR'
    });
  }
});

// GET /api/admin/orders
router.get('/orders', async (req, res) => {
  try {
    const { page = 1, limit = 10, status, paymentStatus, startDate, endDate } = req.query;
    
    const query = {};
    if (status) query.deliveryStatus = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

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
    console.error('Get orders error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to get orders',
      code: 'GET_ORDERS_ERROR'
    });
  }
});

// GET /api/admin/orders/:orderId
router.get('/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({
        error: true,
        message: 'Order not found',
        code: 'ORDER_NOT_FOUND'
      });
    }

    res.json(order);
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to get order',
      code: 'GET_ORDER_ERROR'
    });
  }
});

// GET /api/admin/delivery-boys
router.get('/delivery-boys', async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const query = {};
    if (status) query.status = status;

    const skip = (page - 1) * limit;
    
    const deliveryBoys = await DeliveryBoy.find(query)
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await DeliveryBoy.countDocuments(query);

    res.json({
      deliveryBoys,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Get delivery boys error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to get delivery boys',
      code: 'GET_DELIVERY_BOYS_ERROR'
    });
  }
});

// GET /api/admin/drivers-status - Debug endpoint to check driver FCM and location status
router.get('/drivers-status', async (req, res) => {
  try {
    const deliveryBoys = await DeliveryBoy.find({});
    
    const status = deliveryBoys.map(d => ({
      name: d.name,
      phone: d.phone,
      status: d.status,
      hasFcmToken: !!d.fcmToken,
      fcmTokenPreview: d.fcmToken ? d.fcmToken.substring(0, 20) + '...' : null,
      hasLocation: !!d.lastLocation,
      lastLocation: d.lastLocation ? {
        lat: d.lastLocation.latitude,
        lng: d.lastLocation.longitude,
        updatedAt: d.lastLocation.updatedAt,
        ageMinutes: d.lastLocation.updatedAt 
          ? Math.round((Date.now() - new Date(d.lastLocation.updatedAt).getTime()) / 60000)
          : null
      } : null
    }));

    res.json({
      totalDrivers: deliveryBoys.length,
      withFcmToken: deliveryBoys.filter(d => d.fcmToken).length,
      withLocation: deliveryBoys.filter(d => d.lastLocation).length,
      drivers: status
    });
  } catch (error) {
    console.error('Drivers status error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

// POST /api/admin/request-locations - Send push notification to all drivers to get their location
router.post('/request-locations', async (req, res) => {
  try {
    // Get all active delivery boys with FCM tokens
    const deliveryBoys = await DeliveryBoy.find({ 
      status: 'active',
      fcmToken: { $ne: null }
    });

    console.log(`📍 Found ${deliveryBoys.length} drivers with FCM tokens`);

    const fcmTokens = deliveryBoys
      .map(d => d.fcmToken)
      .filter(token => token);

    if (fcmTokens.length === 0) {
      console.log('📍 No drivers with FCM tokens found');
      return res.json({
        message: 'No drivers with push notifications enabled',
        sent: 0
      });
    }

    console.log(`📍 Sending FCM to ${fcmTokens.length} tokens`);

    // Send push notification to all drivers
    const result = await sendLocationRequestToAll(fcmTokens);

    console.log(`📍 FCM result: ${result?.successCount || 0} success, ${result?.failureCount || 0} failed`);

    res.json({
      message: `Location request sent to ${result?.successCount || 0} drivers`,
      sent: result?.successCount || 0,
      failed: result?.failureCount || 0,
      total: fcmTokens.length
    });
  } catch (error) {
    console.error('Request locations error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to request locations',
      code: 'REQUEST_LOCATIONS_ERROR'
    });
  }
});

// POST /api/admin/delivery-boys
router.post('/delivery-boys', async (req, res) => {
  try {
    const { name, phone } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        error: true,
        message: 'Name and phone are required',
        code: 'MISSING_FIELDS'
      });
    }

    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({
        error: true,
        message: 'Phone number already exists',
        code: 'PHONE_EXISTS'
      });
    }

    const defaultPassword = process.env.DEFAULT_PASSWORD || '123456';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    const newUser = await User.create({
      name,
      phone,
      email: `${phone}@dsk.com`,
      password: hashedPassword,
      role: 'driver',
      status: 'active',
    });

    const newDeliveryBoy = await DeliveryBoy.create({
      userId: newUser._id,
      name,
      phone,
      status: 'active',
      totalDeliveries: 0,
      completedDeliveries: 0,
      averageRating: 0,
    });

    res.status(201).json({
      id: newDeliveryBoy._id,
      userId: newUser._id,
      name: newDeliveryBoy.name,
      phone: newDeliveryBoy.phone,
      status: newDeliveryBoy.status,
      totalDeliveries: 0,
      completedDeliveries: 0,
      averageRating: 0,
      defaultPassword,
      message: `Delivery boy created. Share credentials with driver: username=${phone}, password=${defaultPassword}`
    });
  } catch (error) {
    console.error('Create delivery boy error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to create delivery boy',
      code: 'CREATE_DELIVERY_BOY_ERROR'
    });
  }
});

// DELETE /api/admin/delivery-boys/:id
router.delete('/delivery-boys/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const deliveryBoy = await DeliveryBoy.findById(id);
    if (!deliveryBoy) {
      return res.status(404).json({
        error: true,
        message: 'Delivery boy not found',
        code: 'NOT_FOUND'
      });
    }

    // Delete the associated user account
    if (deliveryBoy.userId) {
      await User.findByIdAndDelete(deliveryBoy.userId);
    }

    // Delete the delivery boy
    await DeliveryBoy.findByIdAndDelete(id);

    res.json({
      message: 'Delivery boy deleted successfully'
    });
  } catch (error) {
    console.error('Delete delivery boy error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to delete delivery boy',
      code: 'DELETE_DELIVERY_BOY_ERROR'
    });
  }
});

// GET /api/admin/history - Get all delivered orders (history from all delivery boys)
router.get('/history', async (req, res) => {
  try {
    const { page = 1, limit = 20, startDate, endDate, deliveryBoyId } = req.query;
    
    const query = {
      deliveryStatus: 'Delivered'
    };

    // Filter by date range
    if (startDate || endDate) {
      query.deliveredAt = {};
      if (startDate) query.deliveredAt.$gte = new Date(startDate);
      if (endDate) query.deliveredAt.$lte = new Date(endDate);
    }

    // Filter by specific delivery boy (stored as string)
    if (deliveryBoyId) {
      query['assignedDeliveryBoy.id'] = deliveryBoyId;
    }

    const skip = (page - 1) * limit;
    
    const orders = await Order.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ deliveredAt: -1 });
    
    const total = await Order.countDocuments(query);

    // Calculate total revenue from filtered orders
    const revenueResult = await Order.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

    res.json({
      orders,
      total,
      totalRevenue,
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

// GET /api/admin/revenue
router.get('/revenue', async (req, res) => {
  try {
    const { period = 'all' } = req.query;
    
    let dateFilter = {};
    const now = new Date();
    
    if (period === 'today') {
      const startOfDay = new Date(now.setHours(0, 0, 0, 0));
      dateFilter = { deliveredAt: { $gte: startOfDay } };
    } else if (period === 'week') {
      const startOfWeek = new Date(now.setDate(now.getDate() - 7));
      dateFilter = { deliveredAt: { $gte: startOfWeek } };
    } else if (period === 'month') {
      const startOfMonth = new Date(now.setDate(now.getDate() - 30));
      dateFilter = { deliveredAt: { $gte: startOfMonth } };
    }

    // Get total revenue
    const revenueResult = await Order.aggregate([
      { $match: { paymentStatus: 'Completed', ...dateFilter } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

    // Get payment methods breakdown
    const paymentMethodsResult = await Order.aggregate([
      { $match: { paymentStatus: 'Completed', ...dateFilter } },
      { $group: { _id: '$paymentMode', total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
    ]);
    
    const paymentMethods = {};
    paymentMethodsResult.forEach(pm => {
      paymentMethods[pm._id] = { total: pm.total, count: pm.count };
    });

    // Get chart data (last 7 days)
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const startOfDay = new Date(date.setHours(0, 0, 0, 0));
      const endOfDay = new Date(date.setHours(23, 59, 59, 999));
      
      const dayRevenue = await Order.aggregate([
        { $match: { paymentStatus: 'Completed', deliveredAt: { $gte: startOfDay, $lte: endOfDay } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]);
      
      chartData.push({
        date: startOfDay.toISOString().split('T')[0],
        revenue: dayRevenue.length > 0 ? dayRevenue[0].total : 0
      });
    }

    res.json({
      totalRevenue,
      period,
      paymentMethods,
      chartData
    });
  } catch (error) {
    console.error('Get revenue error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to get revenue data',
      code: 'GET_REVENUE_ERROR'
    });
  }
});

// POST /api/admin/sync-to-sheet - Sync orders to Google Sheets
router.post('/sync-to-sheet', async (req, res) => {
  try {
    const { date } = req.body;
    const syncDate = date ? new Date(date) : new Date();
    
    // Get start and end of the day
    const startOfDay = new Date(syncDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(syncDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all orders for the day
    const orders = await Order.find({
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    }).sort({ createdAt: 1 });

    if (orders.length === 0) {
      return res.json({
        message: 'No orders found for this date',
        ordersCount: 0,
        synced: false
      });
    }

    // Sync to Google Sheets
    const result = await syncOrdersToSheet(orders, syncDate);

    res.json({
      message: `Successfully synced ${result.ordersCount} orders to Google Sheets`,
      ordersCount: result.ordersCount,
      rowsAdded: result.rowsAdded,
      synced: true
    });
  } catch (error) {
    console.error('Sync to sheet error:', error);
    res.status(500).json({
      error: true,
      message: error.message || 'Failed to sync to Google Sheets',
      code: 'SYNC_ERROR'
    });
  }
});

// DELETE /api/admin/delete-all-data - Delete all orders and transactions (keeps addresses)
router.delete('/delete-all-data', async (req, res) => {
  try {
    const { confirmDelete } = req.body;
    
    if (confirmDelete !== 'DELETE_ALL_DATA') {
      return res.status(400).json({
        error: true,
        message: 'Please confirm deletion by sending confirmDelete: "DELETE_ALL_DATA"',
        code: 'CONFIRMATION_REQUIRED'
      });
    }

    // Delete all orders
    const ordersDeleted = await Order.deleteMany({});
    
    // Delete all transactions
    const transactionsDeleted = await Transaction.deleteMany({});
    
    // NOTE: Addresses are NOT deleted - they are kept for future use

    res.json({
      message: 'All orders and transactions deleted successfully',
      deleted: {
        orders: ordersDeleted.deletedCount,
        transactions: transactionsDeleted.deletedCount
      }
    });
  } catch (error) {
    console.error('Delete all data error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to delete all data',
      code: 'DELETE_ALL_ERROR'
    });
  }
});

module.exports = router;