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

module.exports = {
  registrarAccion,
  emitirEventoAuditoria,
  TIPOS_ACCION_PERMITIDOS
};
