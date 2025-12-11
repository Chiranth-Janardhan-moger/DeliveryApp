const WebSocket = require('ws');

let wss;
const clients = new Map(); // userId -> { ws, role, name }
const adminClients = new Set(); // Track admin connections watching tracking page

// Send FCM to all drivers (for background/killed apps)
const sendFCMToAllDrivers = async () => {
  try {
    const DeliveryBoy = require('../models/DeliveryBoy');
    const { sendLocationRequestToAll } = require('../utils/firebase');
    
    // Get all drivers with FCM tokens
    const drivers = await DeliveryBoy.find({ fcmToken: { $exists: true, $ne: null } });
    const tokens = drivers.map(d => d.fcmToken).filter(Boolean);
    
    if (tokens.length > 0) {
      await sendLocationRequestToAll(tokens);
      console.log(`📱 FCM sent to ${tokens.length} drivers`);
    }
  } catch (error) {
    console.error('FCM broadcast error:', error.message);
  }
};

const setupWebSocket = (server) => {
  wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('🔌 New WebSocket connection');

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        
        // Register client with userId
        if (data.type === 'register' && data.userId) {
          clients.set(data.userId, { 
            ws, 
            role: data.role || 'unknown',
            name: data.name || 'Unknown'
          });
          ws.userId = data.userId;
          ws.role = data.role;
          console.log(`✅ User ${data.userId} registered (${data.role})`);
        }
        
        // Admin starts tracking - notify all drivers to send location
        if (data.type === 'START_TRACKING') {
          adminClients.add(ws);
          ws.isTrackingAdmin = true;
          console.log('📍 Admin started tracking - notifying all drivers');
          
          // Notify connected drivers via WebSocket
          broadcastToDrivers({ type: 'START_TRACKING' });
          
          // Also send FCM for drivers with app in background
          sendFCMToAllDrivers();
        }
        
        // Admin stops tracking
        if (data.type === 'STOP_TRACKING') {
          adminClients.delete(ws);
          ws.isTrackingAdmin = false;
          
          // Only stop tracking if no admins are watching
          if (adminClients.size === 0) {
            console.log('📍 No admins tracking - notifying drivers to stop');
            broadcastToDrivers({ type: 'STOP_TRACKING' });
          }
        }
        
        // Admin requests all locations immediately
        if (data.type === 'REQUEST_ALL_LOCATIONS') {
          console.log('📍 Admin requested all locations');
          broadcastToDrivers({ type: 'REQUEST_LOCATION' });
        }

        // Driver location update - forward to all tracking admins
        if (data.type === 'DRIVER_LOCATION_UPDATE') {
          sendToTrackingAdmins(data);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      // Remove from admin clients if applicable
      if (ws.isTrackingAdmin) {
        adminClients.delete(ws);
        if (adminClients.size === 0) {
          console.log('📍 Last admin disconnected - stopping driver tracking');
          broadcastToDrivers({ type: 'STOP_TRACKING' });
        }
      }
      
      // Remove client from map
      if (ws.userId) {
        clients.delete(ws.userId);
        console.log(`❌ User ${ws.userId} disconnected`);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket client error:', error);
    });
  });

  console.log('✅ WebSocket server initialized on /ws');
};

// Broadcast to all connected clients
const broadcast = (data) => {
  if (!wss) return;
  
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};

// Send to specific user
const sendToUser = (userId, data) => {
  const clientInfo = clients.get(userId);
  if (clientInfo && clientInfo.ws.readyState === WebSocket.OPEN) {
    clientInfo.ws.send(JSON.stringify(data));
  }
};

// Broadcast to all drivers
const broadcastToDrivers = (data) => {
  if (!wss) return;
  
  const message = JSON.stringify(data);
  clients.forEach((clientInfo, userId) => {
    if (clientInfo.role === 'driver' && clientInfo.ws.readyState === WebSocket.OPEN) {
      clientInfo.ws.send(message);
    }
  });
};

// Send to all admins watching tracking page
const sendToTrackingAdmins = (data) => {
  const message = JSON.stringify(data);
  adminClients.forEach((adminWs) => {
    if (adminWs.readyState === WebSocket.OPEN) {
      adminWs.send(message);
    }
  });
};

// Check if any admin is tracking
const isTrackingActive = () => {
  return adminClients.size > 0;
};

module.exports = {
  setupWebSocket,
  broadcast,
  sendToUser,
  broadcastToDrivers,
  sendToTrackingAdmins,
  isTrackingActive
};
