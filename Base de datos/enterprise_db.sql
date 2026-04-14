-- Limpieza Profunda de Tablas
WHILE(EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_TYPE = 'FOREIGN KEY')) 
BEGIN
    DECLARE @sql NVARCHAR(2000)
    SELECT TOP 1 @sql = 'ALTER TABLE [' + TABLE_SCHEMA + '].[' + TABLE_NAME + '] DROP CONSTRAINT [' + CONSTRAINT_NAME + ']'
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_TYPE = 'FOREIGN KEY'
    EXEC(@sql)
END

WHILE(EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE')) 
BEGIN
    DECLARE @sql2 NVARCHAR(2000)
    SELECT TOP 1 @sql2 = 'DROP TABLE [' + TABLE_SCHEMA + '].[' + TABLE_NAME + ']'
    FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'
    EXEC(@sql2)
END

-- Esquema Multi-Nombramiento (Enterprise Grade)
CREATE TABLE Roles (
    id_Rol INT IDENTITY(1,1) PRIMARY KEY,
    Nombre VARCHAR(50) NOT NULL
);

CREATE TABLE Carreras (
    id_Carrera INT IDENTITY(1,1) PRIMARY KEY,
    Nombre VARCHAR(100) NOT NULL
);

-- BIOLÓGICO (Un humano)
CREATE TABLE Personal (
    id_Personal INT IDENTITY(1,1) PRIMARY KEY,
    Cedula VARCHAR(20) NOT NULL UNIQUE,
    Nombre VARCHAR(100) NOT NULL,
    Apellido VARCHAR(100) NOT NULL,
    Correo VARCHAR(100) NOT NULL UNIQUE,
    Estado VARCHAR(20) DEFAULT 'Activo'
);

-- MÚLTIPLES PUESTOS / CONTRATOS (Magia de Múltiples Roles)
CREATE TABLE Nombramientos (
    id_Nombramiento INT IDENTITY(1,1) PRIMARY KEY,
    id_Personal INT FOREIGN KEY REFERENCES Personal(id_Personal),
    id_Rol INT FOREIGN KEY REFERENCES Roles(id_Rol),
    id_Carrera INT NULL FOREIGN KEY REFERENCES Carreras(id_Carrera),
    Tipo_Nombramiento VARCHAR(50) NOT NULL, -- Ej: Propiedad, Interino
    Fecha_Ingreso DATE NOT NULL,
    Fraccion_Tiempo DECIMAL(3,2) DEFAULT 1.0, -- Ej: 0.5 (Medio Tiempo), 1.0 (Completo)
    Estado VARCHAR(20) DEFAULT 'Activo'
);

-- AUTENTICACIÓN
CREATE TABLE Usuarios (
    id_Usuario INT IDENTITY(1,1) PRIMARY KEY,
    id_Personal INT FOREIGN KEY REFERENCES Personal(id_Personal),
    username VARCHAR(100) NOT NULL UNIQUE,
    Password VARCHAR(255) NOT NULL,
    Estado VARCHAR(20) DEFAULT 'Activo'
);

-- SALDO CONSOLIDADO AL HUMANO (No al rol)
CREATE TABLE Saldos_Vacacionales (
    id_Saldo INT IDENTITY(1,1) PRIMARY KEY,
    id_Personal INT FOREIGN KEY REFERENCES Personal(id_Personal),
    dias_asignados DECIMAL(5,2) DEFAULT 0,
    saldo_Disponible DECIMAL(5,2) DEFAULT 0
);

-- SOLICITUDES ENLAZADAS AL HUMANO
CREATE TABLE Solicitudes_Vacaciones (
    id_Solicitud INT IDENTITY(1,1) PRIMARY KEY,
    id_Personal INT FOREIGN KEY REFERENCES Personal(id_Personal),
    fecha_Inicio DATE NOT NULL,
    fecha_Fin DATE NOT NULL,
    dias_Solicitados INT NOT NULL,
    Motivo VARCHAR(255),
    Estado VARCHAR(50) DEFAULT 'Pendiente',
    fecha_Creacion DATETIME DEFAULT GETDATE()
);

CREATE TABLE Feriados (
    id_feriado INT IDENTITY(1,1) PRIMARY KEY,
    fecha DATE NOT NULL,
    descripcion VARCHAR(150) NOT NULL
);

-- KARDEX DE DEBE/HABER
CREATE TABLE Movimientos_Saldo (
    id_Movimiento INT IDENTITY(1,1) PRIMARY KEY,
    id_Personal INT FOREIGN KEY REFERENCES Personal(id_Personal),
    Fecha DATETIME DEFAULT GETDATE(),
    Tipo_Movimiento VARCHAR(10) CHECK (Tipo_Movimiento IN ('Suma', 'Resta')),
    Dias DECIMAL(5,2) NOT NULL,
    Motivo VARCHAR(255) NOT NULL
);

-- ===========================
-- ASIGNACIÓN DE DATOS (MOCKUP MULTI-ROL)
-- ===========================
INSERT INTO Roles (Nombre) VALUES ('Colaborador General'), ('Docente Magistral'), ('Director Administrativo');
INSERT INTO Carreras (Nombre) VALUES ('Tecnología de Información'), ('Gestión Empresarial');

-- Humano Físico
INSERT INTO Personal (Cedula, Nombre, Apellido, Correo)
VALUES ('1-2345-6789', 'Geral', 'Pacheco', 'geral@universidad.com');

-- Nombramiento 1: Director Académico (Propiedad a tiempo completo)
INSERT INTO Nombramientos (id_Personal, id_Rol, Tipo_Nombramiento, Fecha_Ingreso, Fraccion_Tiempo)
VALUES (1, 3, 'Propiedad', '2016-08-01', 1.0);

-- Nombramiento 2: Docente de TI en las noches (Interino a cuarto de tiempo)
INSERT INTO Nombramientos (id_Personal, id_Rol, id_Carrera, Tipo_Nombramiento, Fecha_Ingreso, Fraccion_Tiempo)
VALUES (1, 2, 1, 'Interino', '2024-02-01', 0.25);

INSERT INTO Usuarios (id_Personal, username, Password) VALUES (1, 'geralp', 'hash123');

-- Saldo Centralizado de Juan
INSERT INTO Saldos_Vacacionales (id_Personal, dias_asignados, saldo_Disponible) VALUES (1, 26.0, 15.0);

INSERT INTO Movimientos_Saldo (id_Personal, Tipo_Movimiento, Dias, Motivo)
VALUES (1, 'Suma', 15.0, 'Balance Unificado de Cargos Académicos');

-- Días Feriados 2026 Clásicos
INSERT INTO Feriados (fecha, descripcion) VALUES 
('2026-01-01', 'Año Nuevo'), ('2026-04-02', 'Jueves Santo'), ('2026-04-03', 'Viernes Santo'), 
('2026-04-11', 'Batalla de Rivas'), ('2026-05-01', 'Día del Trabajador'), ('2026-07-25', 'Anexión de Nicoya'), 
('2026-08-02', 'Virgen de los Ángeles'), ('2026-08-15', 'Día de la Madre'), ('2026-09-15', 'Independencia'), 
('2026-12-01', 'Abolición Ejército'), ('2026-12-25', 'Navidad');
