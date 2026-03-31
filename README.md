#  Sistema de Vacaciones CUC

**Sistema de Gestión de Vacaciones para el Colegio Universitario de Cartago (CUC)**

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![SQL Server](https://img.shields.io/badge/SQL%20Server-2016+-blue.svg)](https://www.microsoft.com/sql-server)
[![Estado](https://img.shields.io/badge/Estado-En%20Desarrollo-yellow.svg)]()
[![Glassmorphism](https://img.shields.io/badge/Diseño-Glassmorphism-purple.svg)]()

Proyecto estudiantil desarrollado para la asignatura de **Fundamentos de Administración de Proyectos** - Carrera de Administración de Sistemas Informáticos.

[📊 Progreso](#-progreso-del-proyecto) • [🚀 Instalación](#-instalación-rápida) • [📚 Documentación](#-documentación-adicional)

---

## Progreso del Proyecto

### Estado General: 🟢 Funcional (65%)

```
████████████████████████████░░░░░░░░░░░░░░░░░░░  65%
```

### Progreso por Módulos

| Módulo | Estado | Progreso | Responsable |
|--------|--------|----------|-------------|
| **🟢 Colaborador** | Funcional | `████████████████████████░░░░░` **95%** | Geral, Dencel, Karolayn |
| **🟢 Autenticación** | Funcional | `█████████████████████████░░░░░` **85%** | Josué, Geral |
| **🔴 Aprobación** | No iniciado | `░░░░░░░░░░░░░░░░░░░░░░░░░░░` **0%** | Dencel, Karolayn |
| **🔴 Administración** | No iniciado | `░░░░░░░░░░░░░░░░░░░░░░░░░░░` **0%** | Sebastián |
| **🟡 Auditoría** | Parcial | `████████░░░░░░░░░░░░░░░░░░░` **40%** | Jose |

### Detalle de Funcionalidades

#### ✅ Completadas
- [x] Dashboard con calendario interactivo
- [x] Solicitud de vacaciones con validaciones
- [x] Mis Solicitudes (historial con filtros)
- [x] Cancelación de solicitudes
- [x] APIs REST para gestión de vacaciones
- [x] Diseño Glassmorphism
- [x] Login y logout con tokens de sesión
- [x] Recuperación de contraseña por email
- [x] Auditoría de intentos de acceso

#### 🚧 En Desarrollo
- [ ] Auditoría completa de acciones

#### 🔴 Pendientes
- [ ] Corrección SQL Injection (CRÍTICO)
- [ ] Módulo de Aprobación (jefaturas)
- [ ] Módulo de Administración (RRHH)
- [ ] Reportes exportables
- [ ] Notificaciones por email

---

## Descripción del Proyecto

Sistema web para la gestión automatizada de solicitudes de vacaciones de colaboradores del CUCR. Permite a los empleados consultar su saldo disponible, realizar solicitudes de vacaciones, dar seguimiento a trámites, y a las jefaturas gestionar las aprobaciones.

### Funcionalidades Implementadas

#### Módulo Colaborador
- 📊 **Dashboard** - Visualización de saldo disponible, días en proceso y días consumidos
- 📝 **Solicitud de Vacaciones** - Formulario con calendario interactivo y cálculo automático de días hábiles
- 📋 **Mis Solicitudes** - Historial completo con filtros por estado, búsqueda y resumen estadístico
- ❌ **Cancelación** - Posibilidad de cancelar solicitudes pendientes o aprobadas (antes de la fecha inicio)

#### Características Técnicas
- 📅 **Calendario Interactivo** - Visualización de vacaciones programadas y feriados institucionales
- 🔒 **Cálculo Inteligente** - Excluye fines de semana y feriados del cómputo de días
- 📱 **Responsive** - Adaptable a dispositivos móviles y tablets

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

El servidor iniciará en `http://localhost:3001` (o el puerto configurado en .env)

---

## Configuración

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
# Configuración de Base de Datos
DB_HOST=localhost
DB_USER=sa
DB_PASSWORD=tu_contraseña
DB_NAME=VacacionesCUCR

# Configuración del Servidor
PORT=3001
JWT_SECRET=tu_clave_secreta_para_jwt
```

> **IMPORTANTE**: El archivo `.env` contiene credenciales sensibles y está incluido en `.gitignore`. Nunca lo suban al repositorio.

---

## 📚 Estructura del Proyecto

```
Proyecto_Fundametos_Admin/
├── 📁 .vscode/
│   └── launch.json              # Configuración VS Code
├── 📁 public/                   # Archivos estáticos (frontend)
│   ├── 📁 css/
│   │   ├── styles.css           # Estilos base
│   │   └── global.css           # Sistema de diseño Glassmorphism
│   ├── 📁 js/
│   │   ├── main.js              # JavaScript base
│   │   ├── dashboard.js         # Lógica del dashboard
│   │   ├── solicitud.js         # Lógica del formulario
│   │   └── mis_solicitudes.js   # Lógica del historial
│   ├── index.html               # Landing page
│   ├── dashboard.html           # Dashboard del colaborador
│   ├── solicitud.html           # Formulario de solicitud
│   ├── mis_solicitudes.html     # Historial de solicitudes
│   └── 404.html                 # Página de error
├── 📄 db.js                     # Módulo de conexión SQL Server
├── 📄 server.js                 # Servidor Node.js + APIs REST
├── 📄 package.json              # Dependencias y scripts
├── 📄 .env                      # Variables de entorno (no versionar)
├── 📄 .gitignore                # Archivos ignorados por Git
├── 📄 README.md                 # Este archivo
└── 📄 CLAUDE.md                 # Guía para desarrolladores (Claude Code)
```

---

## Rutas de la Aplicación

### Frontend

| Ruta | Descripción | Autor |
|------|-------------|-------|
| `/index.html` | Landing page del proyecto | - |
| `/dashboard.html` | Dashboard con saldo y calendario | Geral |
| `/solicitud.html` | Formulario de nueva solicitud | Geral |
| `/mis_solicitudes.html` | Historial con filtros y búsqueda | Dencel |

### APIs REST

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/test` | Test de conexión a SQL Server |
| GET | `/api/usuarios` | Lista usuarios (TOP 100) |
| GET | `/api/dashboard` | Datos del colaborador + solicitudes + feriados |
| POST | `/api/solicitudes` | Crear solicitud + bloquear saldo + registrar movimiento |
| POST | `/api/cancelar` | Cancelar solicitud + reembolsar saldo |

---

## 🗄️ Esquema de Base de Datos

El sistema utiliza las siguientes tablas en SQL Server:

```sql
-- Tablas de catálogos
Roles (id_Rol, Nombre)
Carreras (id_Carrera, Nombre)
Feriados (fecha, descripcion)

-- Tablas principales
Personal (id_Personal, Nombre, Apellido, Email, ...)
Saldos_Vacacionales (id_Personal, saldo_Disponible)
Nombramientos (id_Personal, id_Rol, id_Carrera, Tipo_Nombramiento, Fraccion_Tiempo)
Solicitudes_Vacaciones (
  id_Solicitud, id_Personal, fecha_Inicio, fecha_Fin,
  dias_Solicitados, Motivo, Estado
)
Movimientos_Saldo (id_Movimiento, id_Personal, Tipo_Movimiento, Dias, Motivo, Fecha_Registro)
```

---

## 👥 Equipo de Desarrollo y Contribuciones

### Contribuciones por Desarrollador (faltan pruebas documentadas)

| Desarrollador | Funcionalidades Entregadas | Estado |
|---------------|---------------------------|--------|
| **Geral Pacheco** | Dashboard + Solicitud + Diseño CSS | ✅ 3/3 Completado |
| **Dencel Rodriguez** | Mis Solicitudes + Backend APIs + Merge | ✅ 3/3 Completado |
| **Karolayn Ortega** | Cancelación de Solicitudes | ✅ 1/1 Completado |
| **Josué Hernández** | Login/Logout (pendiente) | 🔄 0/2 En Progreso |
| **Sebastian Andrade** | Administración (pendiente) | ⏳ 0/3 Por Iniciar |
| **Jose Porras** | Auditoría (parcial) | 🔄 1/2 En Progreso |

### 🏆 Tabla de Reconocimiento

```
┌─────────────────────────────────────────────────────────┐
│  🥇 Geral      ████████████████████████████████  100%   │
│     Dashboard + Solicitud + Diseño Glassmorphism        │
├─────────────────────────────────────────────────────────┤
│  🥇 Dencel     ████████████████████████████████  100% │
│     Mis Solicitudes + Backend + Integración             │
├─────────────────────────────────────────────────────────┤
│  🥉 Karolayn   ████████████████████░░░░░░░░░░░░   50% │
│     Cancelación ✅ | Calendario Equipo 🔄             │
└─────────────────────────────────────────────────────────┘
```

### 📋 Asignaciones Actuales

- **@Geral** → Autenticación (Login UI)
- **@Dencel** → Módulo Aprobación (Bandeja jefaturas)
- **@Karolayn** → Métricas del Equipo
- **@Josué** → Autenticación Backend (JWT)
- **@Sebastian** → Administración (CRUD usuarios)
- **@Jose** → Auditoría completa

---

## 📊 Estado Detallado del Proyecto

### Cobertura de Requerimientos Nivel 0

| Requerimiento | ID | Estado | Badge |
|---------------|-----|--------|-------|
| Módulo Colaborador | PRF-COL-00 | ![Done](https://img.shields.io/badge/✅-Completado-brightgreen) | 90% |
| Módulo Autenticación | PRF-AUT-00 | ![Done](https://img.shields.io/badge/🟡-Funcional-yellow) | 60% |
| Módulo Aprobación | PRF-APR-00 | ![Pending](https://img.shields.io/badge/🔴-No%20Iniciado-red) | 0% |
| Módulo Administración | PRF-ADM-00 | ![Pending](https://img.shields.io/badge/🔴-No%20Iniciado-red) | 0% |
| Módulo Auditoría | PRF-AUD-00 | ![Partial](https://img.shields.io/badge/🟡-Parcial-yellow) | 30% |

### Checklist de Funcionalidades

#### ✅ Completado (Sprint 1)
- [x] **Dashboard** - Visualización de saldo y calendario
- [x] **Solicitud** - Formulario con validaciones completas
- [x] **Mis Solicitudes** - Historial con filtros y búsqueda
- [x] **Cancelación** - Anulación con reembolso automático
- [x] **APIs REST** - Backend funcional (5 endpoints)
- [x] **Diseño UI** - Sistema Glassmorphism implementado

#### 🚧 En Desarrollo (Sprint 2)
- [ ] **Autenticación JWT** - Login con credenciales reales
- [ ] **Módulo Aprobación** - Bandeja de entrada jefaturas
- [ ] **Auditoría Completa** - Registro de todas las acciones

#### 🔴 Pendiente (Sprint 3+)
- [ ] **Administración** - CRUD usuarios (RRHH)
- [ ] **Reportes** - Exportación PDF/Excel
- [ ] **Notificaciones** - Alertas por email
- [ ] **Recuperación** - Reset de contraseña
- [ ] Reportes exportables (PDF/Excel)

### 🔴 Pendiente
- [ ] Corrección de SQL Injection en APIs
- [ ] Implementación de JWT para autenticación
- [ ] Módulo de Aprobación (bandeja de entrada jefaturas)
- [ ] Módulo de Administración (gestión de usuarios)
- [ ] Notificaciones por correo electrónico
- [ ] Recuperación de contraseña

---

## 🔒 Notas de Seguridad

> **IMPORTANTE**: Este sistema está en desarrollo y tiene los siguientes problemas de seguridad conocidos:

1. **Autenticación**: Actualmente todas las operaciones usan `id_Personal = 1` hardcodeado.
2. **Validaciones**: Algunas validaciones solo existen en el frontend.

**Ver archivo `CLAUDE.md` para guía de corrección de estos problemas.**

---

## Guía de Contribución

```bash
# Crear rama para nueva funcionalidad
git checkout -b feature/nueva-funcionalidad

# Hacer cambios y commit
git add .
git commit -m "feat: descripción de la funcionalidad"

# Push y crear PR
git push origin feature/nueva-funcionalidad
```

### Convenciones de Commits

- `feat:` Nueva funcionalidad
- `fix:` Corrección de bug
- `docs:` Cambios en documentación
- `style:` Cambios de formato (espacios, comas, etc)
- `refactor:` Refactorización de código
- `test:` Adición o corrección de tests

---

## 📄 Documentación Adicional

- 📘 **[CLAUDE.md](CLAUDE.md)** - Guía completa para desarrolladores (Claude Code)
- 📊 **Requerimientos** - Ver carpeta `../requerimientos/`
- 🔍 **Análisis Técnico** - Ver `../ANALISIS_SISTEMA_VACACIONES.md`

---

## 📞 Soporte

Para reportar bugs o solicitar funcionalidades, contactar al equipo de desarrollo.

---

## 👤 Autor Principal

**José Alonso Porras Ramírez** 

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?logo=linkedin&logoColor=white)](https://linkedin.com/in/jose-porras-039202326)
[![Portfolio](https://img.shields.io/badge/Portfolio-000000?logo=vercel&logoColor=white)](https://jose-porras-portfolio.vercel.app)
[![Email](https://img.shields.io/badge/Email-D14836?logo=gmail&logoColor=white)](mailto:josealonso.0186@gmail.com)

📧 josealonso.0186@gmail.com

---

## 

Proyecto académico - Colegio Universitario de Cartago (CUCR)

---

**Última actualización**: Marzo 2026
**Versión**: 1.0.0
**Estado**: En desarrollo activo

---

<p align="center">
  <strong>Colegio Universitario de Cartago</strong><br>
  Carrera de Administración de Sistemas Informáticos
</p>
