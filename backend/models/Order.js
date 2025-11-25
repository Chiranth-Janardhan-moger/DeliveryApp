const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true,
  },
  customerName: {
    type: String,
    required: true,
  },
  customerPhone: {
    type: String,
    required: true,
  },
  items: [{
    name: String,
    quantity: Number,
    price: Number,
  }],
  deliveryAddress: {
    addressLine: String,
    city: String,
    pincode: String,
    latitude: Number,
    longitude: Number,
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  paymentMode: {
    type: String,
    enum: ['Cash', 'Card', 'UPI', 'Paid'],
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed'],
    default: 'Pending',
  },
  actualPaymentMethod: {
    type: String,
    enum: ['Cash', 'Card', 'UPI', 'Pending'],
  },
  paymentNotes: String,
  paymentUpdatedAt: Date,
  deliveryStatus: {
    type: String,
    enum: ['Pending', 'Assigned', 'In Transit', 'Delivered', 'Cancelled'],
    default: 'Pending',
  },
  assignedDeliveryBoy: {
    id: String,
    name: String,
    phone: String,
  },
  assignedAt: Date,
  deliveredAt: Date,
  deliveredBy: String,
  deliveryLocation: {
    latitude: Number,
    longitude: Number,
  },
  deliveryPhoto: String,
  deliveryNotes: String,
  statusUpdatedAt: Date,
}, {
  timestamps: true,
});

module.exports = mongoose.model('Order', orderSchema);
