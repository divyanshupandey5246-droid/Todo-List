const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 140 },
  notes: { type: String, trim: true, maxlength: 1000, default: '' },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  category: { type: String, trim: true, maxlength: 30, default: '' },
  dueDate: { type: Date, default: null },
  done: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
