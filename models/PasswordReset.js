const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  otpHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});
// MongoDB deletes the document automatically once expiresAt passes
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PasswordReset', schema);
