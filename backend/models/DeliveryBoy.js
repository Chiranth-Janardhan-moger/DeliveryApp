const mongoose = require('mongoose');

const deliveryBoySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
  totalDeliveries: {
    type: Number,
    default: 0,
  },
  completedDeliveries: {
    type: Number,
    default: 0,
  },
  averageRating: {
    type: Number,
    default: 0,
  },
  lastLocation: {
    latitude: Number,
    longitude: Number,
    updatedAt: Date
  },
  fcmToken: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('DeliveryBoy', deliveryBoySchema);
