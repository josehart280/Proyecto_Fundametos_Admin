let pendientesOriginales = [];
let historialOriginal = [];
let solicitudSeleccionada = null;
let accionSeleccionada = null;

document.addEventListener('DOMContentLoaded', () => {
  cargarModuloJefatura();

  document.getElementById('buscarPendiente').addEventListener('input', aplicarFiltrosPendientes);
  document.getElementById('filtroPendienteEstado').addEventListener('change', aplicarFiltrosPendientes);

  document.getElementById('buscarHistorial').addEventListener('input', aplicarFiltrosHistorial);
  document.getElementById('filtroHistorialEstado').addEventListener('change', aplicarFiltrosHistorial);
});

async function cargarModuloJefatura() {
  try {
    await Promise.all([
      cargarPendientes(),
      cargarHistorial()
    ]);
    renderResumen();
  } catch (error) {
    console.error('Error cargando módulo de jefatura:', error);

    document.getElementById('tabla-pendientes-body').innerHTML = `
      <tr>
        <td colspan="8">No se pudieron cargar las solicitudes pendientes.</td>
      </tr>
    `;

    document.getElementById('tabla-historial-body').innerHTML = `
      <tr>
        <td colspan="8">No se pudo cargar el historial.</td>
      </tr>
    `;
  }
}

async function cargarPendientes() {
  const token = localStorage.getItem('sesion_token');
  const res = await fetch('/api/jefatura/pendientes', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.mensaje || 'Error cargando pendientes');
  }

  pendientesOriginales = Array.isArray(data.solicitudes) ? data.solicitudes : [];
  renderTablaPendientes(pendientesOriginales);
}

async function cargarHistorial() {
  const token = localStorage.getItem('sesion_token');
  const res = await fetch('/api/jefatura/historial', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.mensaje || 'Error cargando historial');
  }

  historialOriginal = Array.isArray(data.solicitudes) ? data.solicitudes : [];
  renderTablaHistorial(historialOriginal);
}

function renderResumen() {
  const pendientes = pendientesOriginales.length;
  const aprobadas = historialOriginal.filter(s => normalizarEstado(s.estado) === 'aprobada').length;
  const rechazadas = historialOriginal.filter(s => normalizarEstado(s.estado) === 'rechazada').length;

  document.getElementById('total-pendientes').textContent = pendientes;
  document.getElementById('total-aprobadas').textContent = aprobadas;
  document.getElementById('total-rechazadas').textContent = rechazadas;
  document.getElementById('total-procesadas').textContent = historialOriginal.length;

  const nombre = 'Jefatura';
  document.getElementById('user-name-display').textContent = nombre;
  document.getElementById('user-role-display').textContent = 'Bandeja de aprobación';
  document.getElementById('user-avatar').textContent = nombre.charAt(0).toUpperCase();
}

function renderTablaPendientes(solicitudes) {
  const tbody = document.getElementById('tabla-pendientes-body');

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
          <button class="btn btn-ver" type="button" onclick="verDetalle(${Number(s.id)}, true)">Ver</button>
        </div>
      </td>
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

  if (!solicitud) {
    return;
  }

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
  if (!solicitud) {
    return;
  }

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
  if (!solicitudSeleccionada || !accionSeleccionada) {
    return;
  }

  const observacion = document.getElementById('observacionDecision').value.trim();
  const endpoint = accionSeleccionada === 'aprobar'
    ? '/api/jefatura/aprobar'
    : '/api/jefatura/rechazar';

  try {
    const token = localStorage.getItem('sesion_token');
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