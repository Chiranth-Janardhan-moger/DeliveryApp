// Firebase Cloud Messaging for push notifications
// This sends silent push notifications to wake up driver apps

let admin = null;

const initializeFirebase = () => {
  try {
    // Check if Firebase credentials are configured
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccount) {
      console.log('⚠️ Firebase not configured - push notifications disabled');
      return false;
    }

    const firebaseAdmin = require('firebase-admin');
    const credentials = JSON.parse(serviceAccount);
    
    admin = firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(credentials),
    });
    
    console.log('✅ Firebase initialized for push notifications');
    return true;
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    return false;
  }
};

// Send location request to specific driver
const sendLocationRequest = async (fcmToken) => {
  if (!admin) return false;
  
  try {
    const message = {
      token: fcmToken,
      data: {
        type: 'LOCATION_REQUEST',
        timestamp: Date.now().toString(),
      },
      android: {
        priority: 'high',
        ttl: 30000, // 30 seconds
      },
    };

    await admin.messaging().send(message);
    console.log('📍 Location request sent to driver');
    return true;
  } catch (error) {
    console.error('Failed to send FCM:', error.message);
    return false;
  }
};

// Send location request to all drivers
const sendLocationRequestToAll = async (fcmTokens) => {
  if (!admin || !fcmTokens || fcmTokens.length === 0) return;
  
  try {
    const message = {
      data: {
        type: 'LOCATION_REQUEST',
        timestamp: Date.now().toString(),
      },
      android: {
        priority: 'high',
        ttl: 30000,
      },
    };

    // Send to multiple tokens
    const response = await admin.messaging().sendEachForMulticast({
      tokens: fcmTokens,
      ...message,
    });
    
    console.log(`📍 Location request sent to ${response.successCount}/${fcmTokens.length} drivers`);
    return response;
  } catch (error) {
    console.error('Failed to send FCM to all:', error.message);
    return null;
  }
};

module.exports = {
  initializeFirebase,
  sendLocationRequest,
  sendLocationRequestToAll,
};
