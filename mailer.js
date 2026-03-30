/**
 * Módulo de Envío de Emails
 * 
 * Nota: Configura tus credenciales SMTP en .env
 * EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD, EMAIL_FROM
 */

const nodemailer = require('nodemailer');

// Crear transportador SMTP
let transporter = null;

function crearTransportador() {
  if (transporter) return transporter;

  const config = {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true' || false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  };

  transporter = nodemailer.createTransport(config);
  return transporter;
}

/**
 * Envía email de recuperación de contraseña
 * @param {string} email - Email del destinatario
 * @param {string} nombre - Nombre del usuario
 * @param {string} token - Token de recuperación
 * @param {number} minutosExpiracion - Minutos de validez del token
 * @returns {Promise<{exito: boolean, mensaje: string}>}
 */
async function enviarRecuperacionPassword(email, nombre, token, minutosExpiracion = 15) {
  try {
    // URL base - personaliza según tu dominio
    const baseURL = process.env.BASE_URL || 'http://localhost:3001';
    const enlaceRecuperacion = `${baseURL}/recuperar-password.html?token=${token}`;

    const mailOptions = {
      from: `Sistema de Vacaciones CUCR <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: email,
      subject: '🔐 Recuperación de Contraseña - Sistema de Vacaciones CUCR',
      html: `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
            .container { max-width: 600px; background-color: white; margin: 0 auto; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; color: #333; }
            .content h2 { color: #333; margin-bottom: 15px; }
            .content p { line-height: 1.6; margin: 10px 0; }
            .button-container { text-align: center; margin: 30px 0; }
            .button { display: inline-block; background-color: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; }
            .button:hover { background-color: #764ba2; }
            .expiration { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .expiration p { margin: 5px 0; color: #856404; }
            .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #eee; }
            .footer p { margin: 5px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Recuperación de Contraseña</h1>
            </div>
            
            <div class="content">
              <h2>Hola ${nombre},</h2>
              <p>Recibimos una solicitud para recuperar tu contraseña en el <strong>Sistema de Gestión de Vacaciones CUCR</strong>.</p>
              
              <p>Si realizaste esta solicitud, haz clic en el botón de abajo para establecer una nueva contraseña:</p>
              
              <div class="button-container">
                <a href="${enlaceRecuperacion}" class="button">Recuperar Contraseña</a>
              </div>
              
              <p>O copia y pega el siguiente enlace en tu navegador:</p>
              <p style="word-break: break-all; background-color: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px;">
                ${enlaceRecuperacion}
              </p>
              
              <div class="expiration">
                <p><strong>⏰ Importante:</strong> Este enlace expirará en <strong>${minutosExpiracion} minutos</strong>.</p>
                <p>Si no solicitaste esta recuperación, puedes ignorar este correo. Tu contraseña se mantendrá segura.</p>
              </div>
              
              <p><strong>Recomendaciones de seguridad:</strong></p>
              <ul>
                <li>Nunca compartas tu token de recuperación</li>
                <li>Usa una contraseña fuerte (mínimo 6 caracteres)</li>
                <li>Si no reconoces esta solicitud, cambia tu contraseña de inmediato</li>
              </ul>
            </div>
            
            <div class="footer">
              <p><strong>Colegio Universitario de Cartago (CUCR)</strong></p>
              <p>Caso de duda: contacta a soporte@cucr.ac.cr</p>
              <p>© 2026 - Todos los derechos reservados</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Hola ${nombre},
        
        Recibimos una solicitud para recuperar tu contraseña.
        
        Accede a este enlace para cambiar tu contraseña:
        ${enlaceRecuperacion}
        
        Este enlace expirará en ${minutosExpiracion} minutos.
        
        Si no solicitaste esto, ignora este correo.
        
        --- 
        Colegio Universitario de Cartago (CUCR)
        Sistema de Gestión de Vacaciones
      `
    };

    const transporter = crearTransportador();
    
    // Validar que tenemos credenciales
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.warn('[ADVERTENCIA] Credenciales SMTP no configuradas. Email NO enviado.');
      console.log('[EMAIL] Enlace de recuperación (para testing):', enlaceRecuperacion);
      
      // En desarrollo, retornar éxito pero sin enviar
      return {
        exito: true,
        mensaje: 'Enlace de recuperación generado (email no configurado en desarrollo)',
        enlace: enlaceRecuperacion // Solo en desarrollo
      };
    }

    const info = await transporter.sendMail(mailOptions);
    
    console.log(`✅ Email enviado a ${email}. ID: ${info.messageId}`);
    
    return {
      exito: true,
      mensaje: `Enlace de recuperación enviado a ${email}`
    };

  } catch (error) {
    console.error('❌ Error enviando email:', error.message);
    return {
      exito: false,
      mensaje: 'Error al enviar el email. Intenta más tarde.'
    };
  }
}

/**
 * Envía notificación de cambio de contraseña exitoso
 */
async function enviarConfirmacionCambioPassword(email, nombre) {
  try {
    const mailOptions = {
      from: `Sistema de Vacaciones CUCR <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: email,
      subject: '✅ Contraseña Actualizada - Sistema de Vacaciones CUCR',
      html: `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
            .container { max-width: 600px; background-color: white; margin: 0 auto; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
            .header { background: linear-gradient(135deg, #56ab2f 0%, #a8e063 100%); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; color: #333; }
            .success-box { background-color: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .success-box p { color: #155724; margin: 5px 0; }
            .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #eee; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>[ÉXITO] ¡Contraseña Actualizada!</h1>
            </div>
            
            <div class="content">
              <h2>Hola ${nombre},</h2>
              <p>Tu contraseña ha sido actualizada exitosamente en el <strong>Sistema de Gestión de Vacaciones CUCR</strong>.</p>
              
              <div class="success-box">
                <p><strong>[COMPLETADO] Cambio completado</strong></p>
                <p>Ya puedes iniciar sesión con tu nueva contraseña.</p>
              </div>
              
              <p><strong>Si no realizaste este cambio:</strong></p>
              <p>Tu cuenta podría estar comprometida. Contacta inmediatamente con el administrador del sistema.</p>
            </div>
            
            <div class="footer">
              <p><strong>Colegio Universitario de Cartago (CUCR)</strong></p>
              <p>© 2026 - Todos los derechos reservados</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const transporter = crearTransportador();
    
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      return { exito: true, mensaje: 'Confirmación (email no configurado)' };
    }

    await transporter.sendMail(mailOptions);
    console.log(`✅ Confirmación enviada a ${email}`);
    
    return { exito: true };

  } catch (error) {
    console.error('Error enviando confirmación:', error.message);
    return { exito: false };
  }
}

module.exports = {
  enviarRecuperacionPassword,
  enviarConfirmacionCambioPassword
};
