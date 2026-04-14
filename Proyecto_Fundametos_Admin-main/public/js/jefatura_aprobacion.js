let pendientesOriginales = [];
let historialOriginal = [];
let calendarioOriginal = [];
let conflictosOriginales = [];
let solicitudSeleccionada = null;
let accionSeleccionada = null;

document.addEventListener('DOMContentLoaded', () => {
  cargarModuloJefatura();

  const buscarPendiente = document.getElementById('buscarPendiente');
  const filtroPendienteEstado = document.getElementById('filtroPendienteEstado');
  const buscarHistorial = document.getElementById('buscarHistorial');
  const filtroHistorialEstado = document.getElementById('filtroHistorialEstado');

  if (buscarPendiente) {
    buscarPendiente.addEventListener('input', aplicarFiltrosPendientes);
  }

  if (filtroPendienteEstado) {
    filtroPendienteEstado.addEventListener('change', aplicarFiltrosPendientes);
  }

  if (buscarHistorial) {
    buscarHistorial.addEventListener('input', aplicarFiltrosHistorial);
  }

  if (filtroHistorialEstado) {
    filtroHistorialEstado.addEventListener('change', aplicarFiltrosHistorial);
  }
});

async function cargarModuloJefatura() {
  try {
    await Promise.all([
      cargarDashboardJefatura(),
      cargarPendientes(),
      cargarHistorial(),
      cargarCalendario(),
      cargarConflictos()
    ]);

    renderResumen();
    renderUsuarioJefatura();
  } catch (error) {
    console.error('Error cargando módulo de jefatura:', error);

    setContenido('tabla-pendientes-body', `
      <tr>
        <td colspan="8">No se pudieron cargar las solicitudes pendientes.</td>
      </tr>
    `);

    setContenido('tabla-historial-body', `
      <tr>
        <td colspan="8">No se pudo cargar el historial.</td>
      </tr>
    `);

    setContenido('tabla-calendario-body', `
      <tr>
        <td colspan="6">No se pudo cargar el calendario del equipo.</td>
      </tr>
    `);

    setContenido('tabla-conflictos-body', `
      <tr>
        <td colspan="7">No se pudieron cargar las alertas de conflictos.</td>
      </tr>
    `);
  }
}

function getToken() {
  return localStorage.getItem('sesion_token');
}

async function fetchConToken(url) {
  const token = getToken();

  const res = await fetch(url, {
    headers: {
      'Authorization': 'Bearer ' + token
    }
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.mensaje || data.error || `Error llamando ${url}`);
  }

  return data;
}

async function cargarDashboardJefatura() {
  const data = await fetchConToken('/api/jefatura/dashboard');

  if (!data.metricas) return;

  document.getElementById('total-pendientes').textContent = data.metricas.pendientes ?? 0;
  document.getElementById('total-aprobadas').textContent = data.metricas.aprobadas ?? 0;
  document.getElementById('total-rechazadas').textContent = data.metricas.rechazadas ?? 0;
  document.getElementById('total-procesadas').textContent = data.metricas.procesadas ?? 0;

  const totalEquipo = document.getElementById('total-equipo');
  const solicitudesMes = document.getElementById('solicitudes-mes');

  if (totalEquipo) totalEquipo.textContent = data.metricas.totalEquipo ?? 0;
  if (solicitudesMes) solicitudesMes.textContent = data.metricas.solicitudesMes ?? 0;
}

async function cargarPendientes() {
  const data = await fetchConToken('/api/jefatura/pendientes');
  pendientesOriginales = Array.isArray(data.solicitudes) ? data.solicitudes : [];
  renderTablaPendientes(pendientesOriginales);
}

async function cargarHistorial() {
  const data = await fetchConToken('/api/jefatura/historial');
  historialOriginal = Array.isArray(data.solicitudes) ? data.solicitudes : [];
  renderTablaHistorial(historialOriginal);
}

async function cargarCalendario() {
  const data = await fetchConToken('/api/jefatura/calendario');
  calendarioOriginal = Array.isArray(data.ausencias) ? data.ausencias : [];
  renderTablaCalendario(calendarioOriginal);
}

async function cargarConflictos() {
  const data = await fetchConToken('/api/jefatura/conflictos');
  conflictosOriginales = Array.isArray(data.conflictos) ? data.conflictos : [];
  renderTablaConflictos(conflictosOriginales);
}

function renderResumen() {
  const pendientes = pendientesOriginales.length;
  const aprobadas = historialOriginal.filter(s => normalizarEstado(s.estado) === 'aprobada').length;
  const rechazadas = historialOriginal.filter(s => normalizarEstado(s.estado) === 'rechazada').length;

  document.getElementById('total-pendientes').textContent = pendientes;
  document.getElementById('total-aprobadas').textContent = aprobadas;
  document.getElementById('total-rechazadas').textContent = rechazadas;
  document.getElementById('total-procesadas').textContent = historialOriginal.length;
}

function renderUsuarioJefatura() {
  const usuario = JSON.parse(localStorage.getItem('usuario_info') || '{}');
  const nombre = usuario.nombre || usuario.username || 'Jefatura';
  const rol = usuario.rol || 'Módulo de aprobación';

  const userName = document.getElementById('user-name-display');
  const userRole = document.getElementById('user-role-display');
  const avatar = document.getElementById('user-avatar');

  if (userName) userName.textContent = nombre;
  if (userRole) userRole.textContent = rol;
  if (avatar) avatar.textContent = nombre.charAt(0).toUpperCase();
}

function renderTablaPendientes(solicitudes) {
  const tbody = document.getElementById('tabla-pendientes-body');
  if (!tbody) return;

  if (!solicitudes || solicitudes.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="empty-state">No hay solicitudes pendientes por procesar.</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = solicitudes.map(s => `
    <tr>
      <td>#${escapeHtml(s.id)}</td>
      <td>${escapeHtml(s.colaborador || 'Sin nombre')}</td>
      <td>${formatearFecha(s.inicio)}</td>
      <td>${formatearFecha(s.fin)}</td>
      <td>${escapeHtml(String(s.dias ?? '-'))}</td>
      <td>${escapeHtml(s.motivo || 'Vacaciones')}</td>
      <td>${badgeEstado(s.estado)}</td>
      <td>
        <div class="acciones">
          <button class="btn btn-ver" type="button" onclick="verDetalle(${Number(s.id)})">Ver</button>
          <button class="btn btn-aprobar" type="button" onclick="abrirModalDecision(${Number(s.id)}, 'aprobar')">Aprobar</button>
          <button class="btn btn-rechazar" type="button" onclick="abrirModalDecision(${Number(s.id)}, 'rechazar')">Rechazar</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderTablaHistorial(solicitudes) {
  const tbody = document.getElementById('tabla-historial-body');
  if (!tbody) return;

  if (!solicitudes || solicitudes.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="empty-state">Todavía no hay solicitudes procesadas.</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = solicitudes.map(s => `
    <tr>
      <td>#${escapeHtml(s.id)}</td>
      <td>${escapeHtml(s.colaborador || 'Sin nombre')}</td>
      <td>${formatearFecha(s.inicio)}</td>
      <td>${formatearFecha(s.fin)}</td>
      <td>${escapeHtml(String(s.dias ?? '-'))}</td>
      <td>${escapeHtml(s.motivo || 'Vacaciones')}</td>
      <td>${badgeEstado(s.estado)}</td>
      <td>
        <div class="acciones">
          <button class="btn btn-ver" type="button" onclick="verDetalle(${Number(s.id)})">Ver</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderTablaCalendario(ausencias) {
  const tbody = document.getElementById('tabla-calendario-body');
  if (!tbody) return;

  if (!ausencias || ausencias.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">No hay ausencias del equipo registradas.</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = ausencias.map(a => `
    <tr>
      <td>${escapeHtml(a.colaborador || 'Sin nombre')}</td>
      <td>${formatearFecha(a.inicio)}</td>
      <td>${formatearFecha(a.fin)}</td>
      <td>${escapeHtml(String(a.dias ?? '-'))}</td>
      <td>${escapeHtml(a.motivo || 'Vacaciones')}</td>
      <td>${badgeEstado(a.estado)}</td>
    </tr>
  `).join('');
}

function renderTablaConflictos(conflictos) {
  const tbody = document.getElementById('tabla-conflictos-body');
  if (!tbody) return;

  if (!conflictos || conflictos.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">No se detectaron conflictos de ausencias.</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = conflictos.map(c => `
    <tr>
      <td>#${escapeHtml(c.id1)}</td>
      <td>${escapeHtml(c.colaborador1)}</td>
      <td>#${escapeHtml(c.id2)}</td>
      <td>${escapeHtml(c.colaborador2)}</td>
      <td>${formatearFecha(c.inicio_conflicto)}</td>
      <td>${formatearFecha(c.fin_conflicto)}</td>
      <td>${escapeHtml(c.tipo || 'Traslape')}</td>
    </tr>
  `).join('');
}

function aplicarFiltrosPendientes() {
  const texto = document.getElementById('buscarPendiente').value.toLowerCase().trim();
  const estado = document.getElementById('filtroPendienteEstado').value;

  let filtradas = [...pendientesOriginales];

  if (texto) {
    filtradas = filtradas.filter(s =>
      (s.colaborador || '').toLowerCase().includes(texto) ||
      (s.motivo || '').toLowerCase().includes(texto)
    );
  }

  if (estado !== 'todos') {
    filtradas = filtradas.filter(s => normalizarEstado(s.estado) === estado);
  }

  renderTablaPendientes(filtradas);
}

function aplicarFiltrosHistorial() {
  const texto = document.getElementById('buscarHistorial').value.toLowerCase().trim();
  const estado = document.getElementById('filtroHistorialEstado').value;

  let filtradas = [...historialOriginal];

  if (texto) {
    filtradas = filtradas.filter(s =>
      (s.colaborador || '').toLowerCase().includes(texto) ||
      (s.motivo || '').toLowerCase().includes(texto)
    );
  }

  if (estado !== 'todos') {
    filtradas = filtradas.filter(s => normalizarEstado(s.estado) === estado);
  }

  renderTablaHistorial(filtradas);
}

function limpiarFiltrosPendientes() {
  document.getElementById('buscarPendiente').value = '';
  document.getElementById('filtroPendienteEstado').value = 'todos';
  renderTablaPendientes(pendientesOriginales);
}

function limpiarFiltrosHistorial() {
  document.getElementById('buscarHistorial').value = '';
  document.getElementById('filtroHistorialEstado').value = 'todos';
  renderTablaHistorial(historialOriginal);
}

function verDetalle(id) {
  const solicitud =
    pendientesOriginales.find(s => Number(s.id) === Number(id)) ||
    historialOriginal.find(s => Number(s.id) === Number(id));

  if (!solicitud) return;

  document.getElementById('detalle-grid').innerHTML = `
    <div class="detalle-item">
      <div class="k">ID Solicitud</div>
      <div class="v">#${escapeHtml(String(solicitud.id))}</div>
    </div>
    <div class="detalle-item">
      <div class="k">Colaborador</div>
      <div class="v">${escapeHtml(solicitud.colaborador || 'Sin nombre')}</div>
    </div>
    <div class="detalle-item">
      <div class="k">Fecha Inicio</div>
      <div class="v">${formatearFecha(solicitud.inicio)}</div>
    </div>
    <div class="detalle-item">
      <div class="k">Fecha Fin</div>
      <div class="v">${formatearFecha(solicitud.fin)}</div>
    </div>
    <div class="detalle-item">
      <div class="k">Días solicitados</div>
      <div class="v">${escapeHtml(String(solicitud.dias ?? '-'))}</div>
    </div>
    <div class="detalle-item">
      <div class="k">Estado</div>
      <div class="v">${escapeHtml(solicitud.estado || 'Sin estado')}</div>
    </div>
  `;

  document.getElementById('detalle-motivo').textContent = solicitud.motivo || 'Sin motivo registrado';
  document.getElementById('modal-detalle').classList.add('show');
}

function cerrarModalDetalle() {
  document.getElementById('modal-detalle').classList.remove('show');
}

function abrirModalDecision(id, accion) {
  const solicitud = pendientesOriginales.find(s => Number(s.id) === Number(id));
  if (!solicitud) return;

  solicitudSeleccionada = solicitud;
  accionSeleccionada = accion;
  document.getElementById('observacionDecision').value = '';

  const titulo = accion === 'aprobar' ? 'Aprobar solicitud' : 'Rechazar solicitud';
  const texto = accion === 'aprobar'
    ? `¿Deseas aprobar la solicitud #${solicitud.id} de ${solicitud.colaborador}?`
    : `¿Deseas rechazar la solicitud #${solicitud.id} de ${solicitud.colaborador}?`;

  document.getElementById('modal-decision-titulo').textContent = titulo;
  document.getElementById('modal-decision-texto').textContent = texto;

  const btnConfirmar = document.getElementById('btn-confirmar-decision');
  btnConfirmar.textContent = accion === 'aprobar' ? 'Sí, aprobar' : 'Sí, rechazar';
  btnConfirmar.className = accion === 'aprobar' ? 'btn-confirmar-aprobar' : 'btn-confirmar-rechazar';
  btnConfirmar.onclick = confirmarDecision;

  document.getElementById('modal-decision').classList.add('show');
}

function cerrarModalDecision() {
  document.getElementById('modal-decision').classList.remove('show');
  solicitudSeleccionada = null;
  accionSeleccionada = null;
}

async function confirmarDecision() {
  if (!solicitudSeleccionada || !accionSeleccionada) return;

  const observacion = document.getElementById('observacionDecision').value.trim();
  const endpoint = accionSeleccionada === 'aprobar'
    ? '/api/jefatura/aprobar'
    : '/api/jefatura/rechazar';

  try {
    const token = getToken();

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        id: solicitudSeleccionada.id,
        observacion
      })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.mensaje || 'No se pudo procesar la solicitud.');
      return;
    }

    alert(data.mensaje || 'Solicitud procesada correctamente.');
    cerrarModalDecision();
    await cargarModuloJefatura();
  } catch (error) {
    console.error('Error procesando solicitud:', error);
    alert('Ocurrió un error al procesar la solicitud.');
  }
}

function normalizarEstado(estado) {
  return (estado || '').toString().trim().toLowerCase();
}

function badgeEstado(estado) {
  const e = normalizarEstado(estado);
  let clase = 'estado-pendiente';

  if (e === 'aprobada' || e === 'aprobado') {
    clase = 'estado-aprobada';
  } else if (e === 'rechazada') {
    clase = 'estado-rechazada';
  }

  return `<span class="estado-badge ${clase}">${escapeHtml(estado || 'Sin estado')}</span>`;
}

function formatearFecha(fecha) {
  if (!fecha) return '-';

  const partes = String(fecha).split('-');
  if (partes.length !== 3) return fecha;

  const [anio, mes, dia] = partes;
  return `${dia}/${mes}/${anio}`;
}

function escapeHtml(texto) {
  return String(texto)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function setContenido(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}