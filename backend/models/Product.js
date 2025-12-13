const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  product_id: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  price_per_kg: {
    type: Number,
    required: true,
    min: 0
  },
  is_active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for text search (product_id already indexed via unique: true)
productSchema.index({ name: 'text' });

module.exports = mongoose.model('Product', productSchema);
