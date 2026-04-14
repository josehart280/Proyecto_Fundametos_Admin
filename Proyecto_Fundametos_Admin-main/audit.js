/**
 * Servicio transversal de auditoria de acciones (PRF-AUD-02)
 * Registra eventos inmutables en la tabla Auditoria_Acciones.
 */

const crypto = require('crypto');
const db = require('./db');

const TIPOS_ACCION_PERMITIDOS = new Set([
  'INSERT',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'LOGOUT',
  'APPROVE',
  'REJECT'
]);

function formatearTimestamp(fecha = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  const y = fecha.getFullYear();
  const m = pad(fecha.getMonth() + 1);
  const d = pad(fecha.getDate());
  const hh = pad(fecha.getHours());
  const mm = pad(fecha.getMinutes());
  const ss = pad(fecha.getSeconds());
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

function validarEvento(evento) {
  const errores = [];

  if (!evento || typeof evento !== 'object') {
    errores.push('payload vacío o inválido');
    return errores;
  }

  const obligatorios = ['timestamp', 'evento_id', 'usuario_id', 'tipo_accion', 'entidad_afectada', 'registro_id'];
  obligatorios.forEach(campo => {
    if (evento[campo] === undefined || evento[campo] === null || evento[campo] === '') {
      errores.push(`campo obligatorio ausente: ${campo}`);
    }
  });

  if (evento.tipo_accion && !TIPOS_ACCION_PERMITIDOS.has(String(evento.tipo_accion).toUpperCase())) {
    errores.push(`tipo_accion no permitido: ${evento.tipo_accion}`);
  }

  if (evento.usuario_id && Number.isNaN(Number(evento.usuario_id))) {
    errores.push('usuario_id debe ser numérico');
  }

  return errores;
}

async function registrarAccion(evento) {
  const errores = validarEvento(evento);
  if (errores.length > 0) {
    console.error('[AUDITORIA] Evento rechazado por validación:', errores.join(' | '), evento);
    return { ok: false, errores };
  }

  await db.query(
    `INSERT INTO Auditoria_Acciones
      (id_Evento, Fecha_Evento, usuario_id, tipo_accion, entidad_afectada, registro_id, ip_origen, detalle_json)
     VALUES
      (@id_evento, @fecha_evento, @usuario_id, @tipo_accion, @entidad_afectada, @registro_id, @ip_origen, @detalle_json)`,
    {
      id_evento: evento.evento_id,
      fecha_evento: evento.timestamp,
      usuario_id: Number(evento.usuario_id),
      tipo_accion: String(evento.tipo_accion).toUpperCase(),
      entidad_afectada: evento.entidad_afectada,
      registro_id: String(evento.registro_id),
      ip_origen: evento.ip_origen || null,
      detalle_json: evento.detalle_json ? JSON.stringify(evento.detalle_json) : null
    }
  );

  return { ok: true };
}

async function emitirEventoAuditoria({ usuario_id, tipo_accion, entidad_afectada, registro_id, ip_origen, detalle_json }) {
  const evento = {
    timestamp: formatearTimestamp(),
    evento_id: crypto.randomUUID(),
    usuario_id,
    tipo_accion,
    entidad_afectada,
    registro_id,
    ip_origen: ip_origen || null,
    detalle_json: detalle_json || null
  };

  return registrarAccion(evento);
}

async function consultarEventos(filtros = {}) {
  const {
    fechaDesde, fechaHasta, usuario_id, tipo_accion,
    entidad_afectada, page = 1, limit = 50
  } = filtros;

  const condiciones = [];
  const params = {};

  if (fechaDesde) {
    condiciones.push('a.Fecha_Evento >= @fechaDesde');
    params.fechaDesde = fechaDesde;
  }
  if (fechaHasta) {
    condiciones.push('a.Fecha_Evento <= @fechaHasta');
    params.fechaHasta = fechaHasta;
  }
  if (usuario_id) {
    condiciones.push('a.usuario_id = @filtro_usuario_id');
    params.filtro_usuario_id = Number(usuario_id);
  }
  if (tipo_accion) {
    condiciones.push('a.tipo_accion = @filtro_tipo_accion');
    params.filtro_tipo_accion = String(tipo_accion).toUpperCase();
  }
  if (entidad_afectada) {
    condiciones.push('a.entidad_afectada = @filtro_entidad');
    params.filtro_entidad = entidad_afectada;
  }

  const where = condiciones.length > 0
    ? 'WHERE ' + condiciones.join(' AND ')
    : '';

  const offset = (Number(page) - 1) * Number(limit);

  const countResult = await db.query(
    `SELECT COUNT(*) as total FROM Auditoria_Acciones a ${where}`,
    params
  );
  const total = countResult && countResult[0] ? countResult[0].total : 0;

  const eventos = await db.query(
    `SELECT
       a.id_Auditoria,
       a.id_Evento,
       CONVERT(varchar, a.Fecha_Evento, 120) as timestamp,
       a.usuario_id,
       a.tipo_accion,
       a.entidad_afectada,
       a.registro_id,
       a.ip_origen,
       a.detalle_json,
       ISNULL(p.Nombre, '') + ' ' + ISNULL(p.Apellido, '') as nombre_usuario
     FROM Auditoria_Acciones a
     LEFT JOIN Usuarios u ON a.usuario_id = u.id_Usuario
     LEFT JOIN Personal p ON u.id_Personal = p.id_Personal
     ${where}
     ORDER BY a.Fecha_Evento DESC, a.id_Auditoria DESC
     OFFSET ${offset} ROWS FETCH NEXT ${Number(limit)} ROWS ONLY`,
    params
  );

  return {
    eventos: eventos || [],
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / Number(limit))
  };
}

async function getMetricas() {
  const hoy = formatearTimestamp(new Date());
  const fechaHoy = hoy.split(' ')[0];

  const fechaSemana = new Date();
  fechaSemana.setDate(fechaSemana.getDate() - 7);
  const haceUnaSemana = formatearTimestamp(fechaSemana).split(' ')[0];

  const fechaMes = new Date();
  fechaMes.setDate(fechaMes.getDate() - 30);
  const haceUnMes = formatearTimestamp(fechaMes).split(' ')[0];

  const [hoyResult, semanaResult, mesResult, porTipoResult, topUsuariosResult] = await Promise.all([
    db.query(
      `SELECT COUNT(*) as total FROM Auditoria_Acciones WHERE CONVERT(date, Fecha_Evento) = @fecha`,
      { fecha: fechaHoy }
    ),
    db.query(
      `SELECT COUNT(*) as total FROM Auditoria_Acciones WHERE CONVERT(date, Fecha_Evento) >= @fecha`,
      { fecha: haceUnaSemana }
    ),
    db.query(
      `SELECT COUNT(*) as total FROM Auditoria_Acciones WHERE CONVERT(date, Fecha_Evento) >= @fecha`,
      { fecha: haceUnMes }
    ),
    db.query(
      `SELECT tipo_accion, COUNT(*) as total FROM Auditoria_Acciones GROUP BY tipo_accion ORDER BY total DESC`
    ),
    db.query(
      `SELECT TOP 5 a.usuario_id, ISNULL(p.Nombre,'') + ' ' + ISNULL(p.Apellido,'') as nombre, COUNT(*) as total
       FROM Auditoria_Acciones a
       LEFT JOIN Usuarios u ON a.usuario_id = u.id_Usuario
       LEFT JOIN Personal p ON u.id_Personal = p.id_Personal
       GROUP BY a.usuario_id, p.Nombre, p.Apellido
       ORDER BY total DESC`
    )
  ]);

  return {
    hoy: hoyResult && hoyResult[0] ? hoyResult[0].total : 0,
    estaSemana: semanaResult && semanaResult[0] ? semanaResult[0].total : 0,
    esteMes: mesResult && mesResult[0] ? mesResult[0].total : 0,
    porTipo: porTipoResult || [],
    topUsuarios: topUsuariosResult || []
  };
}

module.exports = {
  registrarAccion,
  emitirEventoAuditoria,
  consultarEventos,
  getMetricas,
  TIPOS_ACCION_PERMITIDOS
};
