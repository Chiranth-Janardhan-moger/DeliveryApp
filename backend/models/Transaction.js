const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
  },
  amount: {
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
    required: true,
  },
  driverId: String,
  customerId: String,
}, {
  timestamps: true,
});

module.exports = mongoose.model('Transaction', transactionSchema);
