// =============================================================
//  rrhh_admin.js  –  Módulo Administración RRHH
//  PRF-ADM-01 Gestión Usuarios | PRF-ADM-02 Políticas
//  PRF-ADM-03 Reportes        | PRF-ADM-04 Ajuste Saldo
// =============================================================

let usuariosOriginales = [];
let ajustesOriginales  = [];
let logOriginal        = [];

document.addEventListener('DOMContentLoaded', () => {
  renderUsuarioRRHH();
  cargarModuloAdmin();

  // Filtros en tiempo real
  document.getElementById('buscarUsuario')
    ?.addEventListener('input', aplicarFiltrosUsuarios);
  document.getElementById('filtroEstadoUsuario')
    ?.addEventListener('change', aplicarFiltrosUsuarios);
  document.getElementById('buscarLog')
    ?.addEventListener('input', aplicarFiltrosLog);
  document.getElementById('filtroLogAccion')
    ?.addEventListener('change', aplicarFiltrosLog);

  // Saldo al seleccionar colaborador
  document.getElementById('ajuste-colaborador')
    ?.addEventListener('change', actualizarSaldoActual);
});

// ---------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------
async function cargarModuloAdmin() {
  try {
    await Promise.all([
      cargarEstadisticas(),
      cargarUsuarios(),
      cargarEmpleadosSinCuenta(),
      cargarColaboradoresParaAjuste(),
      cargarUltimosAjustes(),
      cargarPoliticas(),
      cargarLog(),
    ]);
  } catch (err) {
    console.error('Error cargando módulo admin:', err);
  }
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------
function getToken() { return localStorage.getItem('sesion_token'); }

async function fetchConToken(url, opciones = {}) {
  const token = getToken();
  const res = await fetch(url, {
    ...opciones,
    headers: {
      'Authorization': 'Bearer ' + token,
      ...(opciones.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opciones.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.mensaje || data.error || `Error ${url}`);
  return data;
}

function escapeHtml(t) {
  return String(t ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatearFecha(f) {
  if (!f) return '-';
  const p = String(f).split('T')[0].split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : f;
}

function formatearFechaHora(f) {
  if (!f) return '-';
  const d = new Date(f);
  if (isNaN(d)) return f;
  return d.toLocaleDateString('es-CR') + ' ' + d.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' });
}

function badgeRol(rol) {
  const r = (rol || '').toLowerCase();
  if (r.includes('rrhh'))        return `<span class="estado-badge estado-rrhh">${escapeHtml(rol)}</span>`;
  if (r.includes('jefatura'))    return `<span class="estado-badge estado-jefatura">${escapeHtml(rol)}</span>`;
  return `<span class="estado-badge estado-colaborador">${escapeHtml(rol || 'Colaborador')}</span>`;
}

function badgeEstado(estado) {
  const e = (estado || '').toLowerCase();
  if (e === 'activo')   return `<span class="estado-badge estado-activo">Activo</span>`;
  if (e === 'inactivo') return `<span class="estado-badge estado-inactivo">Inactivo</span>`;
  return `<span class="estado-badge">${escapeHtml(estado)}</span>`;
}

function renderUsuarioRRHH() {
  const u = JSON.parse(localStorage.getItem('usuario_info') || '{}');
  const nombre = u.nombre || u.username || 'RRHH';
  const avatar = document.getElementById('user-avatar');
  const nameEl = document.getElementById('user-name-display');
  const roleEl = document.getElementById('user-role-display');
  if (avatar)  avatar.textContent  = nombre.charAt(0).toUpperCase();
  if (nameEl)  nameEl.textContent  = nombre;
  if (roleEl)  roleEl.textContent  = u.rol || 'RRHH';
}

// ---------------------------------------------------------------
// Estadísticas
// ---------------------------------------------------------------
async function cargarEstadisticas() {
  try {
    const data = await fetchConToken('/api/rrhh/estadisticas');
    const s = data.estadisticas || {};
    setText('stat-activos',     s.activos     ?? 0);
    setText('stat-inactivos',   s.inactivos   ?? 0);
    setText('stat-sin-cuenta',  s.sinCuenta   ?? 0);
    setText('stat-ajustes-mes', s.ajustesMes  ?? 0);
    setText('stat-log-total',   s.logTotal    ?? 0);
  } catch { /* silencioso */ }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ---------------------------------------------------------------
// PRF-ADM-01  Gestión de Usuarios
// ---------------------------------------------------------------
async function cargarUsuarios() {
  try {
    const data = await fetchConToken('/api/rrhh/usuarios');
    usuariosOriginales = Array.isArray(data.usuarios) ? data.usuarios : [];
    renderTablaUsuarios(usuariosOriginales);
  } catch {
    setHtml('tabla-usuarios-body', '<tr><td colspan="7">No se pudieron cargar los usuarios.</td></tr>');
  }
}

function renderTablaUsuarios(usuarios) {
  const tbody = document.getElementById('tabla-usuarios-body');
  if (!tbody) return;

  if (!usuarios.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">No hay usuarios que coincidan con los filtros.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = usuarios.map(u => `
    <tr>
      <td>#${escapeHtml(u.id)}</td>
      <td>${escapeHtml(u.nombre)}</td>
      <td><code style="color:#c4b5fd">${escapeHtml(u.username)}</code></td>
      <td>${badgeRol(u.rol)}</td>
      <td>${badgeEstado(u.estado)}</td>
      <td><strong>${escapeHtml(String(u.saldo ?? '-'))}</strong></td>
      <td>
        <div class="acciones">
          <button class="btn btn-editar" onclick="abrirModalEditar(${Number(u.id)})">Modificar</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function aplicarFiltrosUsuarios() {
  const texto  = (document.getElementById('buscarUsuario')?.value || '').toLowerCase();
  const estado = document.getElementById('filtroEstadoUsuario')?.value || 'todos';

  let f = [...usuariosOriginales];
  if (texto)          f = f.filter(u => (u.nombre + u.username + u.rol).toLowerCase().includes(texto));
  if (estado !== 'todos') f = f.filter(u => (u.estado || '').toLowerCase() === estado.toLowerCase());
  renderTablaUsuarios(f);
}

function limpiarFiltrosUsuarios() {
  setVal('buscarUsuario', '');
  setVal('filtroEstadoUsuario', 'todos');
  renderTablaUsuarios(usuariosOriginales);
}

// Crear usuario
async function cargarEmpleadosSinCuenta() {
  try {
    const data = await fetchConToken('/api/rrhh/empleados-sin-cuenta');
    const sel = document.getElementById('crear-empleado');
    if (!sel) return;
    const empleados = Array.isArray(data.empleados) ? data.empleados : [];
    sel.innerHTML = '<option value="">-- Seleccionar empleado --</option>' +
      empleados.map(e => `<option value="${e.id}">${escapeHtml(e.nombre)}</option>`).join('');
  } catch { /* silencioso */ }
}

function abrirModalCrearUsuario() {
  limpiarFormCrear();
  cargarEmpleadosSinCuenta();
  showModal('modal-crear-usuario');
}

function cerrarModalCrearUsuario() {
  hideModal('modal-crear-usuario');
}

function limpiarFormCrear() {
  ['crear-empleado','crear-rol','crear-email','crear-saldo'].forEach(id => setVal(id, ''));
}

async function crearUsuario() {
  const idEmpleado = getVal('crear-empleado');
  const rol        = getVal('crear-rol');
  const email      = getVal('crear-email');
  const saldo      = parseFloat(getVal('crear-saldo'));

  if (!idEmpleado) return alert('Selecciona un empleado.');
  if (!rol)        return alert('Selecciona un rol.');
  if (!email)      return alert('Ingresa un correo electrónico.');
  if (isNaN(saldo) || saldo < 0) return alert('El saldo inicial debe ser un número positivo.');

  try {
    const data = await fetchConToken('/api/rrhh/crear-usuario', {
      method: 'POST',
      body: JSON.stringify({ idEmpleado, rol, email, saldo }),
    });

    cerrarModalCrearUsuario();

    // Mostrar credenciales
    setHtmlEl('cred-username', escapeHtml(data.credenciales?.username || '—'));
    setHtmlEl('cred-password', escapeHtml(data.credenciales?.password || '—'));
    setHtmlEl('cred-rol',      escapeHtml(data.credenciales?.rol || '—'));
    setHtmlEl('cred-saldo',    escapeHtml(String(data.credenciales?.saldo ?? '—')) + ' días');
    showModal('modal-credenciales');

    await Promise.all([cargarUsuarios(), cargarEmpleadosSinCuenta(), cargarEstadisticas(), cargarLog()]);
  } catch (err) {
    alert(err.message || 'Error al crear el usuario.');
  }
}

function cerrarModalCredenciales() {
  hideModal('modal-credenciales');
}

// Editar usuario
function abrirModalEditar(id) {
  const u = usuariosOriginales.find(x => Number(x.id) === Number(id));
  if (!u) return;

  setVal('editar-id-usuario', String(id));

  setHtml('editar-info-grid', `
    <div class="detalle-item"><div class="k">ID</div><div class="v">#${escapeHtml(u.id)}</div></div>
    <div class="detalle-item"><div class="k">Nombre</div><div class="v">${escapeHtml(u.nombre)}</div></div>
    <div class="detalle-item"><div class="k">Usuario</div><div class="v">${escapeHtml(u.username)}</div></div>
    <div class="detalle-item"><div class="k">Saldo actual</div><div class="v">${escapeHtml(String(u.saldo ?? '-'))} días</div></div>
  `);

  setVal('editar-rol',    u.rol    || 'Colaborador');
  setVal('editar-estado', u.estado || 'Activo');

  showModal('modal-editar-usuario');
}

function cerrarModalEditar() {
  hideModal('modal-editar-usuario');
}

async function guardarEdicionUsuario() {
  const id     = getVal('editar-id-usuario');
  const rol    = getVal('editar-rol');
  const estado = getVal('editar-estado');

  if (!id) return;

  try {
    const data = await fetchConToken('/api/rrhh/modificar-usuario', {
      method: 'POST',
      body: JSON.stringify({ id, rol, estado }),
    });
    alert(data.mensaje || 'Usuario modificado correctamente.');
    cerrarModalEditar();
    await Promise.all([cargarUsuarios(), cargarEstadisticas(), cargarLog()]);
  } catch (err) {
    alert(err.message || 'Error al modificar el usuario.');
  }
}

// ---------------------------------------------------------------
// PRF-ADM-04  Ajuste Manual de Saldo
// ---------------------------------------------------------------
async function cargarColaboradoresParaAjuste() {
  try {
    const data = await fetchConToken('/api/rrhh/usuarios-activos');
    const sel = document.getElementById('ajuste-colaborador');
    if (!sel) return;
    const lista = Array.isArray(data.usuarios) ? data.usuarios : [];
    sel.innerHTML = '<option value="">-- Seleccionar colaborador --</option>' +
      lista.map(u => `<option value="${u.id}" data-saldo="${u.saldo}">${escapeHtml(u.nombre)}</option>`).join('');
  } catch { /* silencioso */ }
}

function actualizarSaldoActual() {
  const sel = document.getElementById('ajuste-colaborador');
  const opt = sel?.selectedOptions?.[0];
  const input = document.getElementById('ajuste-saldo-actual');
  if (!input) return;
  input.value = opt?.dataset?.saldo != null ? `${opt.dataset.saldo} días` : '';
}

async function confirmarAjusteSaldo() {
  const idColaborador = getVal('ajuste-colaborador');
  const tipo          = getVal('ajuste-tipo');
  const dias          = parseFloat(getVal('ajuste-dias'));
  const motivo        = getVal('ajuste-motivo').trim();

  if (!idColaborador) return alert('Selecciona un colaborador.');
  if (isNaN(dias) || dias <= 0) return alert('La cantidad de días debe ser un número positivo.');
  if (!motivo) return alert('El motivo del ajuste es obligatorio.');

  if (!confirm(`¿Confirmas el ${tipo.toLowerCase()} de ${dias} día(s) para este colaborador?`)) return;

  try {
    const data = await fetchConToken('/api/rrhh/ajuste-saldo', {
      method: 'POST',
      body: JSON.stringify({ idColaborador, tipo, dias, motivo }),
    });
    alert(data.mensaje || 'Ajuste aplicado correctamente.');
    limpiarFormAjuste();
    await Promise.all([cargarUltimosAjustes(), cargarColaboradoresParaAjuste(), cargarEstadisticas(), cargarLog(), cargarUsuarios()]);
  } catch (err) {
    alert(err.message || 'Error al procesar el ajuste.');
  }
}

function limpiarFormAjuste() {
  setVal('ajuste-colaborador', '');
  setVal('ajuste-tipo', 'Incremento');
  setVal('ajuste-dias', '');
  setVal('ajuste-motivo', '');
  setVal('ajuste-saldo-actual', '');
}

async function cargarUltimosAjustes() {
  try {
    const data = await fetchConToken('/api/rrhh/ajustes');
    ajustesOriginales = Array.isArray(data.ajustes) ? data.ajustes : [];
    renderTablaAjustes(ajustesOriginales);
  } catch {
    setHtml('tabla-ajustes-body', '<tr><td colspan="8">No se pudieron cargar los ajustes.</td></tr>');
  }
}

function renderTablaAjustes(ajustes) {
  const tbody = document.getElementById('tabla-ajustes-body');
  if (!tbody) return;

  if (!ajustes.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">No hay ajustes registrados aún.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = ajustes.map(a => {
    const esSuma = (a.tipo || '').toLowerCase().includes('increment') || (a.tipo || '').toLowerCase() === 'suma';
    const color  = esSuma ? '#4ade80' : '#fb7185';
    const signo  = esSuma ? '+' : '−';
    return `
      <tr>
        <td>${formatearFechaHora(a.fecha)}</td>
        <td>${escapeHtml(a.responsable || '-')}</td>
        <td>${escapeHtml(a.colaborador || '-')}</td>
        <td><span class="log-accion">${escapeHtml(a.tipo || '-')}</span></td>
        <td style="color:${color};font-weight:700">${signo}${escapeHtml(String(a.dias ?? '-'))}</td>
        <td>${escapeHtml(String(a.saldo_anterior ?? '-'))}</td>
        <td><strong>${escapeHtml(String(a.saldo_nuevo ?? '-'))}</strong></td>
        <td style="max-width:240px;white-space:normal;font-size:0.87rem;color:rgba(255,255,255,0.8)">${escapeHtml(a.motivo || '-')}</td>
      </tr>
    `;
  }).join('');
}

// ---------------------------------------------------------------
// PRF-ADM-02  Políticas de Vacaciones
// ---------------------------------------------------------------
async function cargarPoliticas() {
  try {
    const data = await fetchConToken('/api/rrhh/politicas');
    const p = data.politicas || {};
    setVal('pol-max-dias',               p.max_dias_consecutivos   ?? '');
    setVal('pol-min-antiguedad',         p.min_dias_antiguedad      ?? '');
    setVal('pol-min-entre-solicitudes',  p.min_dias_entre_solicitudes ?? '');
    setVal('pol-aviso-previo',           p.aviso_previo_dias        ?? '');
  } catch { /* silencioso */ }
}

async function guardarPoliticas() {
  const maxDias         = parseInt(getVal('pol-max-dias'));
  const minAntig        = parseInt(getVal('pol-min-antiguedad'));
  const minEntreSol     = parseInt(getVal('pol-min-entre-solicitudes'));
  const avisoPrevio     = parseInt(getVal('pol-aviso-previo'));

  if ([maxDias, minAntig, minEntreSol, avisoPrevio].some(v => isNaN(v) || v < 0)) {
    return alert('Todos los valores deben ser números positivos.');
  }

  if (!confirm('¿Confirmas el cambio de políticas? Los nuevos valores aplicarán de inmediato.')) return;

  try {
    const data = await fetchConToken('/api/rrhh/politicas', {
      method: 'POST',
      body: JSON.stringify({
        max_dias_consecutivos: maxDias,
        min_dias_antiguedad: minAntig,
        min_dias_entre_solicitudes: minEntreSol,
        aviso_previo_dias: avisoPrevio,
      }),
    });
    alert(data.mensaje || 'Políticas actualizadas correctamente.');
    await Promise.all([cargarPoliticas(), cargarLog()]);
  } catch (err) {
    alert(err.message || 'Error al guardar las políticas.');
  }
}

// ---------------------------------------------------------------
// PRF-ADM-03  Reportes
// ---------------------------------------------------------------
async function generarReporte() {
  const inicio = getVal('reporte-fecha-inicio');
  const fin    = getVal('reporte-fecha-fin');
  const tipo   = getVal('reporte-tipo');

  if (!inicio || !fin) return alert('Selecciona un rango de fechas para el reporte.');
  if (inicio > fin)    return alert('La fecha de inicio no puede ser posterior a la fecha fin.');

  setHtml('tabla-reporte-body', '<tr><td colspan="6" style="text-align:center;padding:20px;">Generando reporte...</td></tr>');

  try {
    const data = await fetchConToken(`/api/rrhh/reporte?tipo=${tipo}&inicio=${inicio}&fin=${fin}`);
    const filas = Array.isArray(data.filas) ? data.filas : [];

    if (!filas.length) {
      setHtml('tabla-reporte-body',
        '<tr><td colspan="6"><div class="empty-state">No hay datos para los criterios seleccionados.</div></td></tr>');
      return;
    }

    setHtml('tabla-reporte-body', filas.map(f => `
      <tr>
        <td>${escapeHtml(f.colaborador || '-')}</td>
        <td>${escapeHtml(f.departamento || '-')}</td>
        <td>${formatearFecha(f.inicio)}</td>
        <td>${formatearFecha(f.fin)}</td>
        <td>${escapeHtml(String(f.dias ?? '-'))}</td>
        <td>${badgeEstadoSolicitud(f.estado)}</td>
      </tr>
    `).join(''));
  } catch (err) {
    setHtml('tabla-reporte-body',
      `<tr><td colspan="6"><div class="empty-state">Error generando reporte: ${escapeHtml(err.message)}</div></td></tr>`);
  }
}

function badgeEstadoSolicitud(estado) {
  const e = (estado || '').toLowerCase();
  if (e === 'aprobada') return `<span class="estado-badge estado-activo">Aprobada</span>`;
  if (e === 'rechazada') return `<span class="estado-badge estado-inactivo">Rechazada</span>`;
  return `<span class="estado-badge estado-jefatura">${escapeHtml(estado || 'Pendiente')}</span>`;
}

// ---------------------------------------------------------------
// PRF-ADM-03  Log de Auditoría
// ---------------------------------------------------------------
async function cargarLog() {
  try {
    const data = await fetchConToken('/api/rrhh/log');
    logOriginal = Array.isArray(data.eventos) ? data.eventos : [];
    renderTablaLog(logOriginal);
  } catch {
    setHtml('tabla-log-body', '<tr><td colspan="4">No se pudo cargar el log.</td></tr>');
  }
}

function renderTablaLog(eventos) {
  const tbody = document.getElementById('tabla-log-body');
  if (!tbody) return;

  if (!eventos.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state">No hay eventos registrados.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = eventos.map(e => `
    <tr>
      <td style="white-space:nowrap">${formatearFechaHora(e.fecha)}</td>
      <td>${escapeHtml(e.responsable || '-')}</td>
      <td><span class="log-accion">${escapeHtml(e.accion || '-')}</span></td>
      <td style="max-width:320px;white-space:normal;font-size:0.87rem;color:rgba(255,255,255,0.8)">${escapeHtml(e.detalle || '-')}</td>
    </tr>
  `).join('');
}

function aplicarFiltrosLog() {
  const texto  = (document.getElementById('buscarLog')?.value || '').toLowerCase();
  const accion = document.getElementById('filtroLogAccion')?.value || 'todos';

  let f = [...logOriginal];
  if (texto)           f = f.filter(e => (e.responsable + e.accion + e.detalle).toLowerCase().includes(texto));
  if (accion !== 'todos') f = f.filter(e => (e.accion || '').toLowerCase().includes(accion));
  renderTablaLog(f);
}

function limpiarFiltrosLog() {
  setVal('buscarLog', '');
  setVal('filtroLogAccion', 'todos');
  renderTablaLog(logOriginal);
}

// ---------------------------------------------------------------
// Utilidades DOM
// ---------------------------------------------------------------
function getVal(id)    { return document.getElementById(id)?.value ?? ''; }
function setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v; }
function setHtml(id, h){ const el = document.getElementById(id); if (el) el.innerHTML = h; }
function setHtmlEl(id, h) { const el = document.getElementById(id); if (el) el.innerHTML = h; }
function showModal(id) { document.getElementById(id)?.classList.add('show'); }
function hideModal(id) { document.getElementById(id)?.classList.remove('show'); }