// client-details.js - Script para la página de detalles del cliente

// Esperar a que el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM cargado. Iniciando aplicación...");
    
    // Obtener ID del cliente de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('id');
    
    if (!sessionId) {
        showError('No se proporcionó un ID de cliente válido');
        return;
    }
    
    console.log("SessionID obtenido:", sessionId);
    
    // Inicializar Socket.io
    initializeSocketIO(sessionId);
    
    // Configurar eventos de botones
    setupButtonListeners(sessionId);
    
    // Cargar datos del cliente
    fetchClientData(sessionId);

    // Precargar contenido para todas las pestañas
    preloadTabContents(sessionId);
});

// Variables globales
let socket;
let clientData = null;
let charts = {};
let trustScoreHistory = [];

// Constantes
const RISK_LEVELS = {
    LOW: { threshold: 70, color: '#28a745', text: 'NORMAL' },
    MEDIUM: { threshold: 40, color: '#ffc107', text: 'SOSPECHOSO' },
    HIGH: { threshold: 0, color: '#dc3545', text: 'CRÍTICO' }
};

// Inicializar Socket.io
function initializeSocketIO(sessionId) {
    console.log("Inicializando Socket.io");
    try {
        // Conectar al servidor Socket.io
        const serverUrl = window.location.origin;
        socket = io(serverUrl);
        
        // Escuchar conexión
        socket.on('connect', () => {
            console.log('Conectado a Socket.io. ID de socket:', socket.id);
            
            // Unirse al canal si ya tenemos datos del cliente
            if (clientData && clientData.channel) {
                console.log('Uniéndose al canal:', clientData.channel);
                socket.emit('join-channel', clientData.channel);
            }
        });
        
        // Escuchar actualizaciones del cliente
        socket.on('client-update', (data) => {
            if (data.sessionId === sessionId) {
                console.log('Actualización del cliente recibida:', data);
                clientData = data;
                updateClientUI();
                
                // Actualizar pestaña activa si hay una
                const activeTab = document.querySelector('.tab-pane.active');
                if (activeTab) {
                    loadTabContent('#' + activeTab.id, sessionId);
                }
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
                
                // Actualizar pestaña de alertas si está visible
                if (document.querySelector('#alerts-tab-pane.active')) {
                    displayAlertsTab(sessionId, clientData.channel);
                }
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
        
        // Manejar desconexión
        socket.on('disconnect', () => {
            console.log('Desconectado de Socket.io');
        });
        
        // Manejar errores
        socket.on('error', (error) => {
            console.error('Error de Socket.io:', error);
        });
        
        // Manejar errores de conexión
        socket.on('connect_error', (error) => {
            console.error('Error conectando a Socket.io:', error);
        });
    } catch (error) {
        console.error('Error inicializando Socket.io:', error);
    }
}

// Configurar listeners de botones
function setupButtonListeners(sessionId) {
    console.log("Configurando event listeners para botones");
    
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
        refreshBtn.addEventListener('click', () => {
            fetchClientData(sessionId);
        });
    }
    
    // Botón de captura de pantalla
    const screenshotBtn = document.getElementById('screenshotBtn');
    if (screenshotBtn) {
        screenshotBtn.addEventListener('click', () => {
            requestScreenshot(sessionId);
        });
    }
    
    // Botón de advertencia
    const warnBtn = document.getElementById('warnBtn');
    if (warnBtn) {
        warnBtn.addEventListener('click', () => {
            sendWarning(sessionId);
        });
    }
    
    // Botón de descalificación
    const disqualifyBtn = document.getElementById('disqualifyBtn');
    if (disqualifyBtn) {
        disqualifyBtn.addEventListener('click', () => {
            confirmDisqualification(sessionId);
        });
    }
    
    // Manejo de pestañas para mostrar contenido cuando se seleccionan
    const tabElements = document.querySelectorAll('button[data-bs-toggle="tab"]');
    tabElements.forEach(tabElement => {
        tabElement.addEventListener('shown.bs.tab', (event) => {
            const targetId = event.target.getAttribute('data-bs-target');
            console.log('Pestaña seleccionada:', targetId);
            
            const targetPane = document.querySelector(targetId);
            if (targetPane) {
                loadTabContent(targetId, sessionId);
            }
        });
    });
}

// Precargar contenido para todas las pestañas
function preloadTabContents(sessionId) {
    console.log("Precargando contenido para todas las pestañas");
    
    // Crear contenido dummy para cada pestaña para evitar que se vean vacías
    const tabContents = {
        '#overview-tab-pane': '', // Se carga durante fetchClientData
        '#alerts-tab-pane': createLoadingHTML('Cargando alertas...'),
        '#processes-tab-pane': createLoadingHTML('Cargando procesos...'),
        '#network-tab-pane': createLoadingHTML('Cargando conexiones de red...'),
        '#devices-tab-pane': createLoadingHTML('Cargando dispositivos...'),
        '#screenshots-tab-pane': createLoadingHTML('Cargando capturas de pantalla...')
    };
    
    // Establecer contenido inicial para cada pestaña
    Object.entries(tabContents).forEach(([selector, content]) => {
        const tabPane = document.querySelector(selector);
        if (tabPane && content) {
            tabPane.innerHTML = content;
        }
    });
}

// Crear HTML de carga
function createLoadingHTML(message) {
    return `
        <div class="p-4 text-center loading-indicator">
            <div class="spinner-border text-primary mb-3" role="status">
                <span class="visually-hidden">Cargando...</span>
            </div>
            <p>${message || 'Cargando...'}</p>
        </div>
    `;
}

// Cargar contenido específico para cada pestaña
function loadTabContent(tabId, sessionId) {
    console.log(`Cargando contenido para pestaña: ${tabId}`);
    
    if (!clientData) {
        console.log("No hay datos de cliente disponibles para cargar pestaña");
        return;
    }
    
    // Actualizar gráficos para la pestaña activa
    updateChartsForTab(tabId);
    
    // Cargar el contenido específico para cada pestaña
    switch (tabId) {
        case '#overview-tab-pane':
            // La pestaña de resumen ya se carga durante fetchClientData
            break;
            
        case '#alerts-tab-pane':
            // Cargar alertas
            if (clientData.channel) {
                displayAlertsTab(sessionId, clientData.channel);
            }
            break;
            
        case '#processes-tab-pane':
            // Cargar procesos
            if (clientData.systemData && clientData.systemData.system_data && clientData.systemData.system_data.processes) {
                displayProcessesTab(clientData.systemData.system_data.processes);
            } else {
                // Mostrar mensaje si no hay datos
                const container = document.querySelector('#processes-tab-pane');
                if (container) {
                    container.innerHTML = `
                        <div class="p-5 text-center text-muted">
                            <i class="fas fa-info-circle fa-3x mb-3"></i>
                            <p>No hay información de procesos disponible</p>
                        </div>
                    `;
                }
            }
            break;
            
        case '#network-tab-pane':
            // Cargar conexiones de red si están disponibles
            if (clientData.systemData && clientData.systemData.network) {
                displayNetworkTab(clientData.systemData.network);
            } else {
                // Mostrar mensaje si no hay datos
                const container = document.querySelector('#network-tab-pane');
                if (container) {
                    container.innerHTML = `
                        <div class="p-5 text-center text-muted">
                            <i class="fas fa-network-wired fa-3x mb-3"></i>
                            <p>No hay información de red disponible</p>
                        </div>
                    `;
                }
            }
            break;
            
        case '#devices-tab-pane':
            // Cargar dispositivos USB si están disponibles
            if (clientData.systemData && clientData.systemData.system_data && clientData.systemData.system_data.usb_devices) {
                displayDevicesTab(clientData.systemData.system_data.usb_devices);
            } else {
                // Mostrar mensaje si no hay datos
                const container = document.querySelector('#devices-tab-pane');
                if (container) {
                    container.innerHTML = `
                        <div class="p-5 text-center text-muted">
                            <i class="fas fa-usb fa-3x mb-3"></i>
                            <p>No hay dispositivos USB detectados</p>
                        </div>
                    `;
                }
            }
            break;
            
        case '#screenshots-tab-pane':
            // Mostrar mensaje de que no hay capturas disponibles
            displayNoScreenshots(sessionId);
            break;
    }
}

// Mostrar pestaña de alertas
function displayAlertsTab(sessionId, channel) {
    console.log("Mostrando pestaña de alertas");
    const container = document.querySelector('#alerts-tab-pane');
    if (!container) return;
    
    // Mostrar indicador de carga
    container.innerHTML = createLoadingHTML('Cargando alertas...');
    
    // Intentar cargar alertas desde la API
    fetch(`/api/alerts/${channel}?limit=50&sessionId=${sessionId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.alerts && data.alerts.length > 0) {
                console.log("Alertas recibidas:", data.alerts.length);
                renderAlertsTable(data.alerts);
                updateAlertCount(data.alerts.length);
            } else {
                console.log("No se encontraron alertas");
                container.innerHTML = `
                    <div class="p-5 text-center text-muted">
                        <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
                        <p>No hay alertas registradas para este cliente</p>
                    </div>
                `;
            }
        })
        .catch(error => {
            console.error('Error cargando alertas:', error);
            
            // Mostrar mensaje de error
            container.innerHTML = `
                <div class="p-4 text-center text-danger">
                    <i class="fas fa-exclamation-circle fa-3x mb-3"></i>
                    <p>Error cargando alertas: ${error.message}</p>
                    <button class="btn btn-primary mt-3" onclick="loadTabContent('#alerts-tab-pane', '${sessionId}')">
                        <i class="fas fa-sync me-2"></i>Reintentar
                    </button>
                </div>
            `;
        });
}

// Renderizar tabla de alertas
function renderAlertsTable(alerts) {
    console.log("Renderizando tabla de alertas");
    const container = document.querySelector('#alerts-tab-pane');
    if (!container) return;
    
    let html = `
        <div class="mt-3">
            <div class="d-flex justify-content-between mb-3">
                <h5><i class="fas fa-exclamation-triangle me-2"></i>Alertas (${alerts.length})</h5>
                <div>
                    <div class="input-group">
                        <select class="form-select form-select-sm" id="alertFilterSelect">
                            <option value="all">Todas las alertas</option>
                            <option value="critical">Solo críticas</option>
                            <option value="warning">Solo advertencias</option>
                            <option value="info">Solo informativas</option>
                        </select>
                        <button class="btn btn-sm btn-outline-secondary" id="refreshAlertsBtn">
                            <i class="fas fa-sync"></i>
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="table-responsive">
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
    
    // Ordenar alertas por fecha (más recientes primero)
    const sortedAlerts = [...alerts].sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
    );
    
    // Agregar filas
    sortedAlerts.forEach(alert => {
        // Determinar clase de severidad
        let severityClass;
        switch (alert.severity) {
            case 'critical':
                severityClass = 'bg-danger text-white';
                break;
            case 'warning':
                severityClass = 'bg-warning text-dark';
                break;
            default:
                severityClass = 'bg-info text-white';
        }
        
        html += `
            <tr data-severity="${alert.severity || 'info'}">
                <td>${new Date(alert.timestamp).toLocaleString()}</td>
                <td>${alert.eventType || 'otro'}</td>
                <td>${alert.message}</td>
                <td><span class="badge ${severityClass}">${alert.severity || 'info'}</span></td>
                <td>${alert.handled ? 
                    `<span class="badge bg-success">Gestionada por ${alert.handledBy || 'Sistema'}</span>` : 
                    '<span class="badge bg-secondary">Pendiente</span>'}</td>
            </tr>
        `;
    });
    
    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Configurar evento de filtro
    const filterSelect = document.getElementById('alertFilterSelect');
    if (filterSelect) {
        filterSelect.addEventListener('change', function() {
            const severity = this.value;
            filterAlertRows(severity);
        });
    }
    
    // Configurar evento de actualización
    const refreshBtn = document.getElementById('refreshAlertsBtn');
    if (refreshBtn && clientData) {
        refreshBtn.addEventListener('click', function() {
            displayAlertsTab(clientData.sessionId, clientData.channel);
        });
    }
}

// Filtrar filas de alertas
function filterAlertRows(severity) {
    const rows = document.querySelectorAll('#alerts-tab-pane tbody tr');
    
    rows.forEach(row => {
        if (severity === 'all' || row.dataset.severity === severity) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// Mostrar pestaña de procesos
function displayProcessesTab(processes) {
    console.log("Mostrando pestaña de procesos");
    const container = document.querySelector('#processes-tab-pane');
    if (!container) return;
    
    if (!processes || processes.length === 0) {
        container.innerHTML = `
            <div class="p-5 text-center text-muted">
                <i class="fas fa-tasks fa-3x mb-3"></i>
                <p>No hay información de procesos disponible</p>
            </div>
        `;
        return;
    }
    
    renderProcessesTable(processes);
}

// Renderizar tabla de procesos
function renderProcessesTable(processes) {
    console.log("Renderizando tabla de procesos");
    const container = document.querySelector('#processes-tab-pane');
    if (!container) return;
    
    // Ordenar procesos por uso de CPU (mayor a menor)
    const sortedProcesses = [...processes].sort((a, b) => 
        (b.cpu || 0) - (a.cpu || 0)
    );
    
    let html = `
        <div class="mt-3">
            <div class="d-flex justify-content-between mb-3">
                <h5><i class="fas fa-tasks me-2"></i>Procesos en ejecución (${processes.length})</h5>
                <div>
                    <div class="input-group">
                        <input type="text" class="form-control form-control-sm" placeholder="Buscar proceso..." id="processSearchInput">
                        <button class="btn btn-sm btn-outline-secondary" id="refreshProcessesBtn">
                            <i class="fas fa-sync"></i>
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>PID</th>
                            <th>Nombre</th>
                            <th>CPU %</th>
                            <th>Memoria (MB)</th>
                            <th>Ruta</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    sortedProcesses.forEach(process => {
        // Identificar procesos potencialmente sospechosos
        const isSuspicious = 
            (process.name && process.name.toLowerCase().includes('cheat')) || 
            (process.name && process.name.toLowerCase().includes('hack')) ||
            (process.path && process.path.toLowerCase().includes('temp'));
        
        html += `
            <tr class="${isSuspicious ? 'table-warning' : ''}">
                <td>${process.pid || 'N/A'}</td>
                <td>${process.name || 'Desconocido'}</td>
                <td>${typeof process.cpu === 'number' ? process.cpu.toFixed(1) : '0.0'}%</td>
                <td>${typeof process.memory === 'number' ? process.memory.toFixed(0) : '0'} MB</td>
                <td><small>${process.path || 'N/A'}</small></td>
                <td>
                    <button class="btn btn-sm btn-outline-danger kill-process-btn" data-pid="${process.pid}">
                        <i class="fas fa-times-circle"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Configurar evento de búsqueda
    const searchInput = document.getElementById('processSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const rows = document.querySelectorAll('#processes-tab-pane tbody tr');
            
            rows.forEach(row => {
                const processName = row.cells[1].textContent.toLowerCase();
                const processPath = row.cells[4].textContent.toLowerCase();
                
                if (processName.includes(searchTerm) || processPath.includes(searchTerm)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        });
    }
    
    // Configurar evento de actualización
    const refreshBtn = document.getElementById('refreshProcessesBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            loadTabContent('#processes-tab-pane', clientData ? clientData.sessionId : null);
        });
    }
    
    // Configurar eventos para botones de terminar proceso
    const killBtns = document.querySelectorAll('.kill-process-btn');
    killBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const pid = this.getAttribute('data-pid');
            terminateProcess(pid);
        });
    });
}

// Terminar un proceso
function terminateProcess(pid) {
    console.log(`Solicitando terminar proceso: ${pid}`);
    if (clientData && clientData.sessionId) {
        // Enviar solicitud al servidor
        fetch(`/api/kill-process/${clientData.sessionId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ processId: pid })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                addActivity('info', `Solicitud de terminación enviada para el proceso ${pid}`);
            } else {
                addActivity('warning', `Error al solicitar terminación: ${data.error}`);
            }
        })
        .catch(error => {
            console.error('Error solicitando terminación de proceso:', error);
            addActivity('warning', `Error al solicitar terminación: ${error.message}`);
        });
    } else {
        addActivity('warning', 'No se puede terminar el proceso: falta información del cliente');
    }
}

// Mostrar pestaña de red
function displayNetworkTab(connections) {
    console.log("Mostrando pestaña de red");
    const container = document.querySelector('#network-tab-pane');
    if (!container) return;
    
    if (!connections || connections.length === 0) {
        container.innerHTML = `
            <div class="p-5 text-center text-muted">
                <i class="fas fa-network-wired fa-3x mb-3"></i>
                <p>No hay información de red disponible</p>
            </div>
        `;
        return;
    }
    
    renderNetworkTable(connections);
}

// Renderizar tabla de conexiones de red
function renderNetworkTable(connections) {
    console.log("Renderizando tabla de conexiones de red");
    const container = document.querySelector('#network-tab-pane');
    if (!container) return;
    
    let html = `
        <div class="mt-3">
            <div class="d-flex justify-content-between mb-3">
                <h5><i class="fas fa-network-wired me-2"></i>Conexiones de red (${connections.length})</h5>
                <div>
                    <div class="input-group">
                        <input type="text" class="form-control form-control-sm" placeholder="Buscar conexión..." id="networkSearchInput">
                        <button class="btn btn-sm btn-outline-secondary" id="refreshNetworkBtn">
                            <i class="fas fa-sync"></i>
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>PID</th>
                            <th>Proceso</th>
                            <th>Protocolo</th>
                            <th>Dirección Local</th>
                            <th>Dirección Remota</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    connections.forEach(conn => {
        // Identificar conexiones potencialmente sospechosas
        const isSuspicious = 
            (conn.remoteAddr && !conn.remoteAddr.includes('192.168.') && 
             !conn.remoteAddr.includes('239.255.') && 
             !conn.state.includes('LISTENING'));
        
        html += `
            <tr class="${isSuspicious ? 'table-warning' : ''}">
                <td>${conn.pid || 'N/A'}</td>
                <td>${conn.process || 'Desconocido'}</td>
                <td>${conn.protocol || 'TCP'}</td>
                <td>${conn.localAddr || 'N/A'}</td>
                <td>${conn.remoteAddr || 'N/A'}</td>
                <td>${conn.state || 'UNKNOWN'}</td>
            </tr>
        `;
    });
    
    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Configurar evento de búsqueda
    const searchInput = document.getElementById('networkSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const rows = document.querySelectorAll('#network-tab-pane tbody tr');
            
            rows.forEach(row => {
                const processName = row.cells[1].textContent.toLowerCase();
                const remoteAddr = row.cells[4].textContent.toLowerCase();
                
                if (processName.includes(searchTerm) || remoteAddr.includes(searchTerm)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        });
    }
    
    // Configurar evento de actualización
    const refreshBtn = document.getElementById('refreshNetworkBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            loadTabContent('#network-tab-pane', clientData ? clientData.sessionId : null);
        });
    }
}

// Mostrar pestaña de dispositivos
function displayDevicesTab(devices) {
    console.log("Mostrando pestaña de dispositivos");
    const container = document.querySelector('#devices-tab-pane');
    if (!container) return;
    
    if (!devices || devices.length === 0) {
        container.innerHTML = `
            <div class="p-5 text-center text-muted">
                <i class="fas fa-usb fa-3x mb-3"></i>
                <p>No hay dispositivos USB detectados</p>
            </div>
        `;
        return;
    }
    
    renderDevicesTable(devices);
}

// Renderizar tabla de dispositivos
function renderDevicesTable(devices) {
    console.log("Renderizando tabla de dispositivos");
    const container = document.querySelector('#devices-tab-pane');
    if (!container) return;
    
    let html = `
        <div class="mt-3">
            <div class="d-flex justify-content-between mb-3">
                <h5><i class="fas fa-usb me-2"></i>Dispositivos USB (${devices.length})</h5>
                <div>
                    <button class="btn btn-sm btn-outline-secondary" id="refreshDevicesBtn">
                        <i class="fas fa-sync"></i>
                    </button>
                </div>
            </div>
            
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>Dispositivo</th>
                            <th>Tipo</th>
                            <th>Estado</th>
                            <th>Tiempo de conexión</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    devices.forEach(device => {
        // Identificar dispositivos potencialmente sospechosos
        const isSuspicious = device.type && device.type.toLowerCase().includes('storage') && device.connected;
        
        html += `
            <tr class="${isSuspicious ? 'table-warning' : ''}">
                <td>
                    <div class="d-flex align-items-center">
                        <i class="${getDeviceIcon(device.type)} me-2"></i>
                        <div>
                            <div>${device.name || 'Dispositivo desconocido'}</div>
                            <small class="text-muted">${device.id || 'ID no disponible'}</small>
                        </div>
                    </div>
                </td>
                <td>${device.type || 'Desconocido'}</td>
                <td>
                    <span class="badge ${device.connected ? 'bg-success' : 'bg-secondary'}">
                        ${device.connected ? 'Conectado' : 'Desconectado'}
                    </span>
                </td>
                <td>${device.time ? new Date(device.time).toLocaleString() : 'No disponible'}</td>
            </tr>
        `;
    });
    
    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Configurar evento de actualización
    const refreshBtn = document.getElementById('refreshDevicesBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            loadTabContent('#devices-tab-pane', clientData ? clientData.sessionId : null);
        });
    }
}

// Obtener icono para tipo de dispositivo
function getDeviceIcon(type) {
    if (!type) return 'fas fa-question-circle';
    
    const typeLC = type.toLowerCase();
    
    if (typeLC.includes('mouse') || typeLC.includes('hid')) {
        return 'fas fa-mouse';
    } else if (typeLC.includes('keyboard')) {
        return 'fas fa-keyboard';
    } else if (typeLC.includes('storage')) {
        return 'fas fa-hdd';
    } else if (typeLC.includes('camera')) {
        return 'fas fa-camera';
    } else if (typeLC.includes('audio') || typeLC.includes('headset')) {
        return 'fas fa-headphones';
    } else if (typeLC.includes('network') || typeLC.includes('ethernet')) {
        return 'fas fa-ethernet';
    } else if (typeLC.includes('bluetooth')) {
        return 'fab fa-bluetooth-b';
    } else {
        return 'fas fa-usb';
    }
}

// Mostrar mensaje de no hay capturas
function displayNoScreenshots(sessionId) {
    console.log("Mostrando mensaje de no hay capturas");
    const container = document.querySelector('#screenshots-tab-pane');
    if (!container) return;
    
    container.innerHTML = `
        <div class="p-5 text-center">
            <i class="fas fa-camera fa-3x mb-3 text-muted"></i>
            <p class="text-muted">No hay capturas de pantalla disponibles</p>
            <button class="btn btn-primary mt-3" id="requestScreenshotBtn">
                <i class="fas fa-camera me-2"></i>Solicitar captura
            </button>
        </div>
    `;
    
    // Configurar evento para solicitar captura
    const requestBtn = document.getElementById('requestScreenshotBtn');
    if (requestBtn && sessionId) {
        requestBtn.addEventListener('click', function() {
            requestScreenshot(sessionId);
        });
    }
}

// Mostrar modal de captura de pantalla
function showScreenshotModal(imageData, timestamp) {
    console.log("Mostrando modal de captura de pantalla");
    
    // Crear el modal
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.setAttribute('tabindex', '-1');
    modal.setAttribute('role', 'dialog');
    
    modal.innerHTML = `
        <div class="modal-dialog modal-xl">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">
                        <i class="fas fa-camera me-2"></i>
                        Captura de pantalla (${new Date(timestamp).toLocaleString()})
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body p-0">
                    <img src="data:image/jpeg;base64,${imageData}" class="img-fluid" alt="Captura de pantalla">
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                </div>
            </div>
        </div>
    `;
    
    // Agregar el modal al DOM
    document.body.appendChild(modal);
    
    // Crear e inicializar el objeto Bootstrap Modal
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();
    
    // Eliminar el modal del DOM cuando se cierre
    modal.addEventListener('hidden.bs.modal', function() {
        document.body.removeChild(modal);
    });
}

// Cargar datos del cliente
function fetchClientData(sessionId) {
    console.log("Cargando datos del cliente:", sessionId);
    
    // Mostrar loader
    document.getElementById('loadingContainer').style.display = 'block';
    document.getElementById('clientDetails').style.display = 'none';
    document.getElementById('errorContainer').style.display = 'none';
    
    // Realizar la solicitud AJAX
    fetch(`/api/client/${sessionId}`)
        .then(response => {
            console.log("Respuesta recibida:", response.status);
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("Datos recibidos:", data);
            clientData = data;
            
            // Ocultar loader y mostrar detalles
            document.getElementById('loadingContainer').style.display = 'none';
            document.getElementById('clientDetails').style.display = 'block';
            
            // Actualizar la UI con los datos del cliente
            updateClientUI();
            
            // Inicializar gráficos
            initializeCharts();
            
            // Unirse al canal del cliente para recibir actualizaciones en tiempo real
            if (data.channel && socket && socket.connected) {
                console.log('Uniéndose al canal:', data.channel);
                socket.emit('join-channel', data.channel);
            }
            
            // Cargar contenido de la pestaña activa
            const activeTab = document.querySelector('.tab-pane.active');
            if (activeTab) {
                loadTabContent('#' + activeTab.id, sessionId);
            }
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
    console.log("Actualizando UI con datos del cliente");
    
    if (!clientData) {
        console.error("No hay datos de cliente para actualizar la UI");
        return;
    }
    
    // Debug - mostrar la estructura de los datos
    console.log('clientData:', clientData);
    console.log('clientData.systemInfo:', clientData.systemInfo);
    console.log('clientData.antivirusStatus:', clientData.antivirusStatus);
    
    try {
        // Información básica del cliente
        const clientNameElem = document.getElementById('clientName');
        if (clientNameElem) {
            clientNameElem.textContent = clientData.participantId || 'Cliente sin nombre';
        }
        
        const clientSessionIdElem = document.getElementById('clientSessionId');
        if (clientSessionIdElem) {
            clientSessionIdElem.textContent = clientData.sessionId || 'Sin ID';
        }
        
        const clientChannelElem = document.getElementById('clientChannel');
        if (clientChannelElem) {
            clientChannelElem.textContent = clientData.channel || 'Sin canal';
        }
        
        // Formatear fecha de última actualización
        const lastUpdate = clientData.lastUpdate ? new Date(clientData.lastUpdate) : new Date();
        const clientLastUpdateElem = document.getElementById('clientLastUpdate');
        if (clientLastUpdateElem) {
            clientLastUpdateElem.textContent = lastUpdate.toLocaleString();
        }
        
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
    } catch (error) {
        console.error("Error al actualizar la UI:", error);
    }
}

// Actualizar puntuación de confianza
function updateTrustScore(score) {
    console.log("Actualizando puntuación de confianza:", score);
    
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
    // Primero verificar si existe systemInfo en clientData
    if (!clientData || !clientData.systemInfo) {
        console.log("No hay información de sistema disponible");
        return;
    }
    
    const sysInfo = clientData.systemInfo;
    console.log("Actualizando información del sistema con:", sysInfo);
    
    // Sistema operativo
    const osInfoElem = document.getElementById('osInfo');
    if (osInfoElem && sysInfo) {
        osInfoElem.textContent = `${sysInfo.platform || 'Desconocido'} (${sysInfo.arch || 'x64'})`;
    }
    
    // Información de CPU
    const cpuInfoElem = document.getElementById('cpuInfo');
    if (cpuInfoElem && sysInfo && sysInfo.cpus) {
        if (Array.isArray(sysInfo.cpus) && sysInfo.cpus.length > 0) {
            cpuInfoElem.textContent = sysInfo.cpus[0];
        } else {
            cpuInfoElem.textContent = 'CPU no disponible';
        }
    }
    
    // Información de RAM
    const ramInfoElem = document.getElementById('ramInfo');
    if (ramInfoElem && sysInfo) {
        if (sysInfo.totalMem) {
            const totalGB = (sysInfo.totalMem / (1024 * 1024 * 1024)).toFixed(2);
            const freeGB = sysInfo.freeMem ? (sysInfo.freeMem / (1024 * 1024 * 1024)).toFixed(2) : '?';
            ramInfoElem.textContent = `${freeGB} GB / ${totalGB} GB`;
        } else {
            ramInfoElem.textContent = 'RAM no disponible';
        }
    }
    
    // Hostname
    const hostnameInfoElem = document.getElementById('hostnameInfo');
    if (hostnameInfoElem && sysInfo) {
        hostnameInfoElem.textContent = sysInfo.hostname || 'Desconocido';
    }
    
    // Tiempo de actividad
    const uptimeInfoElem = document.getElementById('uptimeInfo');
    if (uptimeInfoElem && sysInfo && sysInfo.uptime) {
        const uptime = sysInfo.uptime;
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        
        uptimeInfoElem.textContent = `${days}d ${hours}h ${minutes}m`;
    }
}

// Actualizar estado de seguridad
function updateSecurityStatus() {
    console.log("Actualizando estado de seguridad");
    
    if (!clientData) {
        console.log("No hay datos de cliente para actualizar estado de seguridad");
        return;
    }
    
    // Estado del antivirus
    const antivirusStatusElem = document.getElementById('antivirusStatus');
    if (antivirusStatusElem) {
        if (clientData.antivirusStatus && clientData.antivirusStatus.name) {
            const av = clientData.antivirusStatus;
            antivirusStatusElem.textContent = `${av.name} (${av.enabled ? 'Activo' : 'Inactivo'})`;
            
            if (av.enabled) {
                antivirusStatusElem.classList.add('text-success');
                antivirusStatusElem.classList.remove('text-danger');
            } else {
                antivirusStatusElem.classList.add('text-danger');
                antivirusStatusElem.classList.remove('text-success');
            }
        } else {
            antivirusStatusElem.textContent = 'No detectado';
            antivirusStatusElem.classList.add('text-danger');
            antivirusStatusElem.classList.remove('text-success');
        }
    }
    
    // Protección en tiempo real
    const realtimeProtectionElem = document.getElementById('realtimeProtection');
    if (realtimeProtectionElem) {
        if (clientData.antivirusStatus) {
            const av = clientData.antivirusStatus;
            realtimeProtectionElem.textContent = av.realTimeProtection ? 'Activa' : 'Inactiva';
            
            if (av.realTimeProtection) {
                realtimeProtectionElem.classList.add('text-success');
                realtimeProtectionElem.classList.remove('text-danger');
            } else {
                realtimeProtectionElem.classList.add('text-danger');
                realtimeProtectionElem.classList.remove('text-success');
            }
        } else {
            realtimeProtectionElem.textContent = 'No disponible';
            realtimeProtectionElem.classList.add('text-danger');
            realtimeProtectionElem.classList.remove('text-success');
        }
    }
    
    // Entorno virtualizado
    const virtualEnvironmentElem = document.getElementById('virtualEnvironment');
    if (virtualEnvironmentElem) {
        virtualEnvironmentElem.textContent = clientData.virtualEnvironmentDetection ? 'Detectado' : 'No detectado';
        
        if (clientData.virtualEnvironmentDetection) {
            virtualEnvironmentElem.classList.add('text-danger');
            virtualEnvironmentElem.classList.remove('text-success');
        } else {
            virtualEnvironmentElem.classList.add('text-success');
            virtualEnvironmentElem.classList.remove('text-danger');
        }
    }
    
    // Integridad de archivos
    const fileIntegrityElem = document.getElementById('fileIntegrity');
    if (fileIntegrityElem) {
        if (clientData.fileIntegrityStatus && typeof clientData.fileIntegrityStatus === 'object') {
            const integrity = clientData.fileIntegrityStatus;
            const total = integrity.total || 0;
            const modified = integrity.modified || 0;
            
            if (total > 0) {
                fileIntegrityElem.textContent = modified === 0 ? 'Verificado' : `${modified} archivos modificados`;
                
                if (modified === 0) {
                    fileIntegrityElem.classList.add('text-success');
                    fileIntegrityElem.classList.remove('text-danger');
                } else {
                    fileIntegrityElem.classList.add('text-danger');
                    fileIntegrityElem.classList.remove('text-success');
                }
            } else {
                fileIntegrityElem.textContent = 'No verificado';
                fileIntegrityElem.classList.remove('text-success');
                fileIntegrityElem.classList.remove('text-danger');
            }
        } else {
            fileIntegrityElem.textContent = 'No verificado';
            fileIntegrityElem.classList.remove('text-success');
            fileIntegrityElem.classList.remove('text-danger');
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
    if (container.querySelector('.text-muted')) {
        container.innerHTML = '';
    }
    
    container.insertBefore(activityItem, container.firstChild);
    
    // Limitar a un máximo de 10 elementos
    const items = container.querySelectorAll('.activity-item');
    if (items.length > 10) {
        container.removeChild(items[items.length - 1]);
    }
}

// Inicializar gráficos
function initializeCharts() {
    console.log("Inicializando gráficos");
    
    try {
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
        
        const trustScoreChartElem = document.querySelector('#trustScoreChart');
        if (trustScoreChartElem) {
            charts.trustScore = new ApexCharts(trustScoreChartElem, trustScoreOptions);
            charts.trustScore.render();
        }
        
        // Gráfico de uso de CPU
        const cpuOptions = {
            series: [{
                name: 'CPU',
                data: getCpuHistory()
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
        
        const cpuChartElem = document.querySelector('#cpuUsageChart');
        if (cpuChartElem) {
            charts.cpu = new ApexCharts(cpuChartElem, cpuOptions);
            charts.cpu.render();
        }
        
        // Gráfico de uso de memoria
        const memoryOptions = {
            series: [{
                name: 'RAM',
                data: getMemoryHistory()
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
        
        const memoryChartElem = document.querySelector('#memoryUsageChart');
        if (memoryChartElem) {
            charts.memory = new ApexCharts(memoryChartElem, memoryOptions);
            charts.memory.render();
        }
    } catch (error) {
        console.error("Error inicializando gráficos:", error);
    }
}

// Obtener histórico de uso de CPU
function getCpuHistory() {
    // Intentar obtener datos reales del sistema
    if (clientData && clientData.systemData && clientData.systemData.system_data && clientData.systemData.system_data.cpu_history) {
        return clientData.systemData.system_data.cpu_history;
    }
    
    // Si no hay datos, calcular el uso aproximado de memoria
    if (clientData && clientData.systemInfo) {
        // Generar uso de CPU basado en la carga del sistema (ejemplo)
        return Array(20).fill().map(() => Math.floor(Math.random() * 60) + 10);
    }
    
    // Datos por defecto
    return Array(20).fill().map(() => Math.floor(Math.random() * 40) + 10);
}

// Obtener histórico de uso de memoria
function getMemoryHistory() {
    // Intentar obtener datos reales del sistema
    if (clientData && clientData.systemData && clientData.systemData.system_data && clientData.systemData.system_data.memory_history) {
        return clientData.systemData.system_data.memory_history;
    }
    
    // Si no hay datos, calcular el uso aproximado de memoria
    if (clientData && clientData.systemInfo && clientData.systemInfo.totalMem && clientData.systemInfo.freeMem) {
        const usedPercentage = 100 - ((clientData.systemInfo.freeMem / clientData.systemInfo.totalMem) * 100);
        // Variar ligeramente alrededor del valor actual
        return Array(20).fill().map(() => {
            const variation = Math.random() * 10 - 5; // -5 a +5
            return Math.max(0, Math.min(100, usedPercentage + variation));
        });
    }
    
    // Datos por defecto
    return Array(20).fill().map(() => Math.floor(Math.random() * 30) + 40);
}

// Actualizar gráficos
function updateCharts() {
    // Actualizar gráficos con datos reales si están disponibles
    if (charts.cpu) {
        charts.cpu.updateSeries([{
            name: 'CPU',
            data: getCpuHistory()
        }]);
    }
    
    if (charts.memory) {
        charts.memory.updateSeries([{
            name: 'RAM',
            data: getMemoryHistory()
        }]);
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

// Actualizar contador de alertas
function updateAlertCount(count) {
    const badge = document.getElementById('alertsBadge');
    if (!badge) return;
    
    if (count && count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-flex';
    } else {
        badge.style.display = 'none';
    }
}

// Solicitar captura de pantalla
function requestScreenshot(sessionId) {
    console.log("Solicitando captura de pantalla para:", sessionId);
    
    // Verificar que hay un ID de sesión válido
    if (!sessionId) {
        console.error('No se proporcionó un ID de sesión válido');
        return;
    }
    
    // Mostrar indicación de que se está solicitando la captura
    addActivity('info', 'Solicitando captura de pantalla...');
    
    // Enviar solicitud al servidor
    fetch(`/api/request-screenshot/${sessionId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            addActivity('info', 'Captura de pantalla solicitada. Esperando respuesta...');
        } else {
            addActivity('warning', `Error al solicitar captura: ${data.error}`);
        }
    })
    .catch(error => {
        console.error('Error solicitando captura:', error);
        addActivity('warning', `Error al solicitar captura: ${error.message}`);
    });
}

// Mostrar captura de pantalla
function showScreenshot(imageData, timestamp) {
    // Si estamos en la pestaña de capturas, actualizar su contenido
    const screenshotsTab = document.querySelector('#screenshots-tab-pane');
    if (screenshotsTab && screenshotsTab.classList.contains('active')) {
        // Crear contenido de capturas
        screenshotsTab.innerHTML = `
            <div class="mt-3">
                <div class="d-flex justify-content-between mb-3">
                    <h5><i class="fas fa-camera me-2"></i>Capturas de pantalla</h5>
                    <div>
                        <button class="btn btn-sm btn-primary" id="captureNewScreenshotBtn">
                            <i class="fas fa-camera me-2"></i>Nueva captura
                        </button>
                    </div>
                </div>
                
                <div class="row">
                    <div class="col-md-12 mb-4">
                        <div class="card">
                            <div class="card-header d-flex justify-content-between align-items-center">
                                <div><i class="fas fa-camera me-2"></i>Captura (${new Date(timestamp).toLocaleString()})</div>
                                <button class="btn btn-sm btn-outline-secondary screenshot-fullscreen-btn">
                                    <i class="fas fa-expand"></i>
                                </button>
                            </div>
                            <div class="card-body p-0">
                                <img src="data:image/jpeg;base64,${imageData}" class="img-fluid" alt="Captura de pantalla">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Configurar evento para el botón de captura
        const captureBtn = document.getElementById('captureNewScreenshotBtn');
        if (captureBtn) {
            captureBtn.addEventListener('click', function() {
                requestScreenshot(clientData.sessionId);
            });
        }
        
        // Configurar evento para ver en pantalla completa
        const fullscreenBtn = document.querySelector('.screenshot-fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', function() {
                showScreenshotModal(imageData, timestamp);
            });
        }
    }
    
    // Agregar a actividad reciente
    addActivity('info', 'Nueva captura de pantalla recibida');
}

// Enviar advertencia al cliente
function sendWarning(sessionId) {
    console.log("Enviando advertencia al cliente:", sessionId);
    
    // Solicitar mensaje de advertencia
    const message = prompt('Escriba el mensaje de advertencia para el jugador:');
    
    // Verificar que hay un mensaje
    if (!message || message.trim() === '') {
        console.log('No se proporcionó un mensaje de advertencia');
        return;
    }
    
    // Mostrar indicación de que se está enviando la advertencia
    addActivity('warning', `Enviando advertencia: "${message}"`);
    
    // Enviar solicitud al servidor
    fetch(`/api/send-warning/${sessionId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            addActivity('warning', `Advertencia enviada: "${message}"`);
        } else {
            addActivity('warning', `Error al enviar advertencia: ${data.error}`);
        }
    })
    .catch(error => {
        console.error('Error enviando advertencia:', error);
        addActivity('warning', `Error al enviar advertencia: ${error.message}`);
    });
}

// Confirmar descalificación
function confirmDisqualification(sessionId) {
    console.log("Confirmando descalificación para cliente:", sessionId);
    
    // Solicitar motivo de descalificación
    const reason = prompt('Motivo de la descalificación:');
    
    // Verificar que hay un motivo
    if (!reason || reason.trim() === '') {
        console.log('No se proporcionó un motivo de descalificación');
        return;
    }
    
    // Confirmar la acción
    if (confirm(`¿Está seguro que desea descalificar a este jugador por el motivo: "${reason}"? Esta acción no se puede deshacer.`)) {
        // Mostrar indicación de que se está enviando la descalificación
        addActivity('critical', `Descalificando jugador: "${reason}"`);
        
        // Enviar solicitud al servidor
        fetch(`/api/disqualify/${sessionId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
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
            addActivity('warning', `Error al descalificar: ${error.message}`);
        });
    }
}

// Reproducir sonido según severidad
function playSound(severity) {
    let audioPath;
    
    switch (severity) {
        case 'critical':
            audioPath = '/sounds/critical.mp3';
            break;
        case 'warning':
            audioPath = '/sounds/warning.mp3';
            break;
        default:
            audioPath = '/sounds/info.mp3';
    }
    
    try {
        const audio = new Audio(audioPath);
        audio.play().catch(e => console.log('No se pudo reproducir el sonido:', e));
    } catch (error) {
        console.error('Error reproduciendo sonido:', error);
    }
}

// Mostrar mensaje de error
function showError(message) {
    document.getElementById('loadingContainer').style.display = 'none';
    document.getElementById('clientDetails').style.display = 'none';
    document.getElementById('errorContainer').style.display = 'block';
    document.getElementById('errorMessage').textContent = message;
}

// Exponer funciones necesarias globalmente para poder llamarlas desde HTML
window.loadTabContent = loadTabContent;
window.filterAlertRows = filterAlertRows;
window.displayAlertsTab = displayAlertsTab;
window.displayProcessesTab = displayProcessesTab;
window.displayNetworkTab = displayNetworkTab;
window.displayDevicesTab = displayDevicesTab;
window.displayNoScreenshots = displayNoScreenshots;
