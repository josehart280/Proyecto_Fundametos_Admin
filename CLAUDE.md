# CLAUDE.md - Sistema de Vacaciones CUCR

## Project Overview

**Sistema de Gestión de Vacaciones** para el Colegio Universitario de Cartago (CUCR).
Proyecto estudiantil de Administración de Proyectos - Implementación de sistema real de gestión de vacaciones para empleados universitarios.

### Alcance del Sistema
- Módulo Colaborador: Dashboard, solicitud de vacaciones, consulta de historial
- Módulo Aprobación: Bandeja de entrada para jefaturas, calendario de equipo
- Módulo Administración: Gestión de usuarios, configuración de políticas
- Módulo Autenticación: Login, cierre de sesión, recuperación de contraseña
- Módulo Auditoría: Registro inmutable de todas las acciones

## Tech Stack

- **Runtime**: Node.js 18+ (puro, sin Express)
- **Database**: SQL Server 2016+ (via mssql)
- **Frontend**: Vanilla HTML5, CSS3, JavaScript ES6+
- **Architecture**: REST API con servidor HTTP nativo
- **UI Design**: Glassmorphism (diseño premium con transparencias)

## Commands

```bash
# Install dependencies
npm install

# Start server
npm start

# Server runs on http://localhost:3000 (o 3001 en Dencel-Branch)
```

## Estructura de Ramas

| Rama | Estado | Descripción |
|------|--------|-------------|
| **main** | ⚠️ Base | Solo servidor básico con 2 APIs |
| **Geral_Dashboard-Colaborador** | 🟡 Parcial | Dashboard + Solicitud (SIN "Mis Solicitudes") |
| **Dencel-Branch** | 🟢 Más completa | Dashboard + Solicitud + Mis Solicitudes |

**Estrategia de merge**: Dencel-Branch es la rama más completa. Contiene todo lo de Geral + el módulo "Mis Solicitudes".

## Architecture

### Backend

**server.js** - Servidor HTTP nativo que:
- Sirve archivos estáticos desde `/public`
- Rutas API bajo `/api/*`
- CORS configurado para requests cross-origin
- **⚠️ CRÍTICO**: Tiene SQL Injection en endpoints POST (concatenación de strings SQL)

**db.js** - Módulo de base de datos:
- Connection pool usando mssql
- Métodos: query, insertar, actualizar, eliminar
- Prueba automática de conexión
- **Nota**: Las funciones de insertar/actualizar usan parameterized queries, pero server.js no las usa

### Frontend

**public/** - Archivos estáticos:
- `index.html` - Landing page
- `dashboard.html` - Dashboard del colaborador (saldo, calendario, solicitudes recientes)
- `solicitud.html` - Formulario de nueva solicitud de vacaciones
- `mis_solicitudes.html` - Listado completo con filtros (solo en Dencel-Branch)
- `css/global.css` - Sistema de diseño Glassmorphism
- `js/dashboard.js` - Lógica del dashboard y calendario
- `js/solicitud.js` - Lógica del formulario de solicitud
- `js/mis_solicitudes.js` - Lógica de tabla y filtros (solo en Dencel-Branch)

## API Routes

### Core APIs

| Method | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/test` | Test de conexión a BD |
| GET | `/api/usuarios` | Lista usuarios (LIMIT 100) |
| GET | `/api/dashboard` | Datos dashboard: usuario, nombramientos, solicitudes, feriados |
| POST | `/api/solicitudes` | Crear solicitud + bloquear saldo + registrar movimiento |
| POST | `/api/cancelar` | Cancelar solicitud + reembolsar saldo + registrar movimiento |

### Notas de Seguridad ⚠️

1. **SQL Injection**: Las APIs POST concatenan strings SQL directamente. Ejemplo vulnerable:
   ```javascript
   await db.query(`INSERT INTO ... VALUES (1, '${data.fInicio}', ...)`);
   ```
   **Corrección**: Usar parameterized queries con `request.input()`

2. **Usuario Hardcoded**: Todas las queries usan `id_Personal = 1` hardcodeado.
   **Solución**: Implementar JWT o session-based auth

## Database Schema

### Tablas Identificadas

```sql
-- Personal/Empleados
Personal (id_Personal, Nombre, Apellido, ...)

-- Saldos de vacaciones
Saldos_Vacacionales (id_Personal, saldo_Disponible)

-- Nombramientos (multipuesto)
Nombramientos (id_Personal, id_Rol, id_Carrera, Tipo_Nombramiento, Fraccion_Tiempo)

-- Catálogos
Roles (id_Rol, Nombre)
Carreras (id_Carrera, Nombre)

-- Solicitudes de vacaciones
Solicitudes_Vacaciones (
  id_Solicitud,
  id_Personal,
  fecha_Inicio,
  fecha_Fin,
  dias_Solicitados,
  Motivo,
  Estado  -- 'Pendiente', 'Aprobada', 'Cancelada', 'Rechazada'
)

-- Feriados institucionales
Feriados (fecha, descripcion)

-- Kardex/Movimientos contables
Movimientos_Saldo (
  id_Personal,
  Tipo_Movimiento,  -- 'Suma', 'Resta'
  Dias,
  Motivo
)
```

## Requerimientos del Sistema

### Nivel 0 (Obligatorios)

| ID | Módulo | Descripción |
|----|--------|-------------|
| PRF-AUT-00 | Autenticación | Login, sesiones, recuperación de contraseña |
| PRF-COL-00 | Colaborador | Dashboard, solicitudes, historial, cancelación |
| PRF-APR-00 | Aprobación | Bandeja de entrada, aprobar/rechazar, calendario equipo |
| PRF-ADM-00 | Administración | Gestión usuarios, ajuste saldos, configuración |
| PRF-AUD-00 | Auditoría | Registro inmutable de acciones, reportes |

### Nivel 1 (Deseables) - Estado de Implementación

| ID | Requerimiento | Rama | Estado |
|----|--------------|------|--------|
| PRF-AUT-01 | Pantalla Login | Ninguna | ❌ No implementado |
| PRF-AUT-02 | Cierre Sesión | Ninguna | ❌ No implementado |
| PRF-AUT-03 | Registro Acceso | Parcial | 🟡 Logging básico |
| PRF-AUT-04 | Recuperación Contraseña | Ninguna | ❌ No implementado |
| PRF-COL-01 | Mis Solicitudes | Dencel | ✅ Implementado |
| PRF-COL-02 | Solicitud Vacaciones | Dencel/Geral | ✅ Implementado |
| PRF-COL-03 | Dashboard Empleado | Dencel/Geral | ✅ Implementado |
| PRF-COL-04 | Cancelación Solicitud | Dencel | ✅ Implementado |
| PRF-JEF-01 | Métricas Equipo | Ninguna | ❌ No implementado |
| PRF-JEF-02 | Calendario | Dencel | 🟡 Parcial (solo visualización) |
| PRF-JEF-03 | Bandeja Entrada | Ninguna | ❌ No implementado |
| PRF-JEF-04 | Bandeja Historial | Ninguna | ❌ No implementado |
| PRF-ADM-01 | Gestión Usuarios | Ninguna | ❌ No implementado |
| PRF-ADM-02 | Configuraciones | Ninguna | ❌ No implementado |
| PRF-ADM-03 | Reportes | Ninguna | ❌ No implementado |
| PRF-AUD-02 | Registro Acciones | Parcial | 🟡 Solo movimientos saldo |
| PRF-AUD-03 | Registro Solicitudes | Parcial | 🟡 Solo creación |

## Flujo de Datos

```
Colaborador → Solicitud → Aprobación (Jefatura)
     ↓              ↓
Auditoría ← Registro de acciones
     ↓
Administración (RRHH) - Reportes, ajustes
```

## Problemas Críticos Pendientes

### Seguridad (Bloqueantes para producción)

1. **SQL Injection** - Todas las APIs POST son vulnerables
2. **Autenticación** - No existe, ID=1 hardcodeado
3. **Validación Server-Side** - Solo hay validaciones en frontend
4. **Transacciones SQL** - Operaciones de 3 pasos no son atómicas

### Funcionalidad Faltante

1. **Módulo de Aprobación** - Jefaturas no tienen interfaz
2. **Módulo de Administración** - RRHH no tiene interfaz
3. **Autenticación real** - Login/logout con credenciales
4. **Notificaciones** - Email cuando cambia estado

## Buenas Prácticas Implementadas

1. **Glassmorphism Design** - Diseño moderno con transparencias
2. **Cálculo de días hábiles** - Excluye fines de semana y feriados
3. **Movimientos contables** - Registro de sumas/restas en auditoría
4. **Multipuesto** - Soporte para múltiples nombramientos
5. **UX** - Animaciones, toast notifications, modales

## Git Workflow

```bash
# Ver estado de ramas
git branch -a
git log --oneline --all --graph

# Merge estrategia recomendada:
# 1. Dencel-Branch tiene todo lo de Geral + Mis Solicitudes
# 2. Merge Dencel-Branch a main para tener el sistema más completo
git checkout main
git merge origin/Dencel-Branch

# Commit sin verificación (skip hooks)
git commit --no-verify -m "feat: description"
git push origin main
```

## Documentación de Requerimientos

Ubicación: `D:\ProyectoAdmin\requerimientos\`

- `Nivel 0/` - Requerimientos obligatorios (5 módulos)
- `Nivel 1/` - Requerimientos deseables (17 funcionalidades)
- `Cronograma_Sistema_Vacaciones.xlsx` - Planificación de entregas

## Configuration

Variables de entorno en `.env`:
```
DB_HOST=localhost
DB_USER=sa
DB_PASSWORD=your_password
DB_NAME=VacacionesCUCR
PORT=3000
```

**Nota**: El archivo `.env` contiene credenciales y está en `.gitignore`.

---

**Última actualización**: 2026-03-23
**Análisis de ramas completado**: Se identificó que Dencel-Branch es la rama más completa y debe ser la base para producción.
