## Exploration: modulo-auditoria

### Current State
- `audit.js` (103 lines): Backend service con `registrarAccion()`, `emitirEventoAuditoria()`, y `TIPOS_ACCION_PERMITIDOS`. Usa parameterized queries.
- DB: `Auditoria_Acciones` table con immutability trigger + role `rol_app_auditoria`. Schema production-ready.
- `Intentos_Acceso` (auth): Tabla separada para intentos de acceso. Dual audit system.
- Integration: 6 audit event emissions in server.js (INSERT solicitud, UPDATE cancel, APPROVE, REJECT, LOGIN, LOGOUT).
- Missing audits: password recovery, failed logins to Auditoria_Acciones, admin actions.
- API: `/api/auditoria/acciones` (con role check), `/api/auditar/intentos-acceso` (SIN role check, SIN paginación).
- Frontend: NO EXISTE. Zero audit HTML/JS pages.

### Affected Areas
- `server.js` — Add endpoints con filtros/paginación, add audit events for password recovery
- `audit.js` — Add `consultarEventos(filtros)`, `getMetricas()`
- `public/auditoria.html` — NEW: Dashboard de auditoría
- `public/js/auditoria.js` — NEW: Lógica frontend
- `public/css/global.css` — Extender con estilos audit dashboard
- Dashboard sidebar links — Add "Auditoría" para roles admin/rrhh/patrocinador

### Approaches
1. **Minimal** — Solo frontend de consulta con filtros básicos. ~4-6h. Risk: Low. Deja fuera dashboard métricas.
2. **Full Module + Dashboard (Recommended)** — Frontend completo con métricas, filtros, paginación, fix role check, add missing audit events. ~8-12h. Risk: Medium.
3. **Full + Reportes** — Option B + PDF export + scheduling. ~16-24h. Risk: High. Over-engineering para proyecto estudiantil.

### Recommendation
**Option B.** Backend audit.js es sólido, schema es production-ready. El gap principal es frontend. Option A deja mucho afuera, Option C over-engineers.

### Risks
- `/api/auditar/intentos-acceso` SIN role check (cualquier usuario autenticado ve todo)
- Password recovery actions no auditadas en Auditoria_Acciones
- SQL injection existente en server.js (no específico de auditoría pero afecta queries nuevas)
- Frontend vanilla JS sin framework → state management manual para filtros/paginación