const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AlertSchema = new Schema({
  sessionId: { 
    type: String, 
    required: true
  },
  participantId: { 
    type: String, 
    required: true 
  },
  channel: { 
    type: String, 
    required: true 
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  },
  message: { 
    type: String, 
    required: true 
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'critical'],
    default: 'warning'
  },
  eventType: {
    type: String,
    enum: ['process', 'network', 'device', 'system', 'input', 'other'],
    default: 'other'
  },
  handled: {
    type: Boolean,
    default: false
  },
  handledBy: {
    type: String,
    default: null
  },
  handledAt: {
    type: Date,
    default: null
  },
  screenshot: {
    type: String,  // Base64 de la captura de pantalla
    default: null
  }
});

// Índices para búsquedas eficientes
AlertSchema.index({ sessionId: 1 });
AlertSchema.index({ channel: 1 });
AlertSchema.index({ timestamp: -1 });
AlertSchema.index({ severity: 1 });
AlertSchema.index({ handled: 1 });

module.exports = mongoose.model('Alert', AlertSchema);