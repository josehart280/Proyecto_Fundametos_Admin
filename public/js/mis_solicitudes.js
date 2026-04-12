let solicitudesOriginales = [];
let solicitudAAnular = null;
const tokenSesion = localStorage.getItem('sesion_token');

document.addEventListener('DOMContentLoaded', () => {
    cargarSolicitudes();

    document.getElementById('buscarSolicitud').addEventListener('input', aplicarFiltros);
    document.getElementById('filtroEstado').addEventListener('change', aplicarFiltros);
});

async function cargarSolicitudes() {
    try {
        const res = await fetch('/api/dashboard', {
            headers: {
                'Authorization': `Bearer ${tokenSesion}`
            }
        });
        const data = await res.json();

        const usuario = data.usuario || {};
        const solicitudes = data.vacacionesProgramadas || [];

        solicitudesOriginales = solicitudes;

        const nombre = `${usuario.Nombre || 'Usuario'} ${usuario.Apellido || ''}`.trim();
        document.getElementById('user-name-display').textContent = nombre;

        const nombramientos = usuario.nombramientos || [];
        const rolTexto = nombramientos.length > 0
            ? nombramientos.map(n => `${n.Rol || 'Colaborador'} • ${n.Tipo || ''}`).join(' | ')
            : 'Colaborador';

        document.getElementById('user-role-display').textContent = rolTexto;
        document.getElementById('user-avatar').textContent = (nombre.charAt(0) || 'G').toUpperCase();

        renderResumen(solicitudes);
        renderTabla(solicitudes);

    } catch (error) {
        console.error('Error cargando solicitudes:', error);
        document.getElementById('tabla-solicitudes-body').innerHTML = `
            <tr>
                <td colspan="7" style="padding: 30px; text-align: center; color: #fca5a5;">
                    No se pudieron cargar las solicitudes.
                </td>
            </tr>
        `;
    }
}

function renderResumen(solicitudes) {
    const pendientes = solicitudes.filter(s => normalizarEstado(s.estado) === 'pendiente').length;
    const aprobadas = solicitudes.filter(s => {
        const estado = normalizarEstado(s.estado);
        return estado === 'aprobada' || estado === 'aprobado';
    }).length;

    document.getElementById('total-solicitudes').textContent = solicitudes.length;
    document.getElementById('total-pendientes').textContent = pendientes;
    document.getElementById('total-aprobadas').textContent = aprobadas;
}

function renderTabla(solicitudes) {
    const tbody = document.getElementById('tabla-solicitudes-body');

    if (!solicitudes || solicitudes.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="padding: 30px; text-align: center; color: var(--text-muted);">
                    No hay solicitudes registradas.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = solicitudes.map(s => `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
            <td style="padding: 16px 12px; color: #fff; font-weight: 600;">#${s.id}</td>
            <td style="padding: 16px 12px; color: #e5e7eb;">${formatearFecha(s.inicio)}</td>
            <td style="padding: 16px 12px; color: #e5e7eb;">${formatearFecha(s.fin)}</td>
            <td style="padding: 16px 12px; color: #e5e7eb;">${s.dias}</td>
            <td style="padding: 16px 12px; color: #e5e7eb;">${escapeHtml(s.motivo || 'Vacaciones')}</td>
            <td style="padding: 16px 12px;">${badgeEstado(s.estado)}</td>
            <td style="padding: 16px 12px; text-align: center;">
                <div style="display: flex; justify-content: center; gap: 8px; flex-wrap: wrap;">
                    <button class="btn-outline" style="padding: 8px 12px;" onclick="verDetalle(${s.id})">
                        Ver
                    </button>
                    ${puedeAnularse(s.estado) ? `
                        <button class="btn-danger" style="padding: 8px 12px;" onclick="abrirModal(${s.id})">
                            Anular
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

function aplicarFiltros() {
    const texto = document.getElementById('buscarSolicitud').value.toLowerCase().trim();
    const estado = document.getElementById('filtroEstado').value;

    let filtradas = [...solicitudesOriginales];

    if (texto) {
        filtradas = filtradas.filter(s =>
            (s.motivo || '').toLowerCase().includes(texto)
        );
    }

    if (estado !== 'todos') {
        filtradas = filtradas.filter(s =>
            normalizarEstado(s.estado) === estado.toLowerCase()
        );
    }

    renderTabla(filtradas);
}

function limpiarFiltros() {
    document.getElementById('buscarSolicitud').value = '';
    document.getElementById('filtroEstado').value = 'todos';
    renderTabla(solicitudesOriginales);
}

function normalizarEstado(estado) {
    return (estado || '').toString().trim().toLowerCase();
}

function puedeAnularse(estado) {
    const e = normalizarEstado(estado);
    return e === 'pendiente' || e === 'aprobada' || e === 'aprobado';
}

function badgeEstado(estado) {
    const e = normalizarEstado(estado);

    let bg = 'rgba(148,163,184,0.15)';
    let color = '#cbd5e1';

    if (e === 'pendiente') {
        bg = 'rgba(251,191,36,0.15)';
        color = '#fbbf24';
    } else if (e === 'aprobada' || e === 'aprobado') {
        bg = 'rgba(74,222,128,0.15)';
        color = '#4ade80';
    } else if (e === 'cancelada') {
        bg = 'rgba(239,68,68,0.15)';
        color = '#f87171';
    } else if (e === 'rechazada') {
        bg = 'rgba(244,63,94,0.15)';
        color = '#fb7185';
    }

    return `
        <span style="
            display:inline-flex;
            align-items:center;
            padding:6px 12px;
            border-radius:999px;
            background:${bg};
            color:${color};
            font-size:0.82rem;
            font-weight:700;
        ">
            ${escapeHtml(estado || 'Sin estado')}
        </span>
    `;
}

function formatearFecha(fecha) {
    if (!fecha) return '-';
    const partes = fecha.split('-');
    if (partes.length !== 3) return fecha;
    const [anio, mes, dia] = partes;
    return `${dia}/${mes}/${anio}`;
}

function verDetalle(id) {
    const solicitud = solicitudesOriginales.find(s => Number(s.id) === Number(id));
    if (!solicitud) return;

    document.getElementById('detalle-contenido').innerHTML = `
        <div><strong>ID:</strong> #${solicitud.id}</div>
        <div><strong>Fecha de inicio:</strong> ${formatearFecha(solicitud.inicio)}</div>
        <div><strong>Fecha de fin:</strong> ${formatearFecha(solicitud.fin)}</div>
        <div><strong>Días solicitados:</strong> ${solicitud.dias}</div>
        <div><strong>Motivo:</strong> ${escapeHtml(solicitud.motivo || 'Vacaciones')}</div>
        <div><strong>Estado:</strong> ${escapeHtml(solicitud.estado || 'Sin estado')}</div>
    `;
    document.getElementById('detalle-modal').classList.add('active');
}

function cerrarDetalle() {
    document.getElementById('detalle-modal').classList.remove('active');
}

function abrirModal(id) {
    solicitudAAnular = id;
    document.getElementById('cancel-modal').classList.add('active');
}

function cerrarModal() {
    solicitudAAnular = null;
    document.getElementById('cancel-modal').classList.remove('active');
}

async function confirmarCancelacion() {
    if (!solicitudAAnular) return;

    try {
        const res = await fetch('/api/cancelar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenSesion}`
            },
            body: JSON.stringify({ id: solicitudAAnular })
        });

        const data = await res.json();

        if (data.success) {
            cerrarModal();
            await cargarSolicitudes();
        } else {
            alert('No se pudo anular la solicitud.');
        }
    } catch (error) {
        console.error('Error anulando solicitud:', error);
        alert('Ocurrió un error al anular la solicitud.');
    }
}

function escapeHtml(texto) {
    return String(texto)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}