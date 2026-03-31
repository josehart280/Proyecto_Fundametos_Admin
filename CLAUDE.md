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
- **Email**: Nodemailer (para recuperación de contraseña)

## Commands

```bash
# Install dependencies (incluye nodemailer)
npm install

# Start server
npm start

# Server runs on http://localhost:3001
```

## Estructura de Archivos

```
Proyecto_Fundametos_Admin/
├── auth.js                  ← Módulo de autenticación (login, logout, tokens, bloqueo)
├── mailer.js                ← Wrapper nodemailer para envío de emails
├── server.js                ← Servidor HTTP + todas las APIs REST
├── db.js                    ← Módulo de conexión SQL Server con pool
├── package.json             ← Dependencias: mssql, dotenv, nodemailer
├── .env                     ← Variables de entorno (credenciales BD + SMTP)
├── .env.example             ← Template de variables (para compartir sin credenciales)
├── SCRIPT_SQL_AUTENTICACION.sql  ← DDL para tablas de autenticación
└── public/
    ├── index.html           ← Landing page (redirige a login si no hay sesión)
    ├── login.html           ← Pantalla de inicio de sesión
    ├── recuperar-password.html ← Flujo de recuperación de contraseña (3 pasos)
    ├── dashboard.html       ← Dashboard del colaborador
    ├── solicitud.html       ← Formulario de solicitud de vacaciones
    ├── mis_solicitudes.html ← Historial completo con filtros
    ├── css/
    │   ├── auth.css        ← Estilos de las páginas de autenticación
    │   ├── global.css      ← Sistema de diseño Glassmorphism
    │   └── styles.css      ← Estilos base
    └── js/
        ├── dashboard.js     ← Lógica del dashboard y calendario
        ├── solicitud.js     ← Lógica del formulario
        ├── mis_solicitudes.js ← Lógica de tabla y filtros
        └── main.js         ← Lógica base
```

## Arquitectura

### Backend

**server.js** - Servidor HTTP nativo que:
- Sirve archivos estáticos desde `/public`
- Rutas API bajo `/api/*`
- CORS configurado para requests cross-origin
- **⚠️ CRÍTICO**: Tiene SQL Injection en endpoints POST (concatenación de strings SQL)
- Incluye todas las rutas del módulo Colaborador + módulo de Autenticación

**auth.js** - Módulo de autenticación:
- `validarCredenciales(username, password)` — verifica credenciales contra BD
- `crearSesion(id_Usuario)` — genera token de sesión (8 horas)
- `cerrarSesion(token)` — invalida el token
- `validarSesion(token)` — verifica si el token es activo
- `generarTokenRecuperacion(id_Usuario)` — genera token de recuperación (15 min)
- `cambiarPasswordConToken(token, nuevaPassword)` — cambia password con token
- `registrarIntento(id_Usuario, resultado, razon, ip)` — auditoría de accesos
- Bloqueo de cuenta tras 3 intentos fallidos (30 min de bloqueo)

**db.js** - Módulo de base de datos:
- Connection pool usando mssql
- Métodos: query, insertar, actualizar, eliminar
- Prueba automática de conexión

**mailer.js** - Wrapper de nodemailer:
- `enviarRecuperacionPassword(correo, nombre, token, minutosValidez)`
- `enviarConfirmacionCambioPassword(correo, nombre)`

### Frontend

**public/** - Archivos estáticos:
- `index.html` - Landing page con redirección automática a login
- `login.html` - Formulario de login con glassmorphism
- `recuperar-password.html` - Flujo de 3 pasos para recuperación
- `dashboard.html` - Dashboard del colaborador
- `solicitud.html` - Formulario de solicitud de vacaciones
- `mis_solicitudes.html` - Listado completo con filtros

## API Routes

### Autenticación (PRF-AUT-00) ✅

| Method | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/login` | Login con username/password. Devuelve token de sesión (8h) |
| POST | `/api/logout` | Cierra sesión, invalida el token |
| POST | `/api/solicitar-recuperacion` | Genera token de recuperación y envía email |
| POST | `/api/cambiar-password` | Cambia password usando token de recuperación |
| GET | `/api/validar-sesion` | Verifica si el token de sesión es válido |

### Colaborador (PRF-COL-00) ✅

| Method | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/test` | Test de conexión a BD |
| GET | `/api/usuarios` | Lista usuarios (LIMIT 100) |
| GET | `/api/dashboard` | Datos dashboard: usuario, nombramientos, solicitudes, feriados |
| POST | `/api/solicitudes` | Crear solicitud + bloquear saldo + registrar movimiento |
| POST | `/api/cancelar` | Cancelar solicitud + reembolsar saldo + registrar movimiento |

### Auditoría

| Method | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/auditar/intentos-acceso` | Obtiene historial de intentos de acceso (requiere token) |

### Notas de Seguridad ⚠️

1. **SQL Injection**: Las APIs POST concatenan strings SQL directamente.
   **Corrección**: Usar parameterized queries con `request.input()`

2. **Contraseñas en texto plano**: Las contraseñas se comparan sin hash (sin bcrypt).
   **⚠️ TODO**: Implementar bcrypt antes de producción. El archivo `auth.js` tiene un TODO marcado.

3. **Transacciones SQL**: Las operaciones de 3 pasos no son atómicas.
   **Corrección**: Usar `sql.Transaction()` con commit/rollback.

## Database Schema

### Tablas Originales

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
  id_Solicitud, id_Personal, fecha_Inicio, fecha_Fin,
  dias_Solicitados, Motivo, Estado  -- 'Pendiente', 'Aprobada', 'Cancelada', 'Rechazada'
)

-- Feriados institucionales
Feriados (fecha, descripcion)

-- Kardex/Movimientos contables
Movimientos_Saldo (id_Personal, Tipo_Movimiento, Dias, Motivo, Fecha_Registro)
```

### Tablas de Autenticación (crear con SCRIPT_SQL_AUTENTICACION.sql)

```sql
-- Sesiones activas
Sesiones (
  id_Sesion INT PRIMARY KEY,
  id_Usuario INT,
  Token VARCHAR(500) UNIQUE,
  Fecha_Creacion DATETIME,
  Fecha_Expiracion DATETIME,
  Activa BIT DEFAULT 1
)

-- Tokens de recuperación de password
Recuperacion_Password (
  id_Recuperacion INT PRIMARY KEY,
  id_Usuario INT,
  Token VARCHAR(500) UNIQUE,
  Fecha_Creacion DATETIME,
  Fecha_Expiracion DATETIME,
  Utilizado BIT DEFAULT 0
)

-- Auditoría de intentos de acceso
Intentos_Acceso (
  id_Intento INT PRIMARY KEY,
  id_Usuario INT,
  Fecha_Intento DATETIME,
  Resultado VARCHAR(20),  -- 'exitoso', 'fallido'
  Razon_Fallo VARCHAR(500),
  IP_Cliente VARCHAR(50)
)

-- Auditoría de intentos de recuperación
Intentos_Recuperacion (
  id_Intento INT PRIMARY KEY,
  id_Usuario INT,
  Correo VARCHAR(100),
  Fecha_Intento DATETIME,
  Token_Enviado VARCHAR(500),
  Estado VARCHAR(20)  -- 'enviado', 'utilizado', 'expirado'
)
```

## Requerimientos del Sistema

### Nivel 0 (Obligatorios)

| ID | Módulo | Estado |
|----|--------|--------|
| PRF-AUT-00 | Autenticación | ✅ Implementado |
| PRF-COL-00 | Colaborador | ✅ Implementado |
| PRF-APR-00 | Aprobación | ❌ No iniciado |
| PRF-ADM-00 | Administración | ❌ No iniciado |
| PRF-AUD-00 | Auditoría | 🟡 Parcial |

### Nivel 1 (Deseables) - Estado de Implementación

| ID | Requerimiento | Estado |
|----|--------------|--------|
| PRF-AUT-01 | Pantalla Login | ✅ Implementado |
| PRF-AUT-02 | Cierre Sesión | ✅ Implementado |
| PRF-AUT-03 | Registro Acceso | ✅ Implementado (completo con auditoría) |
| PRF-AUT-04 | Recuperación Contraseña | ✅ Implementado |
| PRF-COL-01 | Mis Solicitudes | ✅ Implementado |
| PRF-COL-02 | Solicitud Vacaciones | ✅ Implementado |
| PRF-COL-03 | Dashboard Empleado | ✅ Implementado |
| PRF-COL-04 | Cancelación Solicitud | ✅ Implementado |
| PRF-JEF-01 | Métricas Equipo | ❌ No implementado |
| PRF-JEF-02 | Calendario | 🟡 Parcial (solo visualización) |
| PRF-JEF-03 | Bandeja Entrada | ❌ No implementado |
| PRF-JEF-04 | Bandeja Historial | ❌ No implementado |
| PRF-ADM-01 | Gestión Usuarios | ❌ No implementado |
| PRF-ADM-02 | Configuraciones | ❌ No implementado |
| PRF-ADM-03 | Reportes | ❌ No implementado |
| PRF-AUD-02 | Registro Acciones | 🟡 Solo movimientos saldo |
| PRF-AUD-03 | Registro Solicitudes | 🟡 Solo creación |

## Flujo de Datos

```
Login → Sesión Token → Acceder a Dashboard/Solicitudes
                                 ↓
                         Solicitud → Aprobación (Jefatura)
                                 ↓
                          Auditoría ← Registro de acciones
                                 ↓
                    Administración (RRHH) - Reportes, ajustes
```

## Problemas Críticos Pendientes

### Seguridad (Bloqueantes para producción)

1. **SQL Injection** - Todas las APIs POST son vulnerables
2. **Contraseñas sin hash** - Sin bcrypt. Las passwords están en texto plano.
3. **Validación Server-Side** - Solo hay validaciones en frontend
4. **Transacciones SQL** - Operaciones de 3 pasos no son atómicas

### Funcionalidad Faltante

1. **Módulo de Aprobación** - Jefaturas no tienen interfaz
2. **Módulo de Administración** - RRHH no tiene interfaz
3. **Notificaciones** - Email cuando cambia estado de solicitud

## Configuración

### Archivo .env (copiar de .env.example)

```env
# Base de datos
DB_HOST=localhost
DB_USER=sa
DB_PASSWORD=your_password
DB_NAME=VacacionesCUCR
PORT=3001

# Configuración SMTP (para recuperación de contraseña)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_email@gmail.com
SMTP_PASS=tu_app_password
SMTP_FROM=Sistema Vacaciones CUCR <noreply@cucr.ac.cr>
```

### Setup Inicial de BD

1. Ejecutar `SCRIPT_SQL_AUTENTICACION.sql` en SQL Server Management Studio
2. Copiar `.env.example` a `.env` y completar credenciales
3. Crear un usuario de prueba (el script SQL crea `ProyectoAdmin` / `Proyectos0123`)

## Buenas Prácticas Implementadas

1. **Glassmorphism Design** - Diseño moderno con transparencias
2. **Cálculo de días hábiles** - Excluye fines de semana y feriados
3. **Movimientos contables** - Registro de sumas/restas en auditoría
4. **Multipuesto** - Soporte para múltiples nombramientos
5. **UX** - Animaciones, toast notifications, modales
6. **Sesiones con timeout** - Tokens expiran en 8 horas
7. **Bloqueo de cuenta** - 3 intentos fallidos = 30 min de bloqueo
8. **Auditoría completa** - Todos los intentos de acceso registrados

---

**Última actualización**: 2026-03-29
**Integración completada**: Módulo de autenticación de Josué integrado al main. PRF-AUT-01, PRF-AUT-02, PRF-AUT-04 implementados.
