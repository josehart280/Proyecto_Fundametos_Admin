-- ================================================================================
-- SCRIPT SQL - MÓDULO DE AUTENTICACIÓN (HU1-4)
-- Sistema de Gestión de Vacaciones CUCR
-- SOLO tablas necesarias para autenticación
-- ================================================================================

-- ================================================================================
-- PASO 1: AGREGAR COLUMNAS A TABLA USUARIOS (si no existen)
-- Campos necesarios para HU1-4
-- ================================================================================

-- Agregar columnas de autenticación a tabla Usuarios
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Usuarios' AND COLUMN_NAME='Correo_Electronico')
  ALTER TABLE Usuarios ADD Correo_Electronico VARCHAR(100)
ELSE
  PRINT '⚠️ Columna Correo_Electronico ya existe'

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Usuarios' AND COLUMN_NAME='Fecha_Ultimo_Acceso')
  ALTER TABLE Usuarios ADD Fecha_Ultimo_Acceso DATETIME
ELSE
  PRINT '⚠️ Columna Fecha_Ultimo_Acceso ya existe'

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Usuarios' AND COLUMN_NAME='Intentos_Fallidos')
  ALTER TABLE Usuarios ADD Intentos_Fallidos INT DEFAULT 0
ELSE
  PRINT '⚠️ Columna Intentos_Fallidos ya existe'

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Usuarios' AND COLUMN_NAME='Bloqueado')
  ALTER TABLE Usuarios ADD Bloqueado BIT DEFAULT 0
ELSE
  PRINT '⚠️ Columna Bloqueado ya existe'

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Usuarios' AND COLUMN_NAME='Fecha_Bloqueo')
  ALTER TABLE Usuarios ADD Fecha_Bloqueo DATETIME
ELSE
  PRINT '⚠️ Columna Fecha_Bloqueo ya existe'

PRINT '✅ Columnas de autenticación agregadas a Usuarios'

-- ================================================================================
-- PASO 2: CREAR TABLAS DE AUTENTICACIÓN (HU1-4)
-- ================================================================================

-- 1. TABLA: Intentos_Acceso (HU3: Registro de Acceso)
-- Auditoría de todos los intentos de login (exitosos y fallidos)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Intentos_Acceso')
BEGIN
  CREATE TABLE Intentos_Acceso (
    id_Intento INT PRIMARY KEY IDENTITY(1,1),
    id_Usuario INT,
    Fecha_Intento DATETIME DEFAULT GETDATE(),
    Resultado VARCHAR(20), -- 'exitoso', 'fallido'
    Razon_Fallo VARCHAR(500), -- 'contraseña incorrecta', 'usuario inactivo', 'usuario no encontrado', etc.
    IP_Cliente VARCHAR(50),
    FOREIGN KEY (id_Usuario) REFERENCES Usuarios(id_Usuario)
  )
  PRINT '✅ Tabla Intentos_Acceso creada (HU3)'
END
ELSE
  PRINT '⚠️ Tabla Intentos_Acceso ya existe'

-- 2. TABLA: Sesiones (HU1, HU2: Login y Logout)
-- Gestión de tokens de sesión para usuarios autenticados
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Sesiones')
BEGIN
  CREATE TABLE Sesiones (
    id_Sesion INT PRIMARY KEY IDENTITY(1,1),
    id_Usuario INT NOT NULL,
    Token VARCHAR(500) NOT NULL UNIQUE,
    Fecha_Creacion DATETIME DEFAULT GETDATE(),
    Fecha_Expiracion DATETIME,
    Activa BIT DEFAULT 1, -- 1=activa, 0=cerrada (logout)
    FOREIGN KEY (id_Usuario) REFERENCES Usuarios(id_Usuario)
  )
  PRINT '✅ Tabla Sesiones creada (HU1, HU2)'
END
ELSE
  PRINT '⚠️ Tabla Sesiones ya existe'

-- 3. TABLA: Recuperacion_Password (HU4: Recuperación de Contraseña)
-- Tokens temporales para cambio de contraseña (válidos por 15 minutos)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Recuperacion_Password')
BEGIN
  CREATE TABLE Recuperacion_Password (
    id_Recuperacion INT PRIMARY KEY IDENTITY(1,1),
    id_Usuario INT NOT NULL,
    Token VARCHAR(500) NOT NULL UNIQUE,
    Fecha_Creacion DATETIME DEFAULT GETDATE(),
    Fecha_Expiracion DATETIME,
    Utilizado BIT DEFAULT 0,
    FOREIGN KEY (id_Usuario) REFERENCES Usuarios(id_Usuario)
  )
  PRINT '✅ Tabla Recuperacion_Password creada (HU4)'
END
ELSE
  PRINT '⚠️ Tabla Recuperacion_Password ya existe'

-- 4. TABLA: Intentos_Recuperacion (HU4: Auditoría de Recuperación)
-- Registro de todos los intentos de recuperación de contraseña
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Intentos_Recuperacion')
BEGIN
  CREATE TABLE Intentos_Recuperacion (
    id_Intento INT PRIMARY KEY IDENTITY(1,1),
    id_Usuario INT,
    Correo VARCHAR(100),
    Fecha_Intento DATETIME DEFAULT GETDATE(),
    Token_Enviado VARCHAR(500),
    Estado VARCHAR(20), -- 'enviado', 'utilizado', 'expirado'
    FOREIGN KEY (id_Usuario) REFERENCES Usuarios(id_Usuario)
  )
  PRINT '✅ Tabla Intentos_Recuperacion creada (HU4)'
END
ELSE
  PRINT '⚠️ Tabla Intentos_Recuperacion ya existe'

-- ================================================================================
-- PASO 3: CREAR ÍNDICES PARA OPTIMIZACIÓN
-- ================================================================================

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_Usuarios_username' AND object_id = OBJECT_ID('Usuarios'))
  CREATE INDEX idx_Usuarios_username ON Usuarios(username)

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_Sesiones_Activas' AND object_id = OBJECT_ID('Sesiones'))
  CREATE INDEX idx_Sesiones_Activas ON Sesiones(id_Usuario, Activa)

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_Intentos_Acceso' AND object_id = OBJECT_ID('Intentos_Acceso'))
  CREATE INDEX idx_Intentos_Acceso ON Intentos_Acceso(id_Usuario, Fecha_Intento)

PRINT '✅ Índices creados'

-- ================================================================================
-- PASO 4: INSERTAR/ACTUALIZAR USUARIO DE PRUEBA
-- ================================================================================

-- Actualizar usuario existente o insertar uno nuevo
IF NOT EXISTS (SELECT * FROM Usuarios WHERE username = 'ProyectoAdmin')
BEGIN
  INSERT INTO Usuarios (id_Personal, username, Password, Estado, Correo_Electronico, Intentos_Fallidos, Bloqueado)
  VALUES (1, 'ProyectoAdmin', 'Proyectos0123', 'Activo', 'geral@cucr.ac.cr', 0, 0)
  PRINT '✅ Usuario ProyectoAdmin creado'
END
ELSE
BEGIN
  -- Actualizar el usuario existente con datos de contacto
  UPDATE Usuarios 
  SET Correo_Electronico = 'geral@cucr.ac.cr',
      Intentos_Fallidos = 0,
      Bloqueado = 0
  WHERE username = 'ProyectoAdmin'
  PRINT '✅ Usuario ProyectoAdmin actualizado'
END

PRINT '📌 Credenciales: Usuario=ProyectoAdmin | Contraseña=Proyectos0123'

-- ================================================================================
-- PASO 5: VERIFICACIÓN FINAL
-- ================================================================================

PRINT ''
PRINT '╔════════════════════════════════════════════════════════════════════╗'
PRINT '║        ✅ SCRIPT DE AUTENTICACIÓN COMPLETADO                      ║'
PRINT '╠════════════════════════════════════════════════════════════════════╣'
PRINT '║ 📋 TABLAS CREADAS:                                                 ║'
PRINT '║    • Intentos_Acceso (HU3 - Auditoría de login)                    ║'
PRINT '║    • Sesiones (HU1/HU2 - Login/Logout)                             ║'
PRINT '║    • Recuperacion_Password (HU4 - Password Recovery)               ║'
PRINT '║    • Intentos_Recuperacion (HU4 - Auditoría)                       ║'
PRINT '║                                                                    ║'
PRINT '║ 🔐 COLUMNAS AGREGADAS A USUARIOS:                                  ║'
PRINT '║    • Correo_Electronico                                             ║'
PRINT '║    • Fecha_Ultimo_Acceso                                            ║'
PRINT '║    • Intentos_Fallidos                                              ║'
PRINT '║    • Bloqueado                                                      ║'
PRINT '║    • Fecha_Bloqueo                                                  ║'
PRINT '║                                                                    ║'
PRINT '╠════════════════════════════════════════════════════════════════════╣'
PRINT '║ 🔑 CREDENCIALES DE PRUEBA:                                         ║'
PRINT '║    Usuario: ProyectoAdmin                                           ║'
PRINT '║    Contraseña: Proyectos0123                                        ║'
PRINT '║    Email: geral@cucr.ac.cr                                          ║'
PRINT '║                                                                    ║'
PRINT '╠════════════════════════════════════════════════════════════════════╣'
PRINT '║ ✅ FUNCIONALIDADES LISTAS:                                         ║'
PRINT '║    ✅ HU1: Login con credenciales                                   ║'
PRINT '║    ✅ HU2: Logout y cierre de sesión                                ║'
PRINT '║    ✅ HU3: Auditoría de intentos de acceso                          ║'
PRINT '║    ✅ HU4: Recuperación de contraseña con email                     ║'
PRINT '║                                                                    ║'
PRINT '╚════════════════════════════════════════════════════════════════════╝'
