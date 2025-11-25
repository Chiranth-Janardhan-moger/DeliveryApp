const WebSocket = require('ws');

let wss;
const clients = new Map(); // userId -> WebSocket connection

const setupWebSocket = (server) => {
  wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    console.log('New WebSocket connection');

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        
        // Register client with userId
        if (data.type === 'register' && data.userId) {
          clients.set(data.userId, ws);
          console.log(`User ${data.userId} registered for WebSocket`);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      // Remove client from map
      for (const [userId, client] of clients.entries()) {
        if (client === ws) {
          clients.delete(userId);
          console.log(`User ${userId} disconnected`);
          break;
        }
      }
    });
  });

  console.log('WebSocket server initialized');
};

// Broadcast to all connected clients
const broadcast = (data) => {
  if (!wss) return;
  
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
};

// Send to specific user
const sendToUser = (userId, data) => {
  const client = clients.get(userId);
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(data));
  }
};

// Broadcast to all drivers
const broadcastToDrivers = (data, driverIds = []) => {
  if (!wss) return;
  
  if (driverIds.length === 0) {
    // Broadcast to all
    broadcast(data);
  } else {
    // Broadcast to specific drivers
    driverIds.forEach(driverId => {
      sendToUser(driverId, data);
    });
  }
};

module.exports = {
  setupWebSocket,
  broadcast,
  sendToUser,
  broadcastToDrivers
};
