const mongoose = require('mongoose');

const scanSchema = new mongoose.Schema({
  barcode: {
    type: String,
    required: true
  },
  product_id: {
    type: String,
    required: true
  },
  product_name: {
    type: String,
    required: true
  },
  weight_grams: {
    type: Number,
    required: true
  },
  weight_kg: {
    type: Number,
    required: true
  },
  price_per_kg: {
    type: Number,
    required: true
  },
  total_price: {
    type: Number,
    required: true
  },
  scanned_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Scan', scanSchema);
