# Proyecto Fundamentos Admin

Servidor Node.js basico con conexion a MySQL para proyecto de universidad.

## Descripcion

Proyecto desarrollado para la carrera de Administracion de Sistemas Informaticos.

## Requisitos

- Node.js 18+
- MySQL 8+

## Instalacion

```bash
npm install
```



## Uso

```bash
npm start
```

El servidor iniciara en http://localhost:3000

## Rutas API

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | /api/test | Probar conexion a MySQL |
| GET | /api/usuarios | Obtener lista de usuarios |

## Estructura

```
/public     - Archivos estaticos
/server.js  - Servidor principal
/db.js      - Conexion a MySQL
```

---

## Historial de Funcionalidades

### 2026-03-20 - Servidor MySQL inicial

- Conexion a base de datos MySQL via mysql2
- API REST con rutas /api/test y /api/usuarios
- Servidor de archivos estaticos desde /public
- Configuracion via variables de entorno (.env)
