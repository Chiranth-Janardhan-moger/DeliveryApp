const cron = require('node-cron');
const Order = require('../models/Order');

const DeliveryBoy = require('../models/DeliveryBoy');

// Function to delete delivery history older than 1 day
const cleanupDeliveryHistory = async () => {
  try {
    console.log('🧹 Starting delivery history cleanup...');
    
    // Calculate cutoff time (1 day ago)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    // Delete completed orders older than 1 day
    const result = await Order.deleteMany({
      deliveryStatus: 'Delivered',
      deliveredAt: { $lt: oneDayAgo }
    });
    
    console.log(`✅ Cleanup completed: ${result.deletedCount} old delivery records deleted`);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
};

// Function to clear stale driver locations (older than 20 minutes)
const cleanupStaleLocations = async () => {
  try {
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);
    
    // Clear locations older than 20 minutes
    const result = await DeliveryBoy.updateMany(
      { 'lastLocation.updatedAt': { $lt: twentyMinutesAgo } },
      { $unset: { lastLocation: 1 } }
    );
    
    if (result.modifiedCount > 0) {
      console.log(`📍 Cleared ${result.modifiedCount} stale driver locations (>20 min old)`);
    }
  } catch (error) {
    console.error('❌ Error clearing stale locations:', error);
  }
};

// Schedule cleanup to run daily at 1:00 AM
const scheduleCleanup = () => {
  // Cron expression: minute hour day month dayOfWeek
  // '0 1 * * *' means: at 1:00 AM every day
  cron.schedule('0 1 * * *', cleanupDeliveryHistory, {
    scheduled: true,
    timezone: "Asia/Kolkata" // Adjust timezone as needed
  });
  
  console.log('📅 Delivery history cleanup scheduled for 1:00 AM daily');
  
  // Schedule stale location cleanup every 5 minutes
  cron.schedule('*/5 * * * *', cleanupStaleLocations, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });
  
  console.log('📍 Stale location cleanup scheduled every 5 minutes');
};

// Manual cleanup function for testing
const runCleanupNow = async () => {
  await cleanupDeliveryHistory();
  await cleanupStaleLocations();
};

module.exports = {
  scheduleCleanup,
  runCleanupNow,
  cleanupDeliveryHistory,
  cleanupStaleLocations
};