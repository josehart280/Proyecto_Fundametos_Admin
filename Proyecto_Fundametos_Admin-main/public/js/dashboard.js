/**
 * Dashboard Logic - Geral
 * PRF-COL-01 y funcionalidad de Cancelación
 */

document.addEventListener('DOMContentLoaded', () => {
    const tokenSesion = localStorage.getItem('sesion_token');

    const calendarElement = document.getElementById('calendar-render');
    const monthYearDisplay = document.getElementById('calendar-month-year');
    const requestsRender = document.getElementById('requests-render');
    const diasProcesoValor = document.getElementById('dias-proceso-valor');
    const diasProcesoSub = document.getElementById('dias-proceso-sub');
    const diasConsumidosValor = document.getElementById('dias-consumidos-valor');
    
    let currentDate = new Date();
    
    // MOCK: Eliminado. Variables globales a la espera del Fetch Real
    let feriados = [];
    let vacacionesProgramadas = [];
    let saldoOficial = 0;

    // --- CONEXIÓN AL BACKEND SQL (Producción) ---
    async function inicializarDashboardDesdeBD() {
        try {
            const response = await fetch('/api/dashboard', {
                headers: {
                    'Authorization': `Bearer ${tokenSesion}`
                }
            });
            const data = await response.json();
            
            // Llenar variables locales de UI con datos de SQL Server
            feriados = data.feriados || [];
            vacacionesProgramadas = data.vacacionesProgramadas || [];
            saldoOficial = data.usuario ? data.usuario.saldo_vacaciones : 15;
            
            // ACTUALIZACIÓN DE PERFIL MULTI-NOMBRAMIENTO
            if (data.usuario && data.usuario.nombramientos) {
                const arrRoles = data.usuario.nombramientos.map(n => `${n.Rol} (${n.Tipo})`);
                const roleNode = document.getElementById('user-role-display');
                if(roleNode) roleNode.textContent = arrRoles.join(' | ');
                
                const fullName = `${data.usuario.Nombre} ${data.usuario.Apellido}`;
                const nameNode = document.getElementById('user-name-display');
                if(nameNode) nameNode.textContent = `${data.usuario.Nombre} ${data.usuario.Apellido.charAt(0)}.`;

                const welcomeNode = document.getElementById('welcome-name');
                if(welcomeNode) welcomeNode.textContent = data.usuario.Nombre;

                const avatarNode = document.getElementById('user-avatar');
                if(avatarNode) avatarNode.textContent = (data.usuario.Nombre.charAt(0) || 'U').toUpperCase();
            }

            // Actualizar Tarjeta "Saldo Disponible" del UI
            const saldoCard = document.getElementById('saldo-disponible-value');
            if(saldoCard) saldoCard.textContent = saldoOficial.toFixed(1);

            // Renderizar la UI final
            actualizarMetricas();
            renderSolicitudes();
            renderCalendar(currentDate);
        } catch (error) {
            console.error("Error conectando a BD:", error);
            showToast("Advertencia: No se pudo conectar a la Base de Datos.", true);
        }
    }

    // Formateador de Fechas amigable (Ej: "18 Dic 2026")
    function formatDate(dateStr) {
        const d = parseDate(dateStr);
        const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    }

    function parseDate(dateStr) {
        const parts = dateStr.split('-');
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }

    // --- LÓGICA DE CANCELACIÓN (Cumplimiento Estricto PRF-COL-04) ---
    let solicitudIdACancelar = null;

    window.cancelarSolicitud = (id) => {
        const index = vacacionesProgramadas.findIndex(v => v.id === id);
        if (index === -1) return;
        const vac = vacacionesProgramadas[index];

        // V3 y MSJ2: Validar que el estado permita cancelación
        if (vac.estado !== 'Pendiente' && vac.estado !== 'Aprobada') {
            showToast("No es posible cancelar esta solicitud debido a su estado actual.", true);
            return;
        }

        // V4 y MSJ3: Validar que la fecha actual sea anterior a la fecha de inicio
        const hoy = new Date();
        const inicioDate = parseDate(vac.inicio);
        // Descontamos horas para ser justos en la comparación del día
        hoy.setHours(0,0,0,0);
        if (hoy >= inicioDate) {
            showToast("No puede cancelar una solicitud cuya fecha de inicio ya ha comenzado.", true);
            return;
        }

        solicitudIdACancelar = id;
        document.getElementById('cancel-modal').classList.add('active');
    };

    window.cerrarModal = () => {
        solicitudIdACancelar = null;
        document.getElementById('cancel-modal').classList.remove('active');
    };

    window.confirmarCancelacion = async () => {
        if (solicitudIdACancelar !== null) {
            const index = vacacionesProgramadas.findIndex(v => v.id === solicitudIdACancelar);
            if (index !== -1) {
                // LLAMADA AL BACKEND REAL (SQL)
                try {
                    await fetch('/api/cancelar', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${tokenSesion}`
                        },
                        body: JSON.stringify({ id: solicitudIdACancelar })
                    });
                    
                    vacacionesProgramadas[index].estado = 'Cancelada';
                    cerrarModal();
                    showToast("La solicitud ha sido cancelada exitosamente.", false);
                    actualizarMetricas();
                    renderSolicitudes();
                    renderCalendar(currentDate);
                } catch (err) {
                    showToast("Error de conexión al servidor SQL al anular.", true);
                    cerrarModal();
                }
            }
        }
    };

    // --- CUMPLIMIENTO SECUENCIA: MENSAJE FINAL (TOAST) ---
    function showToast(message, isError = false) {
        const toast = document.createElement('div');
        toast.textContent = (isError ? "⚠ " : "✅ ") + message;
        
        const bgColor = isError ? "linear-gradient(135deg, #ef4444, #b91c1c)" : "linear-gradient(135deg, #10b981, #059669)";
        const shadowColor = isError ? "rgba(239, 68, 68, 0.4)" : "rgba(16, 185, 129, 0.4)";
        
        toast.style.cssText = `
            position: fixed; bottom: 40px; right: 40px;
            background: ${bgColor}; color: #fff; 
            font-weight: 600; font-size: 0.95rem; font-family: 'Outfit', sans-serif;
            padding: 16px 24px; border-radius: 12px;
            box-shadow: 0 10px 40px ${shadowColor};
            transform: translateY(100px); opacity: 0; 
            transition: all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
            z-index: 9999; border: 1px solid rgba(255,255,255,0.2);
        `;
        document.body.appendChild(toast);
        
        // Entrada animada
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toast.style.transform = 'translateY(0)';
                toast.style.opacity = '1';
            });
        });

        // Salida y destrucción
        setTimeout(() => {
            toast.style.transform = 'translateY(100px)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        }, 3500);
    }

    function actualizarMetricas() {
        if (!diasProcesoValor) return;
        let diasEnProceso = 0;
        let diasConsumidos = 0;
        let solicitudesPendientes = 0;

        vacacionesProgramadas.forEach(v => {
            if (v.estado === 'Pendiente') {
                diasEnProceso += v.dias;
                solicitudesPendientes++;
            } else if (v.estado === 'Aprobada') {
                diasConsumidos += v.dias;
            }
        });

        diasProcesoValor.textContent = diasEnProceso.toFixed(1);
        if (diasConsumidosValor) diasConsumidosValor.textContent = diasConsumidos.toFixed(1);
        diasProcesoSub.textContent = `${solicitudesPendientes} Solicitud${solicitudesPendientes !== 1 ? 'es' : ''} Pendiente${solicitudesPendientes !== 1 ? 's' : ''}`;
        
        // Efecto visual de que el número bajó a 0 (Si canceló todo lo pendiente)
        if (diasEnProceso === 0) {
            diasProcesoValor.style.background = "linear-gradient(135deg, var(--text-muted), #475569)";
            diasProcesoValor.style.webkitBackgroundClip = "text";
            diasProcesoValor.style.color = "transparent";
        }
    }

    // --- RENDERIZADO DE LA LISTA MIS SOLICITUDES ---
    function renderSolicitudes() {
        if (!requestsRender) return;
        requestsRender.innerHTML = '';

        if (vacacionesProgramadas.length === 0) {
            requestsRender.innerHTML = `<div style="color: var(--text-muted); text-align: center; padding: 20px;">No hay solicitudes recientes.</div>`;
            return;
        }

        vacacionesProgramadas.slice().reverse().forEach(solicitud => {
            let badgeHTML = '';
            let opacity = '1';
            let cancelBtnHTML = '';

            if (solicitud.estado === 'Pendiente' || solicitud.estado === 'Aprobada') {
                if (solicitud.estado === 'Pendiente') {
                    badgeHTML = `<div class="status-badge" style="background: rgba(251, 191, 36, 0.1); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.2);">Pendiente</div>`;
                } else {
                    opacity = '0.9'; // Para que el boton se vea bien
                    badgeHTML = `<div class="status-badge" style="background: rgba(52, 211, 153, 0.1); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.2);">Aprobada</div>`;
                }
                // Botón de Cancelar permitido para Pendiente o Aprobada
                cancelBtnHTML = `<button onclick="cancelarSolicitud(${solicitud.id})" style="margin-top: 10px; background: rgba(248, 113, 113, 0.1); color: #f87171; border: 1px solid rgba(248, 113, 113, 0.3); border-radius: 6px; padding: 6px 12px; font-size: 0.8rem; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(248, 113, 113, 0.2)'" onmouseout="this.style.background='rgba(248, 113, 113, 0.1)'">⚠ Cancelar Solicitud</button>`;
            } else if (solicitud.estado === 'Cancelada') {
                opacity = '0.4';
                badgeHTML = `<div class="status-badge" style="background: rgba(255, 255, 255, 0.05); color: var(--text-muted); border: 1px solid rgba(255, 255, 255, 0.1);">Anulada</div>`;
            }

            const itemHTML = `
                <div class="request-item" style="opacity: ${opacity}; flex-direction: column; align-items: flex-start; gap: 8px;">
                    <div style="width: 100%; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 600; font-size: 1.05rem; margin-bottom: 4px; color: #fff;">${formatDate(solicitud.inicio)} - ${formatDate(solicitud.fin)}</div>
                            <div style="font-size: 0.85rem; color: var(--text-muted);">${solicitud.dias} días solicitados • Motivo: ${solicitud.motivo}</div>
                        </div>
                        ${badgeHTML}
                    </div>
                    ${cancelBtnHTML}
                </div>
            `;
            
            requestsRender.insertAdjacentHTML('beforeend', itemHTML);
        });
    }

    // --- LÓGICA DEL CALENDARIO (Con integración de canceladas) ---
    function checkDiaVacaciones(dateStr) {
        const targetDate = parseDate(dateStr);
        let estado = null;

        vacacionesProgramadas.forEach(vac => {
            if (vac.estado === 'Cancelada') return; // No pintar las anuladas
            const inicio = parseDate(vac.inicio);
            const fin = parseDate(vac.fin);
            if (targetDate >= inicio && targetDate <= fin) {
                estado = vac.estado;
            }
        });
        return estado;
    }

    function renderCalendar(date) {
        if (!calendarElement) return;
        
        calendarElement.innerHTML = '';
        const year = date.getFullYear();
        const month = date.getMonth();
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        monthYearDisplay.textContent = `${monthNames[month]} ${year}`;
        
        const days = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];
        days.forEach(day => {
            const div = document.createElement('div');
            div.className = 'calendar-day-head';
            div.textContent = day;
            calendarElement.appendChild(div);
        });
        
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        for (let i = 0; i < firstDay; i++) {
            const div = document.createElement('div');
            div.className = 'calendar-day empty';
            calendarElement.appendChild(div);
        }
        
        const hoy = new Date();
        const todayStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
        
        for (let i = 1; i <= daysInMonth; i++) {
            const div = document.createElement('div');
            div.className = 'calendar-day';
            
            const mStr = String(month + 1).padStart(2, '0');
            const dStr = String(i).padStart(2, '0');
            const dateStr = `${year}-${mStr}-${dStr}`;
            
            div.textContent = i;
            
            if (dateStr === todayStr) div.classList.add('today');
            if (feriados.includes(dateStr)) div.classList.add('holiday');
            
            const dayOfWeek = new Date(year, month, i).getDay();
            const esFinSemana = (dayOfWeek === 0 || dayOfWeek === 6);
            const esFeriado = feriados.includes(dateStr);
            
            if (!esFinSemana && !esFeriado) {
                const estadoVacacion = checkDiaVacaciones(dateStr);
                if (estadoVacacion === 'Aprobada') {
                    div.style.background = 'rgba(52, 211, 153, 0.2)';
                    div.style.color = '#34d399';
                    div.style.fontWeight = 'bold';
                    div.title = "Vacación Aprobada";
                } else if (estadoVacacion === 'Pendiente') {
                    div.style.background = 'rgba(251, 191, 36, 0.15)';
                    div.style.color = '#fbbf24';
                    div.title = "Vacación en Proceso";
                }
            }
            calendarElement.appendChild(div);
        }
    }

    window.changeMonth = (offset) => {
        currentDate.setMonth(currentDate.getMonth() + offset);
        renderCalendar(currentDate);
    };

    // Inicializar la vista completa leyendo API
    inicializarDashboardDesdeBD();
});
