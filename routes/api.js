const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const winston = require('winston');

// Modelos
const Client = mongoose.model('Client');
const Alert = mongoose.model('Alert');

// Logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/api.log' })
  ]
});

// Ruta de prueba
router.get('/', (req, res) => {
  res.json({ message: 'API del servidor AntiCheat funcionando correctamente' });
});

// Actualización de estado del cliente
router.post('/update', async (req, res) => {
  try {
    const data = req.body;
    logger.info(`Actualización recibida de ${data.participant_id || 'cliente desconocido'}`);
    
    // Actualizar o crear cliente en la base de datos
    const client = await Client.findOneAndUpdate(
      { sessionId: data.session_id },
      { 
        sessionId: data.session_id,
        participantId: data.participant_id,
        channel: data.channel,
        lastUpdate: new Date(),
        systemData: data,
        trustScore: data.trust_score,
        gameRunning: data.game_running || false,
        systemInfo: data.system_info || {},
        antivirusStatus: data.antivirus_status || {},
        virtualEnvironmentDetection: data.virtual_environment || false,
        fileIntegrityStatus: data.file_integrity || {}
      },
      { upsert: true, new: true }
    );
    
    // Emitir actualización a los clientes web en el canal correspondiente
    const io = req.app.get('io');
    io.to(data.channel).emit('client-update', {
      id: client._id,
      sessionId: client.sessionId,
      participantId: client.participantId,
      channel: client.channel,
      lastUpdate: client.lastUpdate,
      systemData: client.systemData,
      trustScore: client.trustScore,
      gameRunning: client.gameRunning
    });
    
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error actualizando datos del cliente:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Registro de alertas
router.post('/alert', async (req, res) => {
  try {
    const { session_id, participant_id, channel, alert_message, alert_severity, event_type, screenshot } = req.body;
    
    logger.info(`Alerta recibida de ${participant_id}: ${alert_message}`);
    
    // Crear la alerta en la base de datos
    const alert = new Alert({
      sessionId: session_id,
      participantId: participant_id,
      channel: channel,
      timestamp: new Date(),
      message: alert_message,
      severity: alert_severity || 'warning',
      eventType: event_type || 'other',
      screenshot: screenshot || null
    });
    
    await alert.save();
    
    // Actualizar contador de alertas para el cliente
    await Client.findOneAndUpdate(
      { sessionId: session_id },
      { 
        $push: { 
          alerts: { 
            timestamp: new Date(), 
            message: alert_message,
            severity: alert_severity || 'warning'
          } 
        } 
      }
    );
    
    // Emitir alerta a los clientes web en el canal correspondiente
    const io = req.app.get('io');
    io.to(channel).emit('client-alert', {
      sessionId: session_id,
      participantId: participant_id,
      channel: channel,
      timestamp: new Date(),
      message: alert_message,
      severity: alert_severity || 'warning',
      eventType: event_type || 'other'
    });
    
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error registrando alerta:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obtener todos los clientes de un canal específico
router.get('/clients/:channel', async (req, res) => {
  try {
    const { channel } = req.params;
    logger.info(`Solicitud de clientes para el canal: ${channel}`);
    
    const clients = await Client.find({ channel })
      .select('-systemData.screenshot') // Excluir capturas de pantalla para reducir el tamaño
      .sort({ lastUpdate: -1 });
      
    res.status(200).json(clients);
  } catch (error) {
    logger.error('Error obteniendo clientes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obtener detalles de un cliente específico
router.get('/client/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    logger.info(`Solicitud de detalles para el cliente: ${sessionId}`);
    
    const client = await Client.findOne({ sessionId });
    
    if (!client) {
      return res.status(404).json({ success: false, error: 'Cliente no encontrado' });
    }
    
    res.status(200).json(client);
  } catch (error) {
    logger.error('Error obteniendo detalles del cliente:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obtener alertas para un canal específico
router.get('/alerts/:channel', async (req, res) => {
  try {
    const { channel } = req.params;
    const { limit = 50, offset = 0, severity } = req.query;
    
    logger.info(`Solicitud de alertas para el canal: ${channel}`);
    
    // Construir consulta base
    let query = { channel };
    
    // Filtrar por severidad si se proporciona
    if (severity) {
      query.severity = severity;
    }
    
    const alerts = await Alert.find(query)
      .sort({ timestamp: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit));
      
    const total = await Alert.countDocuments(query);
    
    res.status(200).json({
      alerts,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error('Error obteniendo alertas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Marcar una alerta como gestionada
router.put('/alert/:alertId/handle', async (req, res) => {
  try {
    const { alertId } = req.params;
    const { handledBy } = req.body;
    
    logger.info(`Marcando alerta ${alertId} como gestionada por ${handledBy}`);
    
    const alert = await Alert.findByIdAndUpdate(
      alertId,
      {
        handled: true,
        handledBy,
        handledAt: new Date()
      },
      { new: true }
    );
    
    if (!alert) {
      return res.status(404).json({ success: false, error: 'Alerta no encontrada' });
    }
    
    // Emitir actualización a los clientes web
    const io = req.app.get('io');
    io.to(alert.channel).emit('alert-handled', {
      alertId: alert._id,
      handledBy,
      handledAt: alert.handledAt
    });
    
    res.status(200).json({ success: true, alert });
  } catch (error) {
    logger.error('Error marcando alerta como gestionada:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Solicitar captura de pantalla de un cliente específico
router.post('/request-screenshot/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    logger.info(`Solicitud de captura de pantalla para el cliente: ${sessionId}`);
    
    // Buscar el cliente para obtener su canal
    const client = await Client.findOne({ sessionId });
    
    if (!client) {
      return res.status(404).json({ success: false, error: 'Cliente no encontrado' });
    }
    
    // Emitir evento para solicitar la captura
    const io = req.app.get('io');
    io.to(client.channel).emit('request-screenshot', {
      sessionId: client.sessionId,
      timestamp: new Date()
    });
    
    res.status(200).json({ success: true, message: 'Solicitud de captura enviada' });
  } catch (error) {
    logger.error('Error solicitando captura de pantalla:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Terminar un proceso en un cliente remoto
router.post('/kill-process/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { processId } = req.body;
    
    logger.info(`Solicitud para terminar proceso ${processId} en cliente: ${sessionId}`);
    
    // Buscar el cliente para obtener su canal
    const client = await Client.findOne({ sessionId });
    
    if (!client) {
      return res.status(404).json({ success: false, error: 'Cliente no encontrado' });
    }
    
    // Emitir evento para terminar el proceso
    const io = req.app.get('io');
    io.to(client.channel).emit('kill-process', {
      sessionId: client.sessionId,
      processId
    });
    
    res.status(200).json({ success: true, message: 'Solicitud de terminación enviada' });
  } catch (error) {
    logger.error('Error solicitando terminación de proceso:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Estadísticas generales para un canal
router.get('/stats/:channel', async (req, res) => {
  try {
    const { channel } = req.params;
    logger.info(`Solicitud de estadísticas para el canal: ${channel}`);
    
    // Contar clientes por canal
    const clientCount = await Client.countDocuments({ channel });
    
    // Contar alertas por severidad
    const alertStats = await Alert.aggregate([
      { $match: { channel } },
      { $group: {
          _id: '$severity',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Formatear resultado
    const alertCounts = {
      info: 0,
      warning: 0,
      critical: 0
    };
    
    alertStats.forEach(stat => {
      alertCounts[stat._id] = stat.count;
    });
    
    // Obtener puntuaciones de confianza promedio
    const trustScores = await Client.aggregate([
      { $match: { channel } },
      { $group: {
          _id: null,
          avgScore: { $avg: '$trustScore' }
        }
      }
    ]);
    
    const avgTrustScore = trustScores.length > 0 ? trustScores[0].avgScore : 10;
    
    res.status(200).json({
      clientCount,
      alertCounts,
      avgTrustScore
    });
  } catch (error) {
    logger.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;