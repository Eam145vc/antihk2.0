const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ClientSchema = new Schema({
  sessionId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  participantId: { 
    type: String, 
    required: true 
  },
  channel: { 
    type: String, 
    required: true 
  },
  lastUpdate: { 
    type: Date, 
    default: Date.now 
  },
  systemData: { 
    type: Schema.Types.Mixed 
  },
  trustScore: { 
    type: Number, 
    default: 10 
  },
  gameRunning: {
    type: Boolean,
    default: false
  },
  systemInfo: {
    platform: String,
    arch: String,
    hostname: String,
    username: String,
    totalMem: Number,
    freeMem: Number,
    cpus: [String],
    uptime: Number
  },
  antivirusStatus: {
    name: String,
    enabled: Boolean,
    realTimeProtection: Boolean,
    timestamp: Date
  },
  virtualEnvironmentDetection: {
    type: Boolean,
    default: false
  },
  fileIntegrityStatus: {
    type: Schema.Types.Mixed
  },
  alerts: [{
    timestamp: { 
      type: Date, 
      default: Date.now 
    },
    message: String,
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'info'
    }
  }]
});

// Índices para búsquedas eficientes
ClientSchema.index({ sessionId: 1 });
ClientSchema.index({ channel: 1 });

module.exports = mongoose.model('Client', ClientSchema);