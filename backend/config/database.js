const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);

    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Create default admin if not exists
    await createDefaultAdmin();
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    console.log('Falling back to in-memory mode...');
    // Don't exit, just log the error
  }
};

const createDefaultAdmin = async () => {
  try {
    const User = require('../models/User');
    
    const adminExists = await User.findOne({ phone: '7026377578' });
    
    if (!adminExists) {
      const defaultAdminPassword = await bcrypt.hash('Admin@123', 10);
      
      await User.create({
        name: 'Admin User',
        email: 'admin@dsk.com',
        phone: '7026377578',
        password: defaultAdminPassword,
        role: 'admin',
        status: 'active',
      });
      
      console.log('✅ Default admin created: phone=9999999999, password=admin123');
    }
  } catch (error) {
    console.error('Error creating default admin:', error.message);
  }
};

// Set for invalidated tokens (in production, use Redis)
const invalidatedTokens = new Set();

module.exports = { connectDB, invalidatedTokens };
