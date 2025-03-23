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

// Cargar datos del cliente
function loadClientData() {
    // Mostrar loader
    document.getElementById('loadingContainer').style.display = 'block';
    document.getElementById('clientDetails').style.display = 'none';
    document.getElementById('errorContainer').style.display = 'none';
    
    // Realizar la solicitud AJAX
    fetch(`/api/client/${sessionId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            clientData = data;
            console.log("Datos del cliente recibidos:", clientData);
            
            // Ocultar loader y mostrar detalles
            document.getElementById('loadingContainer').style.display = 'none';
            document.getElementById('clientDetails').style.display = 'block';
            
            // Actualizar la UI con los datos del cliente
            updateClientUI();
            
            // Inicializar gráficos
            initializeCharts();
            
            // Unirse al canal del cliente para recibir actualizaciones en tiempo real
            socket.emit('join-channel', clientData.channel);
            
            // Cargar alertas relacionadas con este cliente
            loadClientAlerts();
        })
        .catch(error => {
            console.error('Error cargando datos del cliente:', error);
            
            // Mostrar mensaje de error
            document.getElementById('loadingContainer').style.display = 'none';
            document.getElementById('errorContainer').style.display = 'block';
            document.getElementById('errorMessage').textContent = 
                `Error cargando datos del cliente: ${error.message}`;
        });
}

// Actualizar la interfaz de usuario con los datos del cliente
function updateClientUI() {
    if (!clientData) {
        console.error("No hay datos de cliente para actualizar la UI");
        return;
    }
    
    // Información básica del cliente
    document.getElementById('clientName').textContent = clientData.participantId || 'Cliente sin nombre';
    document.getElementById('clientSessionId').textContent = clientData.sessionId || 'Sin ID';
    document.getElementById('clientChannel').textContent = clientData.channel || 'Sin canal';
    
    // Formatear fecha de última actualización
    const lastUpdate = clientData.lastUpdate ? new Date(clientData.lastUpdate) : new Date();
    document.getElementById('clientLastUpdate').textContent = lastUpdate.toLocaleString();
    
    // Puntuación de confianza
    updateTrustScore(clientData.trustScore || 10);
    
    // Información del sistema
    updateSystemInfo();
    
    // Estado de seguridad
    updateSecurityStatus();
    
    // Actualizar actividad reciente
    updateRecentActivity();
    
    // Actualizar gráficos
    updateCharts();
}

// Actualizar puntuación de confianza
function updateTrustScore(score) {
    const trustScoreValue = document.getElementById('trustScoreValue');
    const trustScoreStatus = document.getElementById('trustScoreStatus');
    
    if (trustScoreValue) {
        trustScoreValue.textContent = Math.round(score);
    }
    
    if (trustScoreStatus) {
        // Determinar nivel de riesgo
        if (score >= RISK_LEVELS.LOW.threshold) {
            trustScoreStatus.textContent = RISK_LEVELS.LOW.text;
            trustScoreStatus.style.backgroundColor = 'rgba(40, 167, 69, 0.2)';
        } else if (score >= RISK_LEVELS.MEDIUM.threshold) {
            trustScoreStatus.textContent = RISK_LEVELS.MEDIUM.text;
            trustScoreStatus.style.backgroundColor = 'rgba(255, 193, 7, 0.2)';
        } else {
            trustScoreStatus.textContent = RISK_LEVELS.HIGH.text;
            trustScoreStatus.style.backgroundColor = 'rgba(220, 53, 69, 0.2)';
        }
    }
    
    // Actualizar el historial de confianza para el gráfico
    trustScoreHistory.push(score);
    if (trustScoreHistory.length > 20) {
        trustScoreHistory.shift();
    }
    
    // Actualizar el gráfico si existe
    if (charts.trustScore) {
        charts.trustScore.updateSeries([{
            name: 'Puntuación',
            data: trustScoreHistory
        }]);
    }
}

// Actualizar información del sistema
function updateSystemInfo() {
    if (!clientData || !clientData.systemInfo) {
        console.log("No hay información de sistema disponible");
        return;
    }
    
    const sysInfo = clientData.systemInfo;
    
    // Sistema operativo
    if (document.getElementById('osInfo')) {
        document.getElementById('osInfo').textContent = 
            `${sysInfo.platform || 'Desconocido'} (${sysInfo.arch || ''})`;
    }
    
    // Información de CPU
    if (document.getElementById('cpuInfo') && sysInfo.cpus && sysInfo.cpus.length > 0) {
        document.getElementById('cpuInfo').textContent = 
            Array.isArray(sysInfo.cpus) ? sysInfo.cpus[0] : 'Desconocido';
    }
    
    // Información de RAM
    if (document.getElementById('ramInfo') && sysInfo.totalMem) {
        const totalGB = (sysInfo.totalMem / (1024 * 1024 * 1024)).toFixed(2);
        const freeGB = (sysInfo.freeMem / (1024 * 1024 * 1024)).toFixed(2);
        document.getElementById('ramInfo').textContent = 
            `${freeGB} GB / ${totalGB} GB`;
    }
    
    // Hostname
    if (document.getElementById('hostnameInfo')) {
        document.getElementById('hostnameInfo').textContent = 
            sysInfo.hostname || 'Desconocido';
    }
    
    // Tiempo de actividad
    if (document.getElementById('uptimeInfo') && sysInfo.uptime) {
        const uptime = sysInfo.uptime;
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        
        document.getElementById('uptimeInfo').textContent = 
            `${days}d ${hours}h ${minutes}m`;
    }
}

// Actualizar estado de seguridad
function updateSecurityStatus() {
    if (!clientData) return;
    
    // Estado del antivirus
    if (document.getElementById('antivirusStatus') && clientData.antivirusStatus) {
        const av = clientData.antivirusStatus;
        document.getElementById('antivirusStatus').textContent = 
            av.name ? `${av.name} (${av.enabled ? 'Activo' : 'Inactivo'})` : 'No detectado';
        
        if (av.enabled) {
            document.getElementById('antivirusStatus').classList.add('text-success');
            document.getElementById('antivirusStatus').classList.remove('text-danger');
        } else {
            document.getElementById('antivirusStatus').classList.add('text-danger');
            document.getElementById('antivirusStatus').classList.remove('text-success');
        }
    }
    
    // Protección en tiempo real
    if (document.getElementById('realtimeProtection') && clientData.antivirusStatus) {
        const av = clientData.antivirusStatus;
        document.getElementById('realtimeProtection').textContent = 
            av.realTimeProtection ? 'Activa' : 'Inactiva';
        
        if (av.realTimeProtection) {
            document.getElementById('realtimeProtection').classList.add('text-success');
            document.getElementById('realtimeProtection').classList.remove('text-danger');
        } else {
            document.getElementById('realtimeProtection').classList.add('text-danger');
            document.getElementById('realtimeProtection').classList.remove('text-success');
        }
    }
    
    // Entorno virtualizado
    if (document.getElementById('virtualEnvironment')) {
        document.getElementById('virtualEnvironment').textContent = 
            clientData.virtualEnvironmentDetection ? 'Detectado' : 'No detectado';
        
        if (clientData.virtualEnvironmentDetection) {
            document.getElementById('virtualEnvironment').classList.add('text-danger');
            document.getElementById('virtualEnvironment').classList.remove('text-success');
        } else {
            document.getElementById('virtualEnvironment').classList.add('text-success');
            document.getElementById('virtualEnvironment').classList.remove('text-danger');
        }
    }
    
    // Integridad de archivos
    if (document.getElementById('fileIntegrity')) {
        const integrity = clientData.fileIntegrityStatus;
        let status = 'No verificado';
        let isOk = false;
        
        if (integrity && typeof integrity === 'object') {
            const total = integrity.total || 0;
            const modified = integrity.modified || 0;
            
            if (total > 0) {
                status = modified === 0 ? 'Verificado' : `${modified} archivos modificados`;
                isOk = modified === 0;
            }
        }
        
        document.getElementById('fileIntegrity').textContent = status;
        
        if (isOk) {
            document.getElementById('fileIntegrity').classList.add('text-success');
            document.getElementById('fileIntegrity').classList.remove('text-danger');
        } else {
            document.getElementById('fileIntegrity').classList.add('text-danger');
            document.getElementById('fileIntegrity').classList.remove('text-success');
        }
    }
}

// Inicializar gráficos
function initializeCharts() {
    // Gráfico de puntuación de confianza
    const trustScoreOptions = {
        series: [{
            name: 'Puntuación',
            data: trustScoreHistory.length > 0 ? trustScoreHistory : [clientData.trustScore || 10]
        }],
        chart: {
            height: 100,
            type: 'area',
            toolbar: {
                show: false
            },
            sparkline: {
                enabled: true
            },
        },
        colors: ['#ffffff'],
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.7,
                opacityTo: 0.3,
                stops: [0, 100]
            }
        },
        stroke: {
            curve: 'smooth',
            width: 2,
        },
        tooltip: {
            theme: 'dark',
        },
        grid: {
            show: false
        },
        xaxis: {
            labels: {
                show: false
            },
            axisBorder: {
                show: false
            },
            axisTicks: {
                show: false
            }
        },
        yaxis: {
            min: 0,
            max: 100,
            labels: {
                show: false
            }
        }
    };
    
    if (document.querySelector('#trustScoreChart')) {
        charts.trustScore = new ApexCharts(document.querySelector('#trustScoreChart'), trustScoreOptions);
        charts.trustScore.render();
    }
    
    // Gráfico de uso de CPU
    const cpuOptions = {
        series: [{
            name: 'CPU',
            data: generateRandomData(20, 10, 90) // Datos de ejemplo
        }],
        chart: {
            height: 200,
            type: 'area',
            toolbar: {
                show: false
            },
            animations: {
                enabled: true
            }
        },
        colors: ['#0d6efd'],
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.7,
                opacityTo: 0.3,
                stops: [0, 90, 100]
            }
        },
        stroke: {
            curve: 'smooth',
            width: 2,
        },
        tooltip: {
            y: {
                formatter: (val) => `${val}%`
            }
        },
        grid: {
            borderColor: '#e0e0e0',
            strokeDashArray: 5,
            xaxis: {
                lines: {
                    show: true
                }
            },
            yaxis: {
                lines: {
                    show: true
                }
            },
            padding: {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0
            },
        },
        xaxis: {
            categories: Array.from({ length: 20 }, (_, i) => i + 1),
            labels: {
                show: false
            }
        },
        yaxis: {
            min: 0,
            max: 100,
            labels: {
                formatter: (val) => `${val}%`
            }
        }
    };
    
    if (document.querySelector('#cpuUsageChart')) {
        charts.cpu = new ApexCharts(document.querySelector('#cpuUsageChart'), cpuOptions);
        charts.cpu.render();
    }
    
    // Gráfico de uso de memoria
    const memoryOptions = {
        series: [{
            name: 'RAM',
            data: generateRandomData(20, 20, 80) // Datos de ejemplo
        }],
        chart: {
            height: 200,
            type: 'area',
            toolbar: {
                show: false
            },
            animations: {
                enabled: true
            }
        },
        colors: ['#0dcaf0'],
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.7,
                opacityTo: 0.3,
                stops: [0, 90, 100]
            }
        },
        stroke: {
            curve: 'smooth',
            width: 2,
        },
        tooltip: {
            y: {
                formatter: (val) => `${val}%`
            }
        },
        grid: {
            borderColor: '#e0e0e0',
            strokeDashArray: 5,
            xaxis: {
                lines: {
                    show: true
                }
            },
            yaxis: {
                lines: {
                    show: true
                }
            },
            padding: {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0
            },
        },
        xaxis: {
            categories: Array.from({ length: 20 }, (_, i) => i + 1),
            labels: {
                show: false
            }
        },
        yaxis: {
            min: 0,
            max: 100,
            labels: {
                formatter: (val) => `${val}%`
            }
        }
    };
    
    if (document.querySelector('#memoryUsageChart')) {
        charts.memory = new ApexCharts(document.querySelector('#memoryUsageChart'), memoryOptions);
        charts.memory.render();
    }
}

// Actualizar gráficos
function updateCharts() {
    // Actualizar con datos reales si están disponibles
    if (clientData && clientData.systemData) {
        // Datos de CPU (ejemplo)
        if (charts.cpu && clientData.systemData.cpu_history) {
            charts.cpu.updateSeries([{
                data: clientData.systemData.cpu_history
            }]);
        }
        
        // Datos de memoria (ejemplo)
        if (charts.memory && clientData.systemData.memory_history) {
            charts.memory.updateSeries([{
                data: clientData.systemData.memory_history
            }]);
        }
    }
}

// Actualizar actividad reciente
function updateRecentActivity() {
    const container = document.getElementById('recentActivityContainer');
    if (!container) return;
    
    // Si no hay alertas, mostrar mensaje
    if (!clientData || !clientData.alerts || clientData.alerts.length === 0) {
        container.innerHTML = `
            <div class="text-center p-3 text-muted">
                <i class="fas fa-info-circle me-2"></i>No hay actividad reciente
            </div>
        `;
        return;
    }
    
    // Ordenar alertas por fecha (más recientes primero)
    const sortedAlerts = [...clientData.alerts].sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
    );
    
    // Mostrar alertas como actividades
    container.innerHTML = '';
    
    sortedAlerts.forEach(alert => {
        addActivity(alert.severity, alert.message, new Date(alert.timestamp));
    });
}

// Agregar actividad
function addActivity(severity, message, timestamp = new Date()) {
    const container = document.getElementById('recentActivityContainer');
    if (!container) return;
    
    // Determinar icono y color según severidad
    let iconClass, bgColor;
    switch (severity) {
        case 'critical':
            iconClass = 'fas fa-exclamation-circle';
            bgColor = 'critical';
            break;
        case 'warning':
            iconClass = 'fas fa-exclamation-triangle';
            bgColor = 'warning';
            break;
        default:
            iconClass = 'fas fa-info-circle';
            bgColor = 'info';
    }
    
    // Crear elemento de actividad
    const activityItem = document.createElement('div');
    activityItem.className = 'activity-item';
    activityItem.innerHTML = `
        <div class="activity-icon ${bgColor}">
            <i class="${iconClass}"></i>
        </div>
        <div class="activity-content">
            <div class="activity-time">${timestamp.toLocaleTimeString()}</div>
            <p class="activity-message">${message}</p>
        </div>
    `;
    
    // Agregar al principio del contenedor
    if (container.firstChild) {
        container.insertBefore(activityItem, container.firstChild);
    } else {
        container.appendChild(activityItem);
    }
    
    // Eliminar mensaje de "no hay actividad" si existe
    const noActivityMessage = container.querySelector('.text-center.text-muted');
    if (noActivityMessage) {
        container.removeChild(noActivityMessage);
    }
}

// Cargar alertas del cliente
function loadClientAlerts() {
    if (!clientData || !clientData.channel) return;
    
    // Solicitar alertas específicas de este cliente
    fetch(`/api/alerts/${clientData.channel}?limit=50&sessionId=${sessionId}`)
        .then(response => response.json())
        .then(data => {
            if (data.alerts && data.alerts.length > 0) {
                // Actualizar pestaña de alertas
                updateAlertsTab(data.alerts);
                
                // Actualizar contador
                updateAlertCount(data.alerts.length);
            }
        })
        .catch(error => {
            console.error('Error cargando alertas:', error);
        });
}

// Actualizar pestaña de alertas
function updateAlertsTab(alerts) {
    const alertsContainer = document.querySelector('#alerts-tab-pane');
    if (!alertsContainer) return;
    
    // Ordenar por fecha (más recientes primero)
    alerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Crear tabla HTML
    let html = `
        <div class="table-responsive mt-3">
            <table class="table table-hover">
                <thead>
                    <tr>
                        <th>Timestamp</th>
                        <th>Tipo</th>
                        <th>Mensaje</th>
                        <th>Severidad</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    // Agregar filas
    alerts.forEach(alert => {
        // Determinar clase de severidad
        let severityClass;
        switch (alert.severity) {
            case 'critical':
                severityClass = 'bg-danger text-white';
                break;
            case 'warning':
                severityClass = 'bg-warning';
                break;
            default:
                severityClass = 'bg-info text-white';
        }
        
        html += `
            <tr>
                <td>${new Date(alert.timestamp).toLocaleString()}</td>
                <td>${alert.eventType || 'otro'}</td>
                <td>${alert.message}</td>
                <td><span class="badge ${severityClass}">${alert.severity}</span></td>
                <td>${alert.handled ? `<span class="badge bg-success">Gestionada por ${alert.handledBy}</span>` : '<span class="badge bg-secondary">Pendiente</span>'}</td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    alertsContainer.innerHTML = html;
}

// Actualizar contador de alertas
function updateAlertCount(count) {
    const badge = document.getElementById('alertsBadge');
    if (!badge) return;
    
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-flex';
    } else {
        badge.style.display = 'none';
    }
}

// Solicitar captura de pantalla
function requestScreenshot() {
    fetch(`/api/request-screenshot/${sessionId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            addActivity('info', 'Captura de pantalla solicitada. Esperando respuesta...');
        } else {
            addActivity('warning', `Error al solicitar captura: ${data.error}`);
        }
    })
    .catch(error => {
        console.error('Error solicitando captura:', error);
        addActivity('warning', 'Error al solicitar captura de pantalla');
    });
}

// Mostrar captura de pantalla
function showScreenshot(imageData, timestamp) {
    const container = document.querySelector('#screenshots-tab-pane');
    if (!container) return;
    
    // Crear elemento para la captura
    const screenshotItem = document.createElement('div');
    screenshotItem.className = 'screenshot-item mb-4';
    
    screenshotItem.innerHTML = `
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <div>
                    <i class="fas fa-camera me-2"></i>
                    Captura de pantalla (${new Date(timestamp).toLocaleString()})
                </div>
                <button class="btn btn-sm btn-outline-secondary screenshot-fullscreen-btn">
                    <i class="fas fa-expand"></i>
                </button>
            </div>
            <div class="card-body p-0">
                <img src="data:image/jpeg;base64,${imageData}" class="img-fluid" alt="Captura de pantalla">
            </div>
        </div>
    `;
    
    // Agregar al contenedor
    if (container.querySelector('.text-center.text-muted')) {
        container.innerHTML = '';
    }
    
    container.insertBefore(screenshotItem, container.firstChild);
    
    // Evento para ver en pantalla completa
    screenshotItem.querySelector('.screenshot-fullscreen-btn').addEventListener('click', function() {
        // Crear modal para vista ampliada
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.setAttribute('tabindex', '-1');
        
        modal.innerHTML = `
            <div class="modal-dialog modal-xl modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Captura de pantalla (${new Date(timestamp).toLocaleString()})</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body p-0">
                        <img src="data:image/jpeg;base64,${imageData}" class="img-fluid" alt="Captura de pantalla">
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Inicializar y mostrar el modal
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        
        // Eliminar el modal del DOM cuando se cierre
        modal.addEventListener('hidden.bs.modal', function() {
            document.body.removeChild(modal);
        });
    });
}

// Enviar advertencia al cliente
function sendWarning() {
    const message = prompt('Escriba el mensaje de advertencia para el jugador:');
    if (!message) return;
    
    // Enviar solicitud al servidor
    fetch(`/api/send-warning/${sessionId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            addActivity('warning', `Advertencia enviada: "${message}"`);
        } else {
            addActivity('warning', `Error al enviar advertencia: ${data.error}`);
        }
    })
    .catch(error => {
        console.error('Error enviando advertencia:', error);
        addActivity('warning', 'Error al enviar advertencia');
    });
}

// Confirmar descalificación
function confirmDisqualification() {
    const reason = prompt('Motivo de la descalificación:');
    if (!reason) return;
    
    if (confirm(`¿Está seguro que desea descalificar a este jugador por el motivo: "${reason}"? Esta acción no se puede deshacer.`)) {
        // Enviar solicitud al servidor
        fetch(`/api/disqualify/${sessionId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                addActivity('critical', `Jugador descalificado: "${reason}"`);
                alert('El jugador ha sido descalificado exitosamente');
            } else {
                addActivity('warning', `Error al descalificar: ${data.error}`);
            }
        })
        .catch(error => {
            console.error('Error descalificando:', error);
            addActivity('warning', 'Error al descalificar al jugador');
        });
    }
}

// Actualizar gráficos específicos de cada pestaña
function updateChartsForTab(tabId) {
    console.log(`Actualizando gráficos para pestaña: ${tabId}`);
    
    // Actualizar solo si la pestaña contiene gráficos
    if (tabId === '#overview-tab-pane') {
        if (charts.cpu) charts.cpu.render();
        if (charts.memory) charts.memory.render();
    }
}

// Reproducir sonido según severidad
function playSound(severity) {
    let audio;
    
    switch (severity) {
        case 'critical':
            audio = new Audio('/sounds/critical.mp3');
            break;
        case 'warning':
            audio = new Audio('/sounds/warning.mp3');
            break;
        default:
            audio = new Audio('/sounds/info.mp3');
    }
    
    audio.play().catch(e => console.log('No se pudo reproducir el sonido:', e));
}

// Mostrar mensaje de error
function showError(message) {
    document.getElementById('loadingContainer').style.display = 'none';
    document.getElementById('clientDetails').style.display = 'none';
    document.getElementById('errorContainer').style.display = 'block';
    document.getElementById('errorMessage').textContent = message;
}

// Función para generar datos aleatorios (para demostración)
function generateRandomData(count, min, max) {
    const data = [];
    for (let i = 0; i < count; i++) {
        data.push(Math.floor(Math.random() * (max - min + 1)) + min);
    }
    return data;
}
