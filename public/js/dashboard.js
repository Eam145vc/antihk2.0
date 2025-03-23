// dashboard.js - Script principal para el funcionamiento del dashboard de monitoreo anti-cheat

// Variables globales
let socket;
let currentChannel = 'Canal 1';
let clients = [];
let alerts = [];
let selectedClientId = null;
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
    initializeSocket();
    setupEventListeners();
    loadClients();
    initializeCharts();

    // Simular el incremento/decremento del puntaje de confianza (solo para demo)
    setInterval(simulateTrustScoreChanges, 5000);

    // Simular actividad en tiempo real (solo para demo)
    setInterval(simulateRealtimeActivity, 15000);
});

// Inicializar conexión Socket.io
function initializeSocket() {
    // Conectar al servidor Socket.io
    const serverUrl = window.location.origin;
    socket = io(serverUrl);

    // Unirse al canal seleccionado
    socket.emit('join-channel', currentChannel);

    // Escuchar actualizaciones de clientes
    socket.on('client-update', handleClientUpdate);

    // Escuchar alertas
    socket.on('client-alert', handleClientAlert);

    // Manejar desconexión
    socket.on('disconnect', () => {
        console.log('Desconectado del servidor');
        // Intentar reconectar automáticamente
        setTimeout(() => {
            socket.connect();
        }, 5000);
    });

    // Manejar reconexión
    socket.on('connect', () => {
        console.log('Reconectado al servidor');
        socket.emit('join-channel', currentChannel);
    });
}

// Configurar event listeners
function setupEventListeners() {
    // Cambio de canal
    const channelSelect = document.getElementById('channelSelect');
    if (channelSelect) {
        channelSelect.value = currentChannel;
        channelSelect.addEventListener('change', (e) => {
            currentChannel = e.target.value;
            socket.emit('join-channel', currentChannel);
            loadClients();
        });
    }

    // Botón de actualizar
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadClients);
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

    // Botones de interacción en el modal de decisión
    const warningBtn = document.getElementById('warningBtn');
    if (warningBtn) {
        warningBtn.addEventListener('click', () => {
            // Enviar advertencia al cliente
            sendWarningToClient();
            // Cerrar el modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('decisionModal'));
            modal.hide();
        });
    }

    const disqualifyBtn = document.getElementById('disqualifyBtn');
    if (disqualifyBtn) {
        disqualifyBtn.addEventListener('click', () => {
            // Descalificar al cliente
            disqualifyClient();
            // Cerrar el modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('decisionModal'));
            modal.hide();
        });
    }

    // Delegación de eventos para botones de detalle
    document.addEventListener('click', (e) => {
        // Botones de detalle en tabla de jugadores
        const detailBtn = e.target.closest('.detail-btn');
        if (detailBtn) {
            const row = detailBtn.closest('tr');
            if (row) {
                const sessionId = row.dataset.sessionId;
                if (sessionId) {
                    viewClientDetails(sessionId);
                }
            }
        }
    });
}

// Inicializar gráficos
function initializeCharts() {
    // Gráfico de puntuación de confianza
    charts.trustScore = initTrustScoreChart();

    // Gráficos de métricas
    charts.processes = initMetricChart('processesChart', '#dc3545');
    charts.network = initMetricChart('networkChart', '#0dcaf0');
    charts.usb = initMetricChart('usbChart', '#ffc107');
}

// Inicializar gráfico de puntuación de confianza
function initTrustScoreChart() {
    const options = {
        series: [{
            name: 'Puntuación',
            data: generateRandomData(20, 60, 100)
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
            x: {
                show: false,
            }
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
        const chart = new ApexCharts(document.querySelector('#trustScoreChart'), options);
        chart.render();
        return chart;
    }
    return null;
}

// Inicializar gráfico de métrica básico
function initMetricChart(elementId, color) {
    const options = {
        series: [{
            name: 'Valor',
            data: generateRandomData(10, 10, 30)
        }],
        chart: {
            height: 70,
            type: 'area',
            toolbar: {
                show: false
            },
            sparkline: {
                enabled: true
            },
        },
        colors: [color],
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
            fixed: {
                enabled: false
            },
            x: {
                show: false
            },
            marker: {
                show: false
            }
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
            labels: {
                show: false
            }
        }
    };

    const element = document.querySelector(`#${elementId}`);
    if (element) {
        const chart = new ApexCharts(element, options);
        chart.render();
        return chart;
    }
    return null;
}

// Función para generar datos aleatorios para los gráficos
function generateRandomData(count, min, max) {
    const data = [];
    for (let i = 0; i < count; i++) {
        data.push(Math.floor(Math.random() * (max - min + 1)) + min);
    }
    return data;
}

// Cargar lista de clientes
function loadClients() {
    const playersTableBody = document.getElementById('playersTableBody');
    if (!playersTableBody) return;

    // Mostrar indicador de carga
    playersTableBody.innerHTML = `
        <tr>
            <td colspan="5" class="text-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Cargando...</span>
                </div>
                <p class="mt-2">Cargando jugadores...</p>
            </td>
        </tr>
    `;

    // Realizar la solicitud AJAX
    fetch(`/api/clients/${currentChannel}`)
        .then(response => response.json())
        .then(data => {
            clients = data;
            renderClientTable();
            updateConnectedPlayersCount();
        })
        .catch(error => {
            console.error('Error cargando clientes:', error);
            playersTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-danger">
                        <i class="fas fa-exclamation-triangle me-2"></i>Error cargando jugadores
                    </td>
                </tr>
            `;
        });
}

// Renderizar tabla de clientes
function renderClientTable() {
    const playersTableBody = document.getElementById('playersTableBody');
    if (!playersTableBody) return;

    if (clients.length === 0) {
        playersTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted">
                    <i class="fas fa-info-circle me-2"></i>No hay jugadores monitoreados en este canal
                </td>
            </tr>
        `;
        return;
    }

    playersTableBody.innerHTML = clients
        .sort((a, b) => a.trustScore - b.trustScore) // Ordenar por puntuación ascendente (los de menor confianza primero)
        .map(client => {
            // Determinar el color basado en el puntaje de confianza
            let trustScoreClass, trustLevel;
            if (client.trustScore >= RISK_LEVELS.LOW.threshold) {
                trustScoreClass = 'bg-success';
                trustLevel = 'Normal';
            } else if (client.trustScore >= RISK_LEVELS.MEDIUM.threshold) {
                trustScoreClass = 'bg-warning text-dark';
                trustLevel = 'Sospechoso';
            } else {
                trustScoreClass = 'bg-danger';
                trustLevel = 'Crítico';
            }
            
            return `
                <tr data-session-id="${client.sessionId}" class="${client.trustScore < RISK_LEVELS.MEDIUM.threshold ? 'table-danger' : (client.trustScore < RISK_LEVELS.LOW.threshold ? 'table-warning' : '')}">
                    <td>${client.participantId}</td>
                    <td>
                        <div class="progress" style="height: 20px;">
                            <div class="progress-bar ${trustScoreClass}" role="progressbar" style="width: ${client.trustScore}%" aria-valuenow="${client.trustScore}" aria-valuemin="0" aria-valuemax="100">${client.trustScore}%</div>
                        </div>
                        <small class="text-muted">${trustLevel}</small>
                    </td>
                    <td><span class="badge bg-success"><i class="fas fa-circle me-1 status-online"></i>Online</span></td>
                    <td>${client.alerts?.length > 0 ? `<span class="badge bg-danger">${client.alerts.length}</span>` : '-'}</td>
                    <td>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-primary detail-btn">
                                <i class="fas fa-info-circle"></i> Detalles
                            </button>
                            <button type="button" class="btn btn-sm btn-primary dropdown-toggle dropdown-toggle-split" data-bs-toggle="dropdown" aria-expanded="false">
                                <span class="visually-hidden">Toggle Dropdown</span>
                            </button>
                            <ul class="dropdown-menu">
                                <li><h6 class="dropdown-header">Acciones</h6></li>
                                <li><a class="dropdown-item screenshot-btn" href="#" data-session-id="${client.sessionId}"><i class="fas fa-camera me-2"></i>Capturar pantalla</a></li>
                                <li><a class="dropdown-item warning-btn" href="#" data-session-id="${client.sessionId}"><i class="fas fa-comment me-2"></i>Enviar advertencia</a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item text-danger disqualify-btn" href="#" data-session-id="${client.sessionId}"><i class="fas fa-ban me-2"></i>Descalificar</a></li>
                            </ul>
                        </div>
                    </td>
                </tr>
            `;
        })
        .join('');

    // Agregar event listeners para los botones de acción
    document.querySelectorAll('.screenshot-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            requestScreenshot(btn.dataset.sessionId);
        });
    });

    document.querySelectorAll('.warning-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            sendWarningToClient(btn.dataset.sessionId);
        });
    });

    document.querySelectorAll('.disqualify-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            confirmDisqualification(btn.dataset.sessionId);
        });
    });
}

// Actualizar contador de jugadores conectados
function updateConnectedPlayersCount() {
    const connectedPlayersElement = document.getElementById('connectedPlayers');
    if (connectedPlayersElement) {
        connectedPlayersElement.textContent = clients.length;
    }
}

// Manejar actualización de cliente
function handleClientUpdate(clientData) {
    console.log('Actualización de cliente recibida:', clientData);
    
    // Actualizar la lista de clientes
    const index = clients.findIndex(c => c.sessionId === clientData.sessionId);
    if (index >= 0) {
        clients[index] = clientData;
    } else {
        clients.push(clientData);
    }

    // Actualizar la tabla
    renderClientTable();
    
    // Actualizar contador de jugadores
    updateConnectedPlayersCount();
    
    // Actualizar actividad reciente
    addRecentActivity('info', `${clientData.participantId} ha enviado actualización de estado`);
}

// Manejar alerta de cliente
function handleClientAlert(alertData) {
    console.log('Alerta recibida:', alertData);
    
    // Reproducir sonido de alerta
    playAlertSound(alertData.severity || 'warning');

    // Agregar a la lista de alertas
    alerts.unshift(alertData);
    if (alerts.length > 50) alerts.pop(); // Mantener solo las últimas 50 alertas

    // Actualizar contador de alertas para el cliente
    const client = clients.find(c => c.sessionId === alertData.sessionId);
    if (client) {
        if (!client.alerts) client.alerts = [];
        client.alerts.push({
            timestamp: new Date(),
            message: alertData.message,
            severity: alertData.severity || 'warning'
        });
    }

    // Actualizar tabla de clientes
    renderClientTable();

    // Mostrar notificación
    showAlertNotification(alertData);

    // Agregar a actividad reciente
    addRecentActivity(alertData.severity || 'warning', alertData.message, alertData.participantId);
    
    // Actualizar las alertas críticas
    updateCriticalAlerts();
    
    // Actualizar contador de alertas
    updateAlertCount();
    
    // Incrementar contador en la pestaña correspondiente
    if (alertData.eventType) {
        updateTabBadge(alertData.eventType);
    }

    // Si es crítica, mostrar modal de decisión
    if (alertData.severity === 'critical') {
        showDecisionModal(alertData);
    }
}

// Reproducir sonido de alerta
function playAlertSound(severity) {
    let soundElement;

    switch (severity) {
        case 'critical':
            soundElement = document.getElementById('alertSoundCritical');
            break;
        case 'warning':
            soundElement = document.getElementById('alertSoundWarning');
            break;
        default:
            soundElement = document.getElementById('alertSoundInfo');
    }

    if (soundElement) {
        soundElement.currentTime = 0;
        soundElement.play().catch(e => console.log('No se pudo reproducir el sonido:', e));
    }
}

// Mostrar notificación de alerta
function showAlertNotification(alertData) {
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = 'alert-popup';

    // Definir clase de severidad
    let severityClass = '';
    switch (alertData.severity) {
        case 'critical':
            severityClass = 'bg-danger';
            break;
        case 'warning':
            severityClass = 'bg-warning text-dark';
            break;
        default:
            severityClass = 'bg-info';
    }

    notification.innerHTML = `
        <div class="alert-popup-header ${severityClass}">
            <strong>¡Alerta${alertData.severity === 'critical' ? ' Crítica' : ''}! Jugador: ${alertData.participantId}</strong>
            <button type="button" class="btn-close btn-close-white"></button>
        </div>
        <div class="alert-popup-body">
            <p class="alert-message">${alertData.message}</p>
            <p class="text-muted mt-2">${new Date().toLocaleTimeString()}</p>
        </div>
        <div class="alert-popup-footer">
            <button class="btn btn-sm btn-danger view-player-btn" data-session-id="${alertData.sessionId}">
                Ver Jugador
            </button>
        </div>
    `;

    // Agregar evento para cerrar la notificación
    notification.querySelector('.btn-close').addEventListener('click', () => {
        if (document.body.contains(notification)) {
            document.body.removeChild(notification);
        }
    });

    // Agregar evento para ver el jugador
    notification.querySelector('.view-player-btn').addEventListener('click', () => {
        if (document.body.contains(notification)) {
            document.body.removeChild(notification);
        }
        viewClientDetails(alertData.sessionId);
    });

    // Agregar al DOM
    document.body.appendChild(notification);

    // Auto cerrar después de 10 segundos
    setTimeout(() => {
        if (document.body.contains(notification)) {
            document.body.removeChild(notification);
        }
    }, 10000);
}

// Actualizar alertas críticas
function updateCriticalAlerts() {
    const container = document.getElementById('criticalAlertsContainer');
    if (!container) return;
    
    // Filtrar solo alertas críticas
    const criticalAlerts = alerts.filter(alert => alert.severity === 'critical');
    
    if (criticalAlerts.length === 0) {
        container.innerHTML = `
            <div class="text-center p-3 text-muted">
                <i class="fas fa-info-circle me-2"></i>No hay alertas críticas recientes
            </div>
        `;
        return;
    }
    
    container.innerHTML = criticalAlerts
        .slice(0, 5) // Mostrar solo las 5 más recientes
        .map(alert => `
            <div class="alert-item">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <strong>${alert.participantId}</strong>: ${alert.message}
                    </div>
                    <div class="ms-2">
                        <button class="btn btn-sm btn-outline-danger" onclick="viewClientDetails('${alert.sessionId}')">
                            <i class="fas fa-search"></i>
                        </button>
                    </div>
                </div>
                <div class="timestamp">${new Date(alert.timestamp).toLocaleTimeString()}</div>
            </div>
        `)
        .join('');
}

// Actualizar contador de alertas
function updateAlertCount() {
    const alertCountElement = document.getElementById('alertCount');
    if (alertCountElement) {
        const criticalCount = alerts.filter(alert => alert.severity === 'critical').length;
        alertCountElement.textContent = criticalCount;
        
        // Mostrar u ocultar el contador según si hay alertas críticas
        alertCountElement.style.display = criticalCount > 0 ? 'inline-block' : 'none';
    }
}

// Actualizar badge de pestaña
function updateTabBadge(eventType) {
    // Mapeo de tipos de evento a pestañas
    const tabMapping = {
        'process': 'processesBadge',
        'network': 'networkBadge',
        'device': 'devicesBadge',
        'system': 'systemBadge'
    };

    // Si el tipo de evento tiene una pestaña correspondiente
    if (tabMapping[eventType]) {
        const badgeElement = document.getElementById(tabMapping[eventType]);
        if (badgeElement) {
            // Incrementar el contador
            let count = parseInt(badgeElement.textContent || '0');
            badgeElement.textContent = count + 1;
            
            // Hacer visible
            badgeElement.style.display = 'inline-flex';
        }
    }
}

// Agregar evento a actividad reciente
function addRecentActivity(type, message, user = '') {
    const container = document.getElementById('recentActivityContainer');
    if (!container) return;
    
    // Determinar icono y color según tipo
    let iconClass, bgColor;
    switch (type) {
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
            <div class="activity-time">${new Date().toLocaleTimeString()}</div>
            <p class="activity-message">${user ? `<strong>${user}:</strong> ` : ''}${message}</p>
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
    
    // Limitar a 20 elementos
    const items = container.querySelectorAll('.activity-item');
    if (items.length > 20) {
        container.removeChild(items[items.length - 1]);
    }
}

// Mostrar modal de decisión
function showDecisionModal(alertData) {
    const modal = document.getElementById('decisionModal');
    if (!modal) return;
    
    // Actualizar contenido del modal
    const playerNameElement = document.getElementById('playerWithAlert');
    if (playerNameElement) {
        playerNameElement.textContent = alertData.participantId || 'Jugador';
    }
    
    // Actualizar lista de evidencias
    const evidenceList = document.getElementById('alertEvidenceList');
    if (evidenceList) {
        evidenceList.innerHTML = `<li>${alertData.message}</li>`;
        
        // Agregar otras alertas recientes del mismo jugador
        const recentAlerts = alerts.filter(
            alert => alert.participantId === alertData.participantId && 
                   alert.sessionId === alertData.sessionId &&
                   alert.message !== alertData.message
        ).slice(0, 2); // Solo las 2 más recientes
        
        recentAlerts.forEach(alert => {
            evidenceList.innerHTML += `<li>${alert.message}</li>`;
        });
    }
    
    // Guardar sessionId seleccionado
    selectedClientId = alertData.sessionId;
    
    // Mostrar el modal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

// Ver detalles del cliente
function viewClientDetails(sessionId) {
    // Redirigir a la página de detalles del cliente
    console.log(`Ver detalles del cliente: ${sessionId}`);
    window.location.href = `/client-details.html?id=${sessionId}`;
}

// Solicitar captura de pantalla
function requestScreenshot(sessionId) {
    // Enviar solicitud al servidor
    fetch(`/api/request-screenshot/${sessionId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            addRecentActivity('info', `Captura de pantalla solicitada para ${getClientName(sessionId)}`);
        } else {
            addRecentActivity('warning', `Error al solicitar captura de pantalla: ${data.error}`);
        }
    })
    .catch(error => {
        console.error('Error solicitando captura:', error);
        addRecentActivity('warning', 'Error al solicitar captura de pantalla');
    });
}

// Obtener nombre del cliente por ID
function getClientName(sessionId) {
    const client = clients.find(c => c.sessionId === sessionId);
    return client ? client.participantId : 'Cliente desconocido';
}

// Enviar advertencia a un cliente
function sendWarningToClient(sessionId = selectedClientId) {
    if (!sessionId) return;
    
    // Implementar lógica para enviar advertencia
    console.log(`Enviando advertencia al cliente: ${sessionId}`);
    
    // Mostrar en actividad reciente
    addRecentActivity('warning', `Advertencia enviada a ${getClientName(sessionId)}`);
    
    // En una implementación real, se enviaría al servidor
    // fetch('/api/send-warning/' + sessionId, { method: 'POST' })
}

// Confirmar descalificación
function confirmDisqualification(sessionId = selectedClientId) {
    if (!sessionId) return;
    
    if (confirm(`¿Está seguro que desea descalificar a ${getClientName(sessionId)}? Esta acción no se puede deshacer.`)) {
        disqualifyClient(sessionId);
    }
}

// Descalificar a un cliente
function disqualifyClient(sessionId = selectedClientId) {
    if (!sessionId) return;
    
    // Implementar lógica para descalificar
    console.log(`Descalificando al cliente: ${sessionId}`);
    
    // Mostrar en actividad reciente
    addRecentActivity('critical', `${getClientName(sessionId)} ha sido descalificado`);
    
    // En una implementación real, se enviaría al servidor
    // fetch('/api/disqualify/' + sessionId, { method: 'POST' })
}

// Actualizar gráficos para la pestaña actual
function updateChartsForTab(tabId) {
    // Implementar actualización de gráficos específicos para cada pestaña
    console.log(`Actualizando gráficos para pestaña: ${tabId}`);
    
    // Por ahora solo actualizamos el gráfico de confianza que es común
    if (charts.trustScore) {
        charts.trustScore.updateSeries([{
            data: generateRandomData(20, 60, 100)
        }]);
    }
}

// Simular cambios en la puntuación de confianza (demo)
function simulateTrustScoreChanges() {
    // Solo para demostración
    if (clients.length > 0) {
        // Seleccionar un cliente aleatorio
        const randomIndex = Math.floor(Math.random() * clients.length);
        const client = clients[randomIndex];
        
        // Cambiar su puntuación entre -5 y +3
        const change = Math.floor(Math.random() * 9) - 5;
        let newScore = client.trustScore + change;
        
        // Asegurar que esté entre 0 y 100
        newScore = Math.max(0, Math.min(100, newScore));
        
        if (newScore !== client.trustScore) {
            clients[randomIndex].trustScore = newScore;
            
            // Actualizar UI
            renderClientTable();
            
            // Agregar actividad
            if (change < 0) {
                addRecentActivity('warning', `La puntuación de confianza de ${client.participantId} ha disminuido a ${newScore}%`);
            } else {
                addRecentActivity('info', `La puntuación de confianza de ${client.participantId} ha aumentado a ${newScore}%`);
            }
        }
    }
}

// Simular actividad en tiempo real (demo)
function simulateRealtimeActivity() {
    // Solo para demostración
    if (clients.length > 0) {
        // Seleccionar un cliente aleatorio
        const randomIndex = Math.floor(Math.random() * clients.length);
        const client = clients[randomIndex];
        
        // Tipos de actividades de ejemplo
        const activities = [
            { type: 'info', message: 'Actualización de antivirus recibida' },
            { type: 'info', message: 'Conexión a servidor de juego verificada' },
            { type: 'warning', message: 'Rendimiento del sistema fluctuante' },
            { type: 'warning', message: 'Intento de ejecución de proceso no autorizado' },
            { type: 'info', message: 'Captura de pantalla programada completada' }
        ];
        
        // Seleccionar actividad aleatoria
        const activity = activities[Math.floor(Math.random() * activities.length)];
        
        // Agregar actividad
        addRecentActivity(activity.type, activity.message, client.participantId);
    }
}
