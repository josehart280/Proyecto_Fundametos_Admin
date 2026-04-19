# Sistema de Vacaciones CUC

**Sistema de Gestión de Vacaciones para el Colegio Universitario de Cartago (CUC)**

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![SQL Server](https://img.shields.io/badge/SQL%20Server-2016+-blue.svg)](https://www.microsoft.com/sql-server)
[![Estado](https://img.shields.io/badge/Estado-Completado-brightgreen.svg)]()
[![Glassmorphism](https://img.shields.io/badge/Diseño-Glassmorphism-purple.svg)]()

Proyecto estudiantil desarrollado para la asignatura de **Fundamentos de Administración de Proyectos** - Carrera de Administración de Sistemas Informáticos.

---

## Estado del Proyecto

### Estado General: ✅ Completado (100%)

```
██████████████████████████████████████████████  100%
```

### Progreso por Módulos

| Módulo | Estado | Progreso | Responsable |
|--------|--------|----------|-------------|
| **Autenticación** (PRF-AUT) | ✅ Completado | `███████████████████████████████` **100%** | Josué, Geral |
| **Colaborador** (PRF-COL) | ✅ Completado | `███████████████████████████████` **100%** | Geral, Dencel, Karolayn |
| **Aprobación** (PRF-APR) | ✅ Completado | `███████████████████████████████` **100%** | Dencel, Karolayn |
| **Administración** (PRF-ADM) | ✅ Completado | `███████████████████████████████` **100%** | Sebastián (Andrade) |
| **Auditoría** (PRF-AUD) | ✅ Completado | `███████████████████████████████` **100%** | Jose |

### Funcionalidades Implementadas

#### Módulo Colaborador
- Dashboard con saldo disponible, días en proceso y días consumidos
- Solicitud de vacaciones con calendario interactivo y cálculo automático de días hábiles
- Mis Solicitudes - Historial completo con filtros por estado y búsqueda
- Cancelación de solicitudes pendientes o aprobadas

#### Módulo Jefatura/Aprobación
- Bandeja de entrada con solicitudes pendientes
- Aprobación y rechazo de solicitudes
- Historial de solicitudes procesadas
- Métricas del equipo

#### Módulo Administración RRHH
- Gestión de usuarios (crear, modificar)
- Ajuste de saldo vacacional
- Configuración de políticas
- Reportes y logs de auditoría

#### Módulo Autenticación
- Login con tokens de sesión (8h de expiry)
- Logout con invalidación de token
- Recuperación de contraseña por email
- Bloqueo de cuenta tras 3 intentos fallidos
- Auditoría de intentos de acceso

#### Módulo Auditoría
- Registro de todas las acciones del sistema
- Logueo de login/logout/aprobación/rechazo/movimientos
- Dashboard con métricas, filtros y paginación

#### Características Técnicas
- Calendario interactivo con feriados institucionales
- Cálculo inteligente de días hábiles (excluye fines de semana y feriados)
- Diseño Glassmorphism responsive
- Redirección por rol al iniciar sesión

---

## 🚀 Requisitos Previos

- **Node.js** 18.x o superior
- **SQL Server** 2016 o superior
- **npm** incluido con Node.js

---

## ⚡ Instalación Rápida

```bash
# Clonar el repositorio
git clone https://github.com/josehart280/Proyecto_Fundametos_Admin.git
cd Proyecto_Fundametos_Admin

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de SQL Server

# Iniciar el servidor
npm start
```

El servidor iniciará en `http://localhost:3001`

---

## Configuración

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
DB_HOST=localhost
DB_USER=sa
DB_PASSWORD=tu_contraseña
DB_NAME=VacacionesCUCR
PORT=3001
JWT_SECRET=tu_clave_secreta
```

> **IMPORTANTE**: El archivo `.env` contiene credenciales sensibles y está incluido en `.gitignore`. Nunca lo subas al repositorio.

---

## 📁 Estructura del Proyecto

```
Proyecto_Fundametos_Admin/
├── public/
│   ├── css/
│   │   ├── styles.css           # Estilos base
│   │   └── global.css           # Sistema de diseño Glassmorphism
│   ├── js/
│   │   ├── main.js              # JavaScript base
│   │   ├── dashboard.js         # Lógica del dashboard
│   │   ├── solicitud.js         # Lógica del formulario
│   │   ├── mis_solicitudes.js   # Lógica del historial
│   │   ├── auditoria.js        # Dashboard de auditoría
│   │   └── rrhh_admin.js       # Módulo RRHH
│   ├── index.html               # Landing page
│   ├── login.html               # Pantalla de inicio de sesión
│   ├── dashboard.html           # Dashboard del colaborador
│   ├── solicitud.html           # Formulario de solicitud
│   ├── mis_solicitudes.html     # Historial de solicitudes
│   ├── jefatura_aprobacion.html # Bandeja de aprobación
│   └── rrhh_admin.html         # Dashboard RRHH
├── db.js                       # Módulo de conexión SQL Server
├── server.js                   # Servidor Node.js + APIs REST
├── auth.js                     # Módulo de autenticación
├── mailer.js                   # Wrapper nodemailer
├── package.json                # Dependencias y scripts
└── README.md                   # Este archivo
```

---

## Rutas de la Aplicación

### Frontend

| Ruta | Descripción |
|------|-------------|
| `/index.html` | Landing page del proyecto |
| `/login.html` | Pantalla de inicio de sesión |
| `/dashboard.html` | Dashboard del colaborador |
| `/solicitud.html` | Formulario de nueva solicitud |
| `/mis_solicitudes.html` | Historial de solicitudes |
| `/jefatura_aprobacion.html` | Bandeja de aprobación (Jefatura) |
| `/rrhh_admin.html` | Dashboard de administración RRHH |

### APIs REST

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/test` | Test de conexión a SQL Server |
| GET | `/api/usuarios` | Lista usuarios (TOP 100) |
| GET | `/api/dashboard` | Datos del colaborador + solicitudes + feriados |
| POST | `/api/solicitudes` | Crear solicitud de vacaciones |
| POST | `/api/cancelar` | Cancelar solicitud |
| POST | `/api/login` | Inicio de sesión |
| POST | `/api/logout` | Cierre de sesión |
| POST | `/api/solicitar-recuperacion` | Solicitar recuperación de contraseña |
| POST | `/api/cambiar-password` | Cambiar contraseña con token |
| GET | `/api/validar-sesion` | Validar sesión activa |
| GET | `/api/auditar/intentos-acceso` | Historial de intentos de acceso |
| GET | `/api/rrhh/estadisticas` | Estadísticas RRHH |
| GET | `/api/rrhh/usuarios` | Listado de usuarios |
| POST | `/api/rrhh/crear-usuario` | Crear usuario |
| POST | `/api/rrhh/modificar-usuario` | Modificar usuario |
| POST | `/api/rrhh/ajuste-saldo` | Ajuste de saldo |
| GET | `/api/rrhh/politicas` | Ver políticas |
| POST | `/api/rrhh/politicas` | Modificar políticas |
| GET | `/api/rrhh/reporte` | Reportes |
| GET | `/api/rrhh/log` | Log de auditoría admin |

---

## 🗄️ Base de Datos

El sistema utiliza SQL Server con las siguientes tablas principales:

- **Personal** - Información de empleados
- **Saldos_Vacacionales** - Saldo disponible por empleado
- **Nombramientos** - Roles y puestos de cada empleado
- **Solicitudes_Vacaciones** - Solicitudes de vacaciones
- **Movimientos_Saldo** - Historial de movimientos contables
- **Feriados** - Días feriados institucionales
- **Sesiones** - Sesiones activas de usuarios
- **Recuperacion_Password** - Tokens de recuperación
- **Intentos_Acceso** - Auditoría de accesos
- **Configuracion_Politicas** - Configuración de políticas RRHH
- **Log_Auditoria_Admin** - Log de acciones administrativas

---

## 👥 Equipo de Desarrollo

| Desarrollador | Módulo |
|---------------|--------|
| Geral Pacheco | Dashboard, Solicitud, CSS |
| Dencel Rodriguez | Mis Solicitudes, APIs, Merge |
| Karolayn Ortega | Cancelación, Jefatura |
| Josué Hernández | Login, Logout, Auth |
| Sebastián Andrade | Administración RRHH |
| Jose Porras | Auditoría |

---

## 📚 Documentación Adicional

- **[CLAUDE.md](CLAUDE.md)** - Guía completa para desarrolladores
- **Carpeta `../requerimientos/`** - Especificaciones de requerimientos

---

## 👤 Autor Principal

**José Alonso Porras Ramírez**

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?logo=linkedin&logoColor=white)](https://linkedin.com/in/jose-porras-039202326)
[![Portfolio](https://img.shields.io/badge/Portfolio-000000?logo=vercel&logoColor=white)](https://jose-porras-portfolio.vercel.app)
[![Email](https://img.shields.io/badge/Email-D14836?logo=gmail&logoColor=white)](mailto:josealonso.0186@gmail.com)

---

**Colegio Universitario de Cartago**
**Carrera de Administración de Sistemas Informáticos**

---

**Última actualización**: Abril 2026
**Versión**: 1.0.0
**Estado**: Completado
