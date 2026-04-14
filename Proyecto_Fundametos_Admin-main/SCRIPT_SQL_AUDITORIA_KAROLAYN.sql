-- ================================================================
-- SCRIPT MINIMO - HU PRF-AUD-02 (Registro de Acciones)
-- Sistema de Vacaciones CUCR
-- Crea solo lo necesario para auditoria transversal e inmutable.
-- ================================================================

SET NOCOUNT ON;

-- Prerrequisito minimo disponible: tabla Usuarios con id_Usuario.
IF OBJECT_ID('ProyectoAdmin.Usuarios', 'U') IS NULL
BEGIN
  RAISERROR('No existe la tabla ProyectoAdmin.Usuarios. Este script requiere Usuarios(id_Usuario).', 16, 1);
  RETURN;
END

IF COL_LENGTH('ProyectoAdmin.Usuarios', 'id_Usuario') IS NULL
BEGIN
  RAISERROR('No existe la columna ProyectoAdmin.Usuarios.id_Usuario.', 16, 1);
  RETURN;
END

-- 1) Tabla de auditoria de acciones (log historico)
IF OBJECT_ID('ProyectoAdmin.Auditoria_Acciones', 'U') IS NULL
BEGIN
  CREATE TABLE ProyectoAdmin.Auditoria_Acciones (
    id_Auditoria BIGINT IDENTITY(1,1) PRIMARY KEY,
    id_Evento UNIQUEIDENTIFIER NOT NULL UNIQUE,
    Fecha_Evento DATETIME2(0) NOT NULL,
    usuario_id INT NOT NULL,
    tipo_accion VARCHAR(20) NOT NULL,
    entidad_afectada VARCHAR(100) NOT NULL,
    registro_id VARCHAR(100) NOT NULL,
    ip_origen VARCHAR(60) NULL,
    detalle_json NVARCHAR(MAX) NULL,
    Fecha_Registro DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_Auditoria_Usuario
      FOREIGN KEY (usuario_id) REFERENCES ProyectoAdmin.Usuarios(id_Usuario),
    CONSTRAINT CHK_Auditoria_TipoAccion
      CHECK (tipo_accion IN ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'APPROVE', 'REJECT'))
  );

  PRINT 'OK: Tabla ProyectoAdmin.Auditoria_Acciones creada';
END
ELSE
  PRINT 'WARN: Tabla ProyectoAdmin.Auditoria_Acciones ya existe';

-- 2) Indices de trazabilidad
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'idx_Auditoria_Usuario_Fecha'
    AND object_id = OBJECT_ID('ProyectoAdmin.Auditoria_Acciones')
)
  CREATE INDEX idx_Auditoria_Usuario_Fecha
    ON ProyectoAdmin.Auditoria_Acciones(usuario_id, Fecha_Evento DESC);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'idx_Auditoria_Entidad_Registro'
    AND object_id = OBJECT_ID('ProyectoAdmin.Auditoria_Acciones')
)
  CREATE INDEX idx_Auditoria_Entidad_Registro
    ON ProyectoAdmin.Auditoria_Acciones(entidad_afectada, registro_id);

-- 3) Inmutabilidad tecnica: bloqueo de UPDATE/DELETE
IF OBJECT_ID('ProyectoAdmin.trg_Auditoria_Acciones_Inmutable', 'TR') IS NULL
BEGIN
  EXEC ('
    CREATE TRIGGER ProyectoAdmin.trg_Auditoria_Acciones_Inmutable
    ON ProyectoAdmin.Auditoria_Acciones
    INSTEAD OF UPDATE, DELETE
    AS
    BEGIN
      SET NOCOUNT ON;
      RAISERROR(''Auditoria_Acciones es inmutable: no se permiten UPDATE ni DELETE.'', 16, 1);
      ROLLBACK TRANSACTION;
    END
  ');

  PRINT 'OK: Trigger de inmutabilidad creado';
END
ELSE
  PRINT 'WARN: Trigger de inmutabilidad ya existe';

-- 4) Permisos minimos de tabla (solo INSERT y SELECT para app)
BEGIN TRY
  IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'rol_app_auditoria')
  BEGIN
    CREATE ROLE rol_app_auditoria;
    PRINT 'OK: Rol rol_app_auditoria creado';
  END
  ELSE
    PRINT 'WARN: Rol rol_app_auditoria ya existe';
END TRY
BEGIN CATCH
  PRINT 'WARN: No fue posible crear rol_app_auditoria (sin permisos). Detalle: ' + ERROR_MESSAGE();
END CATCH;

BEGIN TRY
  IF EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'rol_app_auditoria')
  BEGIN
    GRANT SELECT, INSERT ON ProyectoAdmin.Auditoria_Acciones TO rol_app_auditoria;
    DENY UPDATE, DELETE ON ProyectoAdmin.Auditoria_Acciones TO rol_app_auditoria;
    PRINT 'OK: Permisos aplicados a rol_app_auditoria';
  END
  ELSE
    PRINT 'WARN: Se omitieron GRANT/DENY porque rol_app_auditoria no existe';
END TRY
BEGIN CATCH
  PRINT 'WARN: No fue posible aplicar GRANT/DENY (sin permisos). Detalle: ' + ERROR_MESSAGE();
END CATCH;

PRINT 'OK: PRF-AUD-02 aplicado (tabla, indices, inmutabilidad, permisos)';
