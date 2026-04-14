const tokenSesion = localStorage.getItem('sesion_token');
let paginaActual = 1;
const limitePorPagina = 25;

document.addEventListener('DOMContentLoaded', () => {
    if (!tokenSesion) {
        window.location.href = 'login.html';
        return;
    }
    cargarDatosUsuario();
    construirNav();
    cargarMetricas();
    cargarEventos(1);
});

async function cargarDatosUsuario() {
    try {
        const res = await fetch('/api/dashboard', {
            headers: { 'Authorization': `Bearer ${tokenSesion}` }
        });
        if (res.status === 401) {
            window.location.href = 'login.html';
            return;
        }
        const data = await res.json();
        const usuario = data.usuario || {};
        const nombre = `${usuario.Nombre || 'Usuario'} ${usuario.Apellido || ''}`.trim();
        document.getElementById('user-name-display').textContent = nombre;
        document.getElementById('user-avatar').textContent = (nombre.charAt(0) || 'G').toUpperCase();

        const nombramientos = usuario.nombramientos || [];
        const rolTexto = nombramientos.length > 0
            ? nombramientos.map(n => `${n.Rol || 'Colaborador'} • ${n.Tipo || ''}`).join(' | ')
            : 'Colaborador';
        document.getElementById('user-role-display').textContent = rolTexto;
    } catch (error) {
        console.error('Error cargando usuario:', error);
    }
}

function construirNav() {
    const nav = document.getElementById('nav-links');
    const links = [
        { href: 'dashboard.html', text: 'Dashboard' },
        { href: 'solicitud.html', text: 'Nueva Solicitud' },
        { href: 'mis_solicitudes.html', text: 'Mis Solicitudes' },
        { href: 'auditoria.html', text: 'Auditoría', active: true }
    ];
    nav.innerHTML = links.map(l =>
        `<a href="${l.href}" class="nav-item${l.active ? ' active' : ''}">${l.text}</a>`
    ).join('');
}

async function cargarMetricas() {
    try {
        const res = await fetch('/api/auditoria/metricas', {
            headers: { 'Authorization': `Bearer ${tokenSesion}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.exito) return;
        const m = data.metricas;

        document.getElementById('metrica-hoy').textContent = m.hoy || 0;
        document.getElementById('metrica-semana').textContent = m.estaSemana || 0;
        document.getElementById('metrica-mes').textContent = m.esteMes || 0;

        renderDistribucionTipo(m.porTipo || []);
        renderTopUsuarios(m.topUsuarios || []);
    } catch (error) {
        console.error('Error cargando métricas:', error);
    }
}

function renderDistribucionTipo(porTipo) {
    const container = document.getElementById('distribucion-tipo');
    if (!porTipo.length) {
        container.innerHTML = '<p style="color: var(--text-muted);">Sin datos</p>';
        return;
    }
    const total = porTipo.reduce((s, t) => s + t.total, 0) || 1;
    const colores = {
        INSERT: '#4ade80', UPDATE: '#fbbf24', DELETE: '#f87171',
        LOGIN: '#60a5fa', LOGOUT: '#a78bfa', APPROVE: '#2dd4bf', REJECT: '#fb7185'
    };
    container.innerHTML = porTipo.map(t => {
        const pct = ((t.total / total) * 100).toFixed(1);
        const color = colores[t.tipo_accion] || '#94a3b8';
        return `
            <div style="flex: 1; min-width: 120px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 10px; text-align: center;">
                <div style="font-size: 1.5rem; font-weight: 800; color: ${color};">${t.total}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">${t.tipo_accion}</div>
                <div style="font-size: 0.65rem; color: ${color}; margin-top: 2px;">${pct}%</div>
            </div>`;
    }).join('');
}

function renderTopUsuarios(topUsuarios) {
    const container = document.getElementById('top-usuarios');
    if (!topUsuarios.length) {
        container.innerHTML = '<p style="color: var(--text-muted);">Sin datos</p>';
        return;
    }
    container.innerHTML = topUsuarios.map((u, i) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: rgba(255,255,255,0.03); border-radius: 8px;">
            <span style="color: var(--secondary-accent); font-weight: 700; min-width: 24px;">#${i + 1}</span>
            <span style="color: #fff; flex: 1; margin-left: 12px;">${escapeHtml(u.nombre || 'Desconocido')}</span>
            <span style="color: var(--text-muted); font-size: 0.85rem;">${u.total} acciones</span>
        </div>
    `).join('');
}

async function cargarEventos(pagina) {
    paginaActual = pagina;
    const params = new URLSearchParams();
    params.set('page', pagina);
    params.set('limit', limitePorPagina);

    const fechaDesde = document.getElementById('filtro-fecha-desde').value;
    const fechaHasta = document.getElementById('filtro-fecha-hasta').value;
    const tipoAccion = document.getElementById('filtro-tipo-accion').value;
    const entidad = document.getElementById('filtro-entidad').value;

    if (fechaDesde) params.set('fechaDesde', fechaDesde + ' 00:00:00');
    if (fechaHasta) params.set('fechaHasta', fechaHasta + ' 23:59:59');
    if (tipoAccion) params.set('tipo_accion', tipoAccion);
    if (entidad) params.set('entidad_afectada', entidad);

    try {
        const res = await fetch(`/api/auditoria/acciones?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${tokenSesion}` }
        });
        if (res.status === 403) {
            document.getElementById('tabla-eventos-body').innerHTML =
                '<tr><td colspan="6" style="padding:30px;text-align:center;color:#f87171;">No tiene permisos para ver auditoría.</td></tr>';
            return;
        }
        if (!res.ok) return;
        const data = await res.json();
        if (!data.exito) return;

        renderTabla(data.eventos || []);
        renderPaginacion(data.page, data.totalPages, data.total);
    } catch (error) {
        console.error('Error cargando eventos:', error);
        document.getElementById('tabla-eventos-body').innerHTML =
            '<tr><td colspan="6" style="padding:30px;text-align:center;color:#fca5a5;">Error al cargar eventos.</td></tr>';
    }
}

function renderTabla(eventos) {
    const tbody = document.getElementById('tabla-eventos-body');
    if (!eventos.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding:30px;text-align:center;color:var(--text-muted);">No se encontraron eventos.</td></tr>';
        return;
    }
    tbody.innerHTML = eventos.map(e => `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
            <td style="padding:12px;color:#e5e7eb;font-size:0.85rem;">${escapeHtml(e.timestamp || '-')}</td>
            <td style="padding:12px;color:#fff;font-weight:600;">${escapeHtml(e.nombre_usuario || `#${e.usuario_id}`)}</td>
            <td style="padding:12px;">${badgeAccion(e.tipo_accion)}</td>
            <td style="padding:12px;color:#e5e7eb;font-size:0.85rem;">${escapeHtml(e.entidad_afectada || '-')}</td>
            <td style="padding:12px;color:var(--text-muted);font-size:0.8rem;font-family:monospace;">${escapeHtml(e.registro_id || '-')}</td>
            <td style="padding:12px;color:var(--text-muted);font-size:0.8rem;">${escapeHtml(e.ip_origen || '-')}</td>
        </tr>
    `).join('');
}

function badgeAccion(tipo) {
    const colores = {
        INSERT: { bg: 'rgba(74,222,128,0.15)', color: '#4ade80' },
        UPDATE: { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24' },
        DELETE: { bg: 'rgba(248,113,113,0.15)', color: '#f87171' },
        LOGIN: { bg: 'rgba(96,165,250,0.15)', color: '#60a5fa' },
        LOGOUT: { bg: 'rgba(167,139,250,0.15)', color: '#a78bfa' },
        APPROVE: { bg: 'rgba(45,212,191,0.15)', color: '#2dd4bf' },
        REJECT: { bg: 'rgba(251,113,133,0.15)', color: '#fb7185' }
    };
    const c = colores[tipo] || { bg: 'rgba(148,163,184,0.15)', color: '#cbd5e1' };
    return `<span style="display:inline-flex;align-items:center;padding:5px 12px;border-radius:999px;background:${c.bg};color:${c.color};font-size:0.8rem;font-weight:700;">${escapeHtml(tipo || '?')}</span>`;
}

function renderPaginacion(pagina, totalPages, total) {
    const info = document.getElementById('pagina-info');
    const btnAnt = document.getElementById('btn-anterior');
    const btnSig = document.getElementById('btn-siguiente');

    info.textContent = `Página ${pagina} de ${totalPages || 1} (${total} registros)`;
    btnAnt.disabled = pagina <= 1;
    btnSig.disabled = pagina >= totalPages;

    btnAnt.style.opacity = pagina <= 1 ? '0.4' : '1';
    btnSig.style.opacity = pagina >= totalPages ? '0.4' : '1';
}

function cambiarPagina(delta) {
    cargarEventos(paginaActual + delta);
}

function aplicarFiltros() {
    cargarEventos(1);
}

function limpiarFiltros() {
    document.getElementById('filtro-fecha-desde').value = '';
    document.getElementById('filtro-fecha-hasta').value = '';
    document.getElementById('filtro-tipo-accion').value = '';
    document.getElementById('filtro-entidad').value = '';
    cargarEventos(1);
}

function escapeHtml(texto) {
    return String(texto)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}