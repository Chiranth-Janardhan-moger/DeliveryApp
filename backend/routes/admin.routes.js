const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { generateId, generateOrderId, sanitizeUser } = require('../utils/helpers');
const { broadcastToDrivers, sendToUser } = require('../websocket/websocket');

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize('admin'));

// GET /api/admin/dashboard
router.get('/dashboard', (req, res) => {
  try {
    const totalOrders = db.orders.length;
    const pendingOrders = db.orders.filter(o => o.deliveryStatus === 'Pending').length;
    const deliveredOrders = db.orders.filter(o => o.deliveryStatus === 'Delivered').length;
    const totalRevenue = db.orders
      .filter(o => o.paymentStatus === 'Completed')
      .reduce((sum, o) => sum + o.totalAmount, 0);
    const totalDeliveryBoys = db.deliveryBoys.length;

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

// GET /api/admin/users
router.get('/users', (req, res) => {
  try {
    const { page = 1, limit = 10, role, status } = req.query;
    
    let filteredUsers = [...db.users];
    
    if (role) {
      filteredUsers = filteredUsers.filter(u => u.role === role);
    }
    
    if (status) {
      filteredUsers = filteredUsers.filter(u => u.status === status);
    }

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

    res.json({
      users: paginatedUsers.map(sanitizeUser),
      total: filteredUsers.length,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to get users',
      code: 'GET_USERS_ERROR'
    });
  }
});

// POST /api/admin/users/admin
router.post('/users/admin', async (req, res) => {
  try {
    const { name, phone } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        error: true,
        message: 'Name and phone are required',
        code: 'MISSING_FIELDS'
      });
    }

    // Check if phone already exists
    const existingUser = db.users.find(u => u.phone === phone);
    if (existingUser) {
      return res.status(400).json({
        error: true,
        message: 'Phone number already exists',
        code: 'PHONE_EXISTS'
      });
    }

    const defaultPassword = process.env.DEFAULT_PASSWORD || '123456';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    const newAdmin = {
      id: generateId('admin_'),
      name,
      phone,
      email: `${phone}@dsk.com`,
      password: hashedPassword,
      role: 'admin',
      status: 'active',
      createdAt: new Date().toISOString(),
      lastLogin: null
    };

    db.users.push(newAdmin);

    res.status(201).json({
      ...sanitizeUser(newAdmin),
      defaultPassword,
      message: `Admin created. Share credentials: username=${phone}, password=${defaultPassword}`
    });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to create admin',
      code: 'CREATE_ADMIN_ERROR'
    });
  }
});

// DELETE /api/admin/users/:userId
router.delete('/users/:userId', (req, res) => {
  try {
    const { userId } = req.params;

    const userIndex = db.users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      return res.status(404).json({
        error: true,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const user = db.users[userIndex];
    
    // Remove user
    db.users.splice(userIndex, 1);

    // If delivery boy, remove from deliveryBoys
    if (user.role === 'driver') {
      const dbIndex = db.deliveryBoys.findIndex(db => db.userId === userId);
      if (dbIndex !== -1) {
        db.deliveryBoys.splice(dbIndex, 1);
      }
    }

    // Send logout notification via WebSocket
    sendToUser(userId, {
      type: 'FORCE_LOGOUT',
      message: 'Your account has been deleted'
    });

    res.json({
      message: 'User deleted successfully',
      userId,
      role: user.role,
      note: 'If delivery boy was logged in, session will be invalidated and user will be logged out automatically'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to delete user',
      code: 'DELETE_USER_ERROR'
    });
  }
});

// POST /api/admin/orders
router.post('/orders', (req, res) => {
  try {
    const { customerName, customerPhone, items, deliveryAddress, totalAmount, paymentMode } = req.body;

    if (!customerName || !customerPhone || !items || !deliveryAddress || !totalAmount || !paymentMode) {
      return res.status(400).json({
        error: true,
        message: 'All fields are required',
        code: 'MISSING_FIELDS'
      });
    }

    const newOrder = {
      orderId: generateOrderId(),
      customerName,
      customerPhone,
      items,
      deliveryAddress,
      totalAmount,
      paymentMode,
      paymentStatus: paymentMode === 'Paid' ? 'Completed' : 'Pending',
      deliveryStatus: 'Pending',
      assignedDeliveryBoy: null,
      createdAt: new Date().toISOString(),
      deliveredAt: null,
      deliveredBy: null
    };

    db.orders.push(newOrder);

    // Broadcast to all delivery boys via WebSocket
    broadcastToDrivers({
      type: 'ORDER_CREATED',
      order: newOrder
    });

    res.status(201).json({
      ...newOrder,
      message: 'Order created and broadcast to all delivery boys'
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to create order',
      code: 'CREATE_ORDER_ERROR'
    });
  }
});

// GET /api/admin/orders
router.get('/orders', (req, res) => {
  try {
    const { page = 1, limit = 10, status, paymentStatus, startDate, endDate } = req.query;
    
    let filteredOrders = [...db.orders];
    
    if (status) {
      filteredOrders = filteredOrders.filter(o => o.deliveryStatus === status);
    }
    
    if (paymentStatus) {
      filteredOrders = filteredOrders.filter(o => o.paymentStatus === paymentStatus);
    }

    if (startDate) {
      filteredOrders = filteredOrders.filter(o => new Date(o.createdAt) >= new Date(startDate));
    }

    if (endDate) {
      filteredOrders = filteredOrders.filter(o => new Date(o.createdAt) <= new Date(endDate));
    }

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

    res.json({
      orders: paginatedOrders,
      total: filteredOrders.length,
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
router.get('/orders/:orderId', (req, res) => {
  try {
    const { orderId } = req.params;
    const order = db.orders.find(o => o.orderId === orderId);

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

// PUT /api/admin/orders/:orderId/payment-status
router.put('/orders/:orderId/payment-status', (req, res) => {
  try {
    const { orderId } = req.params;
    const { paymentStatus, actualPaymentMethod, notes } = req.body;

    const order = db.orders.find(o => o.orderId === orderId);
    if (!order) {
      return res.status(404).json({
        error: true,
        message: 'Order not found',
        code: 'ORDER_NOT_FOUND'
      });
    }

    order.paymentStatus = paymentStatus;
    if (actualPaymentMethod) {
      order.actualPaymentMethod = actualPaymentMethod;
    }
    if (notes) {
      order.paymentNotes = notes;
    }
    order.paymentUpdatedAt = new Date().toISOString();

    res.json({
      message: 'Payment status updated successfully',
      orderId,
      paymentStatus,
      actualPaymentMethod,
      updatedAt: order.paymentUpdatedAt
    });
  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to update payment status',
      code: 'UPDATE_PAYMENT_ERROR'
    });
  }
});

// PUT /api/admin/orders/:orderId/assign
router.put('/orders/:orderId/assign', (req, res) => {
  try {
    const { orderId } = req.params;
    const { deliveryBoyId } = req.body;

    const order = db.orders.find(o => o.orderId === orderId);
    if (!order) {
      return res.status(404).json({
        error: true,
        message: 'Order not found',
        code: 'ORDER_NOT_FOUND'
      });
    }

    const deliveryBoy = db.deliveryBoys.find(db => db.id === deliveryBoyId);
    if (!deliveryBoy) {
      return res.status(404).json({
        error: true,
        message: 'Delivery boy not found',
        code: 'DELIVERY_BOY_NOT_FOUND'
      });
    }

    order.assignedDeliveryBoy = {
      id: deliveryBoy.id,
      name: deliveryBoy.name,
      phone: deliveryBoy.phone
    };
    order.assignedAt = new Date().toISOString();
    order.deliveryStatus = 'Assigned';

    // Send notification to assigned delivery boy
    sendToUser(deliveryBoy.userId, {
      type: 'ORDER_ASSIGNED',
      order
    });

    res.json(order);
  } catch (error) {
    console.error('Assign order error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to assign order',
      code: 'ASSIGN_ORDER_ERROR'
    });
  }
});

// GET /api/admin/delivery-boys
router.get('/delivery-boys', (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    let filteredDeliveryBoys = [...db.deliveryBoys];
    
    if (status) {
      filteredDeliveryBoys = filteredDeliveryBoys.filter(db => db.status === status);
    }

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedDeliveryBoys = filteredDeliveryBoys.slice(startIndex, endIndex);

    res.json({
      deliveryBoys: paginatedDeliveryBoys,
      total: filteredDeliveryBoys.length,
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

    // Check if phone already exists
    const existingUser = db.users.find(u => u.phone === phone);
    if (existingUser) {
      return res.status(400).json({
        error: true,
        message: 'Phone number already exists',
        code: 'PHONE_EXISTS'
      });
    }

    const defaultPassword = process.env.DEFAULT_PASSWORD || '123456';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    const userId = generateId('user_');
    const newUser = {
      id: userId,
      name,
      phone,
      email: `${phone}@dsk.com`,
      password: hashedPassword,
      role: 'driver',
      status: 'active',
      createdAt: new Date().toISOString(),
      lastLogin: null
    };

    const newDeliveryBoy = {
      id: generateId('db_'),
      userId,
      name,
      phone,
      status: 'active',
      totalDeliveries: 0,
      completedDeliveries: 0,
      averageRating: 0
    };

    db.users.push(newUser);
    db.deliveryBoys.push(newDeliveryBoy);

    res.status(201).json({
      ...newDeliveryBoy,
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

// PUT /api/admin/delivery-boys/:deliveryBoyId
router.put('/delivery-boys/:deliveryBoyId', (req, res) => {
  try {
    const { deliveryBoyId } = req.params;
    const updates = req.body;

    const deliveryBoy = db.deliveryBoys.find(db => db.id === deliveryBoyId);
    if (!deliveryBoy) {
      return res.status(404).json({
        error: true,
        message: 'Delivery boy not found',
        code: 'DELIVERY_BOY_NOT_FOUND'
      });
    }

    Object.assign(deliveryBoy, updates);

    res.json(deliveryBoy);
  } catch (error) {
    console.error('Update delivery boy error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to update delivery boy',
      code: 'UPDATE_DELIVERY_BOY_ERROR'
    });
  }
});

// DELETE /api/admin/delivery-boys/:deliveryBoyId
router.delete('/delivery-boys/:deliveryBoyId', (req, res) => {
  try {
    const { deliveryBoyId } = req.params;

    const dbIndex = db.deliveryBoys.findIndex(db => db.id === deliveryBoyId);
    if (dbIndex === -1) {
      return res.status(404).json({
        error: true,
        message: 'Delivery boy not found',
        code: 'DELIVERY_BOY_NOT_FOUND'
      });
    }

    const deliveryBoy = db.deliveryBoys[dbIndex];
    
    // Remove delivery boy
    db.deliveryBoys.splice(dbIndex, 1);

    // Remove associated user
    const userIndex = db.users.findIndex(u => u.id === deliveryBoy.userId);
    if (userIndex !== -1) {
      db.users.splice(userIndex, 1);
    }

    // Send logout notification
    sendToUser(deliveryBoy.userId, {
      type: 'FORCE_LOGOUT',
      message: 'Your account has been deleted'
    });

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

// GET /api/admin/leaderboard
router.get('/leaderboard', (req, res) => {
  try {
    const { period = 'month' } = req.query;

    const leaderboard = db.deliveryBoys
      .map(db => ({
        rank: 0,
        deliveryBoyId: db.id,
        name: db.name,
        deliveries: db.completedDeliveries
      }))
      .sort((a, b) => b.deliveries - a.deliveries)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    res.json({ leaderboard });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to get leaderboard',
      code: 'GET_LEADERBOARD_ERROR'
    });
  }
});

// GET /api/admin/revenue
router.get('/revenue', (req, res) => {
  try {
    const { period = 'today' } = req.query;

    const completedOrders = db.orders.filter(o => o.paymentStatus === 'Completed');
    const totalRevenue = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    const paymentMethods = {
      cash: completedOrders.filter(o => o.paymentMode === 'Cash').reduce((sum, o) => sum + o.totalAmount, 0),
      upi: completedOrders.filter(o => o.paymentMode === 'UPI').reduce((sum, o) => sum + o.totalAmount, 0),
      card: completedOrders.filter(o => o.paymentMode === 'Card').reduce((sum, o) => sum + o.totalAmount, 0)
    };

    res.json({
      totalRevenue,
      period,
      paymentMethods,
      chartData: []
    });
  } catch (error) {
    console.error('Get revenue error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to get revenue',
      code: 'GET_REVENUE_ERROR'
    });
  }
});

// GET /api/admin/transactions
router.get('/transactions', (req, res) => {
  try {
    const { page = 1, limit = 20, startDate, endDate } = req.query;
    
    let filteredTransactions = [...db.transactions];

    if (startDate) {
      filteredTransactions = filteredTransactions.filter(t => new Date(t.timestamp) >= new Date(startDate));
    }

    if (endDate) {
      filteredTransactions = filteredTransactions.filter(t => new Date(t.timestamp) <= new Date(endDate));
    }

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);

    res.json({
      transactions: paginatedTransactions,
      total: filteredTransactions.length,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to get transactions',
      code: 'GET_TRANSACTIONS_ERROR'
    });
  }
});

module.exports = router;
