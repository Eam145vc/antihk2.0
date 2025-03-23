// client-details.js - Script para la página de detalles del cliente

// Variables globales
let socket;
let clientData = null;
let sessionId = null;
let charts = {};
let trustScoreHistory = [];

// Constantes
const RISK_LEVELS = {
    LOW: { threshold: 70, color: '#28a745', text: 'NORMAL' },
    MEDIUM: { threshold: 40, color: '#ffc107', text: 'SOSPECHOSO' },
    HIGH: { threshold: 0, color: '#dc3545', text: 'CRÍTICO' }
};

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    // Obtener ID del cliente de la URL
    const urlParams = new URLSearchParams(window.location.search);
    sessionId = urlParams.get('id');
    
    if (!sessionId) {
        showError('No se proporcionó un ID de cliente válido');
        return;
    }
    
    initializeSocket();
    setupEventListeners();
    loadClientData();
});

// Inicializar conexión Socket.io
function initializeSocket() {
    // Conectar al servidor Socket.io
    const serverUrl = window.location.origin;
    socket = io(serverUrl);
    
    // Escuchar actualizaciones del cliente
    socket.on('client-update', (data) => {
        if (data.sessionId === sessionId) {
            console.log('Actualización del cliente recibida:', data);
            clientData = data;
            updateClientUI();
        }
    });
    
    // Escuchar alertas
    socket.on('client-alert', (data) => {
        if (data.sessionId === sessionId) {
            console.log('Alerta recibida:', data);
            
            // Agregar a la actividad reciente
            addActivity(data.severity || 'info', data.message);
            
            // Reproducir sonido según severidad
            playSound(data.severity);
            
            // Actualizar contador de alertas
            updateAlertCount();
        }
    });
    
    // Escuchar capturas de pantalla
    socket.on('screenshot', (data) => {
        if (data.sessionId === sessionId) {
            console.log('Captura de pantalla recibida');
            
            // Mostrar la captura recibida
            showScreenshot(data.screenshot, data.timestamp);
            
            // Agregar a la actividad reciente
            addActivity('info', 'Captura de pantalla recibida');
        }
    });
}

// Configurar event listeners
function setupEventListeners() {
    // Botón de volver atrás
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = '/';
        });
    }
    
    // Botón de actualizar
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadClientData);
    }
    
    // Botón de captura de pantalla
    const screenshotBtn = document.getElementById('screenshotBtn');
    if (screenshotBtn) {
        screenshotBtn.addEventListener('click', requestScreenshot);
    }
    
    // Botón de advertencia
    const warnBtn = document.getElementById('warnBtn');
    if (warnBtn) {
        warnBtn.addEventListener('click', sendWarning);
    }
    
    // Botón de descalificación
    const disqualifyBtn = document.getElementById('disqualifyBtn');
    if (disqualifyBtn) {
        disqualifyBtn.addEventListener('click', confirmDisqualification);
    }
    
    // Manejo de pestañas para activar gráficos cuando se muestran
    const tabButtons = document.querySelectorAll('button[data-bs-toggle="tab"]');
    tabButtons.forEach(button => {
        button.addEventListener('shown.bs.tab', (e) => {
            const targetTab = e.target.getAttribute('data-bs-target');
            // Actualizar gráficos específicos de cada pestaña
            updateChartsForTab(targetTab);
        });
    });
}