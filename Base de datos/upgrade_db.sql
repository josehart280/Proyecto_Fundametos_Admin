-- 1. Crear catalogo de Carreras
CREATE TABLE Carreras (
    id_Carrera INT IDENTITY(1,1) PRIMARY KEY,
    Nombre VARCHAR(100) NOT NULL
);

-- Insertar carreras base
INSERT INTO Carreras (Nombre) VALUES ('Tecnología de Información');
INSERT INTO Carreras (Nombre) VALUES ('Administración de Empresas');
INSERT INTO Carreras (Nombre) VALUES ('Diseño Gráfico');

-- 2. Modificar Personal para conectarlo a Carreras y agregar Tipo_Nombramiento
ALTER TABLE Personal ADD Tipo_Nombramiento VARCHAR(50) DEFAULT 'Propiedad';
ALTER TABLE Personal ADD CONSTRAINT FK_Personal_Carrera FOREIGN KEY (id_Carrera) REFERENCES Carreras(id_Carrera);

-- 3. Crear tabla de Movimientos (Kardex)
CREATE TABLE Movimientos_Saldo (
    id_Movimiento INT IDENTITY(1,1) PRIMARY KEY,
    id_Personal INT FOREIGN KEY REFERENCES Personal(id_Personal),
    Fecha DATETIME DEFAULT GETDATE(),
    Tipo_Movimiento VARCHAR(10) CHECK (Tipo_Movimiento IN ('Suma', 'Resta')),
    Dias DECIMAL(5,2) NOT NULL,
    Motivo VARCHAR(255) NOT NULL
);

-- Insertar movimiento inicial para el usuario mockup
INSERT INTO Movimientos_Saldo (id_Personal, Tipo_Movimiento, Dias, Motivo)
VALUES (1, 'Suma', 15.0, 'Saldo inicial de vacaciones cargado por RRHH');
