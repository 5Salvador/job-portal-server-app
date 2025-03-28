// models/Application.js
const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  cv: { type: String, required: true }, // Store file path or link
  address: { type: String, required: true },
  describeYourself: { type: String, required: true },
  appliedAt: { type: Date, default: Date.now }
});

const Application = mongoose.model('Application', applicationSchema);
module.exports = Application;
