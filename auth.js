/**
 * Módulo de Sesiones y Autenticación
 * Maneja tokens, validaciones y auditoría de acceso
 */

const crypto = require('crypto');
const db = require('./db');

// Configuración
const CONFIG = {
  DURACION_SESION_MINUTOS: 480, // 8 horas
  DURACION_TOKEN_RECUPERACION_MINUTOS: 15, // 15 minutos
  MAX_INTENTOS_FALLIDOS: 3,
  DURACION_BLOQUEO_MINUTOS: 30
};

/**
 * Genera un token único para sesión o recuperación
 */
function generarToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Valida credenciales del usuario
 * @returns {Object} {valido: boolean, usuario: Object, mensaje: string}
 */
async function validarCredenciales(username, password) {
  try {
    // 1. Validar que los campos no estén vacíos
    if (!username || !password) {
      return { 
        valido: false, 
        mensaje: 'Debe ingresar sus credenciales.',
        codigo: 'CAMPOS_VACIOS'
      };
    }

    // 2. Validar formato del username (mínimo 3 caracteres)
    if (username.length < 3) {
      return { 
        valido: false, 
        mensaje: 'Formato de identificador inválido.',
        codigo: 'FORMATO_INVALIDO'
      };
    }

    // 3. Buscar usuario en la BD
    const usuarios = await db.query(
      `SELECT u.id_Usuario, u.id_Personal, u.username, u.Password, u.Estado, u.Bloqueado, 
              p.Nombre, p.Apellido, p.Correo, r.Nombre as Rol
       FROM Usuarios u 
       JOIN Personal p ON u.id_Personal = p.id_Personal
       LEFT JOIN Nombramientos n ON p.id_Personal = n.id_Personal
       LEFT JOIN Roles r ON n.id_Rol = r.id_Rol
       WHERE u.username = @username`,
      { username }
    );

    if (!usuarios || usuarios.length === 0) {
      // Registrar intento fallido (usuario no existe)
      // La IP se pasará desde server.js
      return { 
        valido: false, 
        mensaje: 'Credenciales incorrectas.',
        codigo: 'USUARIO_NO_EXISTE'
      };
    }

    const usuario = usuarios[0];

    // 4. Verificar si el usuario está bloqueado
    if (usuario.Bloqueado === 1 || usuario.Bloqueado === true) {
      return { 
        valido: false, 
        mensaje: 'Cuenta bloqueada por múltiples intentos fallidos.',
        codigo: 'USUARIO_BLOQUEADO'
      };
    }

    // 5. Verificar si el usuario está inactivo
    if (usuario.Estado !== 'Activo') {
      await registrarIntento(usuario.id_Usuario, 'fallido', 'Usuario inactivo');
      return { 
        valido: false, 
        mensaje: 'Credenciales incorrectas.',
        codigo: 'USUARIO_INACTIVO'
      };
    }

    // 6. Validar contraseña (actualmente sin hash, en producción usar bcrypt)
    if (usuario.Password !== password) {
      // Incrementar intentos fallidos
      await incrementarIntentosFallidos(usuario.id_Usuario);
      await registrarIntento(usuario.id_Usuario, 'fallido', 'Contraseña incorrecta');
      
      return { 
        valido: false, 
        mensaje: 'Credenciales incorrectas.',
        codigo: 'PASSWORD_INCORRECTA'
      };
    }

    // 7. Validar conexión a BD (ya se hizo arriba)
    
    // ✅ TODO CORRECTO: Registrar intento exitoso
    await registrarIntento(usuario.id_Usuario, 'exitoso', null);
    
    // Resetear intentos fallidos
    await db.actualizar('Usuarios', 
      { Intentos_Fallidos: 0 }, 
      'id_Usuario = @id',
      { id: usuario.id_Usuario }
    );

    // Actualizar última conexión
    await db.actualizar('Usuarios',
      { Fecha_Ultimo_Acceso: new Date() },
      'id_Usuario = @id',
      { id: usuario.id_Usuario }
    );

    return { 
      valido: true, 
      mensaje: 'Acceso concedido. Bienvenido.',
      usuario: {
        id_Usuario: usuario.id_Usuario,
        id_Personal: usuario.id_Personal,
        nombre: usuario.Nombre,
        apellido: usuario.Apellido,
        username: usuario.username,
        correo: usuario.Correo,
        rol: usuario.Rol,
        estado: usuario.Estado
      },
      codigo: 'EXITO'
    };

  } catch (error) {
    console.error('Error en validarCredenciales:', error);
    return { 
      valido: false, 
      mensaje: 'Error en la validación.',
      codigo: 'ERROR_VALIDACION'
    };
  }
}

/**
 * Crea una sesión activa para el usuario
 */
async function crearSesion(id_Usuario) {
  try {
    const token = generarToken();
    const ahora = new Date();
    const expiracion = new Date(ahora.getTime() + CONFIG.DURACION_SESION_MINUTOS * 60000);

    await db.query(
      `INSERT INTO Sesiones (id_Usuario, Token, Fecha_Creacion, Fecha_Expiracion, Activa)
       VALUES (@id_Usuario, @token, @fecha_creacion, @fecha_expiracion, 1)`,
      { id_Usuario, token, fecha_creacion: ahora, fecha_expiracion: expiracion }
    );

    return {
      token: token,
      expiracion: expiracion,
      duracion_horas: CONFIG.DURACION_SESION_MINUTOS / 60
    };
  } catch (error) {
    console.error('Error creando sesión:', error);
    throw error;
  }
}

/**
 * Valida un token de sesión
 */
async function validarSesion(token) {
  try {
    if (!token) {
      return { valida: false, mensaje: 'Token no proporcionado' };
    }

    const sesiones = await db.query(
      `SELECT s.id_Sesion, s.id_Usuario, s.Fecha_Expiracion, s.Activa,
              u.username, p.Nombre, p.Apellido, p.Correo
       FROM Sesiones s
       JOIN Usuarios u ON s.id_Usuario = u.id_Usuario
       JOIN Personal p ON u.id_Personal = p.id_Personal
       WHERE s.Token = @token AND s.Activa = 1`,
      { token }
    );

    if (!sesiones || sesiones.length === 0) {
      return { valida: false, mensaje: 'Sesión no encontrada o inactiva' };
    }

    const sesion = sesiones[0];

    // Verificar expiración
    if (new Date() > sesion.Fecha_Expiracion) {
      // Marcar como expirada
      await db.actualizar('Sesiones',
        { Activa: 0 },
        'id_Sesion = @id',
        { id: sesion.id_Sesion }
      );
      return { valida: false, mensaje: 'Sesión expirada' };
    }

    return {
      valida: true,
      usuario: {
        id_Usuario: sesion.id_Usuario,
        username: sesion.username,
        nombre: sesion.Nombre,
        apellido: sesion.Apellido,
        correo: sesion.Correo
      }
    };

  } catch (error) {
    console.error('Error validando sesión:', error);
    return { valida: false, mensaje: 'Error en validación de sesión' };
  }
}

/**
 * Cierra una sesión (logout)
 */
async function cerrarSesion(token) {
  try {
    if (!token) {
      return { exito: false, mensaje: 'No existe sesión activa' };
    }

    const resultado = await db.actualizar('Sesiones',
      { Activa: 0 },
      'Token = @token AND Activa = 1',
      { token }
    );

    if (resultado === 0) {
      return { exito: false, mensaje: 'No existe sesión activa' };
    }

    return { exito: true, mensaje: 'Sesión cerrada correctamente' };
  } catch (error) {
    console.error('Error cerrando sesión:', error);
    return { exito: false, mensaje: 'Error al cerrar sesión' };
  }
}

/**
 * Genera un token de recuperación de contraseña
 */
async function generarTokenRecuperacion(id_Usuario) {
  try {
    const token = generarToken();
    const ahora = new Date();
    const expiracion = new Date(ahora.getTime() + CONFIG.DURACION_TOKEN_RECUPERACION_MINUTOS * 60000);

    await db.query(
      `INSERT INTO Recuperacion_Password (id_Usuario, Token, Fecha_Creacion, Fecha_Expiracion, Utilizado)
       VALUES (@id_usuario, @token, @fecha_creacion, @fecha_expiracion, 0)`,
      { id_usuario: id_Usuario, token, fecha_creacion: ahora, fecha_expiracion: expiracion }
    );

    // Registrar intento de recuperación
    const usuario = await db.query(
      `SELECT Correo FROM Personal WHERE id_Personal = (SELECT id_Personal FROM Usuarios WHERE id_Usuario = @id)`,
      { id: id_Usuario }
    );

    if (usuario && usuario.length > 0) {
      await db.query(
        `INSERT INTO Intentos_Recuperacion (id_Usuario, Correo, Fecha_Intento, Token_Enviado, Estado)
         VALUES (@id_usuario, @correo, @fecha, @token, 'enviado')`,
        { id_usuario: id_Usuario, correo: usuario[0].Correo, fecha: ahora, token }
      );
    }

    return {
      token: token,
      expiracion: expiracion,
      duracion_minutos: CONFIG.DURACION_TOKEN_RECUPERACION_MINUTOS
    };
  } catch (error) {
    console.error('Error generando token de recuperación:', error);
    throw error;
  }
}

/**
 * Valida y utiliza un token de recuperación para cambiar contraseña
 */
async function cambiarPasswordConToken(token, nuevaPassword) {
  try {
    if (!token || !nuevaPassword) {
      return { exito: false, mensaje: 'Datos incompletos' };
    }

    // Buscar token válido
    const recuperaciones = await db.query(
      `SELECT id_Recuperacion, id_Usuario, Fecha_Expiracion, Utilizado
       FROM Recuperacion_Password
       WHERE Token = @token`,
      { token }
    );

    if (!recuperaciones || recuperaciones.length === 0) {
      return { exito: false, mensaje: 'El enlace es inválido o ha expirado. Solicite uno nuevo.' };
    }

    const recuperacion = recuperaciones[0];

    // Validar que no esté utilizado
    if (recuperacion.Utilizado) {
      return { exito: false, mensaje: 'El enlace ya ha sido utilizado.' };
    }

    // Validar expiración
    if (new Date() > recuperacion.Fecha_Expiracion) {
      return { exito: false, mensaje: 'El enlace es inválido o ha expirado. Solicite uno nuevo.' };
    }

    // Actualizar contraseña
    await db.actualizar('Usuarios',
      { Password: nuevaPassword },
      'id_Usuario = @id',
      { id: recuperacion.id_Usuario }
    );

    // Marcar token como utilizado
    await db.actualizar('Recuperacion_Password',
      { Utilizado: 1 },
      'id_Recuperacion = @id',
      { id: recuperacion.id_Recuperacion }
    );

    // Cerrar todas las sesiones activas del usuario
    await db.actualizar('Sesiones',
      { Activa: 0 },
      'id_Usuario = @id',
      { id: recuperacion.id_Usuario }
    );

    // Registrar cambio
    await db.query(
      `UPDATE Intentos_Recuperacion SET Estado = 'utilizado' WHERE Token_Enviado = @token`,
      { token }
    );

    return { exito: true, mensaje: 'Contraseña actualizada correctamente. Ya puede iniciar sesión.' };

  } catch (error) {
    console.error('Error en cambiarPasswordConToken:', error);
    return { exito: false, mensaje: 'Error al cambiar contraseña' };
  }
}

/**
 * Registra un intento de acceso en la auditoría
 */
async function registrarIntento(id_Usuario, resultado, razon, ip_Cliente = null) {
  try {
    await db.query(
      `INSERT INTO Intentos_Acceso (id_Usuario, Resultado, Razon_Fallo, IP_Cliente, Fecha_Intento)
       VALUES (@id_usuario, @resultado, @razon, @ip, GETDATE())`,
      { id_usuario: id_Usuario || null, resultado, razon: razon || null, ip: ip_Cliente || null }
    );
  } catch (error) {
    console.error('Error registrando intento:', error);
  }
}

/**
 * Incrementa el contador de intentos fallidos
 */
async function incrementarIntentosFallidos(id_Usuario) {
  try {
    const usuario = await db.query(
      `SELECT Intentos_Fallidos FROM Usuarios WHERE id_Usuario = @id`,
      { id: id_Usuario }
    );

    if (usuario && usuario.length > 0) {
      const intentos = usuario[0].Intentos_Fallidos || 0;
      const nuevosIntentos = intentos + 1;

      if (nuevosIntentos >= CONFIG.MAX_INTENTOS_FALLIDOS) {
        // Bloquear usuario
        await db.actualizar('Usuarios',
          { Bloqueado: 1, Fecha_Bloqueo: new Date(), Intentos_Fallidos: nuevosIntentos },
          'id_Usuario = @id',
          { id: id_Usuario }
        );
      } else {
        await db.actualizar('Usuarios',
          { Intentos_Fallidos: nuevosIntentos },
          'id_Usuario = @id',
          { id: id_Usuario }
        );
      }
    }
  } catch (error) {
    console.error('Error incrementando intentos:', error);
  }
}

/**
 * Busca usuario por correo o username para recuperación
 */
async function buscarUsuarioPorCorreoOUsername(identificador) {
  try {
    const usuarios = await db.query(
      `SELECT u.id_Usuario, u.id_Personal, u.username, u.Estado, p.Nombre, p.Apellido, p.Correo
       FROM Usuarios u
       JOIN Personal p ON u.id_Personal = p.id_Personal
       WHERE p.Correo = @correo OR u.username = @username`,
      { correo: identificador, username: identificador }
    );

    if (!usuarios || usuarios.length === 0) {
      return null;
    }

    return usuarios[0];
  } catch (error) {
    console.error('Error buscando usuario:', error);
    return null;
  }
}

module.exports = {
  validarCredenciales,
  crearSesion,
  validarSesion,
  cerrarSesion,
  generarTokenRecuperacion,
  cambiarPasswordConToken,
  buscarUsuarioPorCorreoOUsername,
  registrarIntento,
  CONFIG
};
