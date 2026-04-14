-- ================================================================================
-- SCRIPT SQL – MÓDULO DE ADMINISTRACIÓN RRHH (PRF-ADM-01 a PRF-ADM-04)
-- Sistema de Gestión de Vacaciones
-- Tablas: Configuracion_Politicas, Log_Auditoria_Admin, Movimientos_Saldo (ajuste)
-- ================================================================================

-- ================================================================================
-- TABLA 1: Configuracion_Politicas  (PRF-ADM-02)
-- Parámetros de negocio configurables por RRHH
-- ================================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Configuracion_Politicas')
BEGIN
  CREATE TABLE Configuracion_Politicas (
    id_Config                   INT          PRIMARY KEY IDENTITY(1,1),
    max_dias_consecutivos       INT          NOT NULL DEFAULT 15,
    min_dias_antiguedad         INT          NOT NULL DEFAULT 180,
    min_dias_entre_solicitudes  INT          NOT NULL DEFAULT 0,
    aviso_previo_dias           INT          NOT NULL DEFAULT 7,
    Fecha_Actualizacion         DATETIME     DEFAULT GETDATE(),
    id_Usuario_Modifico         INT,
    FOREIGN KEY (id_Usuario_Modifico) REFERENCES Usuarios(id_Usuario)
  )

  -- Fila inicial con valores por defecto
  INSERT INTO Configuracion_Politicas (
    max_dias_consecutivos, min_dias_antiguedad,
    min_dias_entre_solicitudes, aviso_previo_dias
  )
  VALUES (15, 180, 0, 7)

  PRINT '✅ Tabla Configuracion_Politicas creada (PRF-ADM-02)'
END
ELSE
  PRINT '⚠️  Tabla Configuracion_Politicas ya existe'

-- ================================================================================
-- TABLA 2: Log_Auditoria_Admin  (PRF-ADM-03)
-- Registro inmutable de acciones administrativas
-- ================================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Log_Auditoria_Admin')
BEGIN
  CREATE TABLE Log_Auditoria_Admin (
    id_Log          INT           PRIMARY KEY IDENTITY(1,1),
    id_Usuario      INT,
    Fecha           DATETIME      DEFAULT GETDATE(),
    Accion          VARCHAR(100)  NOT NULL,
    Detalle         VARCHAR(1000),
    FOREIGN KEY (id_Usuario) REFERENCES Usuarios(id_Usuario)
  )
  PRINT '✅ Tabla Log_Auditoria_Admin creada (PRF-ADM-03)'
END
ELSE
  PRINT '⚠️  Tabla Log_Auditoria_Admin ya existe'

-- ================================================================================
-- TABLA 3: Movimientos_Saldo  (PRF-ADM-04)
-- Historial de ajustes manuales de saldo de vacaciones
-- Nota: puede ya existir si el script anterior la creó como parte de rechazos.
-- ================================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Movimientos_Saldo')
BEGIN
  CREATE TABLE Movimientos_Saldo (
    id_Movimiento     INT           PRIMARY KEY IDENTITY(1,1),
    id_Personal       INT           NOT NULL,
    id_Usuario_RRHH   INT,
    Tipo_Movimiento   VARCHAR(20)   NOT NULL,  -- 'Incremento', 'Descuento', 'Suma'
    Dias              DECIMAL(5,1)  NOT NULL,
    Saldo_Anterior    DECIMAL(7,1),
    Saldo_Nuevo       DECIMAL(7,1),
    Motivo            VARCHAR(500)  NOT NULL,
    Fecha             DATETIME      DEFAULT GETDATE(),
    FOREIGN KEY (id_Personal)     REFERENCES Personal(id_Personal),
    FOREIGN KEY (id_Usuario_RRHH) REFERENCES Usuarios(id_Usuario)
  )
  PRINT '✅ Tabla Movimientos_Saldo creada (PRF-ADM-04)'
END
ELSE
BEGIN
  -- Agregar columnas nuevas si ya existe la tabla sin ellas
  IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Movimientos_Saldo' AND COLUMN_NAME='id_Usuario_RRHH')
    ALTER TABLE Movimientos_Saldo ADD id_Usuario_RRHH INT

  IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Movimientos_Saldo' AND COLUMN_NAME='Saldo_Anterior')
    ALTER TABLE Movimientos_Saldo ADD Saldo_Anterior DECIMAL(7,1)

  IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Movimientos_Saldo' AND COLUMN_NAME='Saldo_Nuevo')
    ALTER TABLE Movimientos_Saldo ADD Saldo_Nuevo DECIMAL(7,1)

  PRINT '⚠️  Tabla Movimientos_Saldo ya existía – columnas verificadas/agregadas'
END

-- ================================================================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ================================================================================
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_Log_Auditoria_Fecha' AND object_id=OBJECT_ID('Log_Auditoria_Admin'))
  CREATE INDEX idx_Log_Auditoria_Fecha ON Log_Auditoria_Admin(Fecha DESC)

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_Movimientos_Saldo_Personal' AND object_id=OBJECT_ID('Movimientos_Saldo'))
  CREATE INDEX idx_Movimientos_Saldo_Personal ON Movimientos_Saldo(id_Personal, Fecha DESC)

PRINT '✅ Índices creados'

-- ================================================================================
-- RESUMEN FINAL
-- ================================================================================
PRINT ''
PRINT '╔═══════════════════════════════════════════════════════════════════╗'
PRINT '║        ✅ SCRIPT MÓDULO ADMINISTRACIÓN COMPLETADO                ║'
PRINT '╠═══════════════════════════════════════════════════════════════════╣'
PRINT '║ TABLAS CREADAS/VERIFICADAS:                                       ║'
PRINT '║   • Configuracion_Politicas  (PRF-ADM-02)                        ║'
PRINT '║   • Log_Auditoria_Admin      (PRF-ADM-03)                        ║'
PRINT '║   • Movimientos_Saldo        (PRF-ADM-04)                        ║'
PRINT '╠═══════════════════════════════════════════════════════════════════╣'
PRINT '║ MÓDULOS HABILITADOS:                                              ║'
PRINT '║   PRF-ADM-01  Gestión de Usuarios                                ║'
PRINT '║   PRF-ADM-02  Configuración de Políticas                         ║'
PRINT '║   PRF-ADM-03  Reportes y Log de Auditoría                        ║'
PRINT '║   PRF-ADM-04  Ajuste Manual de Saldo con Auditoría               ║'
PRINT '╚═══════════════════════════════════════════════════════════════════╝'
