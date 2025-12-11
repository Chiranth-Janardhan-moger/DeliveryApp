require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { connectDB } = require('./config/database');
const { setupWebSocket } = require('./websocket/websocket');
const { scheduleCleanup } = require('./utils/cleanup');
const { initializeFirebase } = require('./utils/firebase');
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const driverRoutes = require('./routes/driver.routes');

const app = express();
const server = http.createServer(app);

// Trust proxy (required for Render, Heroku, etc.)
app.set('trust proxy', 1);

// Connect to MongoDB
connectDB();

// Setup WebSocket for real-time updates
setupWebSocket(server);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Root route
app.get('/', (req, res) => {
  res.send('Backend is running...');
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/driver', driverRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: true,
    message: err.message || 'Internal Server Error',
    code: err.code || 'SERVER_ERROR'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: true,
    message: 'Route not found',
    code: 'NOT_FOUND'
  });
});

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Initialize Firebase for push notifications
  initializeFirebase();
  
  // Start the cleanup scheduler
  scheduleCleanup();
});
