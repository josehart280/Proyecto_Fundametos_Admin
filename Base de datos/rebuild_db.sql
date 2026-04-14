-- Eliminar tablas incorrectas/viejas
IF OBJECT_ID('dbo.Solicitudes', 'U') IS NOT NULL DROP TABLE dbo.Solicitudes;
IF OBJECT_ID('dbo.Usuarios', 'U') IS NOT NULL DROP TABLE dbo.Usuarios;
IF OBJECT_ID('dbo.Feriados', 'U') IS NOT NULL DROP TABLE dbo.Feriados;
IF OBJECT_ID('dbo.Solicitudes_Vacaciones', 'U') IS NOT NULL DROP TABLE dbo.Solicitudes_Vacaciones;
IF OBJECT_ID('dbo.Saldos_Vacacionales', 'U') IS NOT NULL DROP TABLE dbo.Saldos_Vacacionales;
IF OBJECT_ID('dbo.Personal', 'U') IS NOT NULL DROP TABLE dbo.Personal;
IF OBJECT_ID('dbo.Roles', 'U') IS NOT NULL DROP TABLE dbo.Roles;

-- Crear esquema oficial Draw.io
CREATE TABLE Roles (
    id_Rol INT IDENTITY(1,1) PRIMARY KEY,
    Nombre VARCHAR(50) NOT NULL
);

CREATE TABLE Personal (
    id_Personal INT IDENTITY(1,1) PRIMARY KEY,
    Cedula VARCHAR(20) NOT NULL,
    Nombre VARCHAR(100) NOT NULL,
    Apellido VARCHAR(100) NOT NULL,
    Correo VARCHAR(100) NOT NULL,
    Fecha_Ingreso DATE NOT NULL,
    id_Rol INT FOREIGN KEY REFERENCES Roles(id_Rol),
    id_Carrera INT NULL, -- Aplica solo si es profesor
    Estado VARCHAR(20) DEFAULT 'Activo'
);

CREATE TABLE Usuarios (
    id_Usuario INT IDENTITY(1,1) PRIMARY KEY,
    id_Personal INT FOREIGN KEY REFERENCES Personal(id_Personal),
    username VARCHAR(100) NOT NULL,
    Password VARCHAR(255) NOT NULL,
    Estado VARCHAR(20) DEFAULT 'Activo'
);

CREATE TABLE Saldos_Vacacionales (
    id_Saldo INT IDENTITY(1,1) PRIMARY KEY,
    id_Personal INT FOREIGN KEY REFERENCES Personal(id_Personal),
    dias_asignados DECIMAL(5,2) DEFAULT 0,
    saldo_Disponible DECIMAL(5,2) DEFAULT 0
);

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

-- Insertar Data Mock para Colaborador (Geral)
INSERT INTO Roles (Nombre) VALUES ('Colaborador'), ('Docente');

-- Geral simulando ser Docente en Propiedad (con fecha vieja para vacaciones completas)
INSERT INTO Personal (Cedula, Nombre, Apellido, Correo, Fecha_Ingreso, id_Rol, id_Carrera)
VALUES ('1-2345-6789', 'Geral', 'Pacheco', 'geral@universidad.com', '1998-05-15', 2, 1);

INSERT INTO Usuarios (id_Personal, username, Password)
VALUES (1, 'geralp', 'hash123');

INSERT INTO Saldos_Vacacionales (id_Personal, dias_asignados, saldo_Disponible)
VALUES (1, 15.0, 15.0);

-- Insertar Feriados 2026-2027
INSERT INTO Feriados (fecha, descripcion) VALUES 
('2026-01-01', 'Año Nuevo'),
('2026-04-02', 'Jueves Santo'),
('2026-04-03', 'Viernes Santo'),
('2026-04-11', 'Día de la Batalla de Rivas'),
('2026-05-01', 'Día del Trabajador'),
('2026-07-25', 'Anexión del Partido de Nicoya'),
('2026-08-02', 'Día de la Virgen de los Ángeles'),
('2026-08-15', 'Día de la Madre'),
('2026-09-15', 'Día de la Independencia'),
('2026-12-01', 'Día de la Abolición del Ejército'),
('2026-12-25', 'Navidad'),
('2027-01-01', 'Año Nuevo'),
('2027-03-25', 'Jueves Santo'),
('2027-03-26', 'Viernes Santo'),
('2027-04-11', 'Día de la Batalla de Rivas'),
('2027-05-01', 'Día del Trabajador'),
('2027-07-25', 'Anexión del Partido de Nicoya'),
('2027-08-02', 'Día de la Virgen de los Ángeles'),
('2027-08-15', 'Día de la Madre'),
('2027-09-15', 'Día de la Independencia'),
('2027-12-01', 'Día de la Abolición del Ejército'),
('2027-12-25', 'Navidad');
