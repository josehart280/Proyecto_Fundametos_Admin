/**
 * Lógica para el Módulo Colaborador (Geral)
 * PRF-COL-01 y PRF-COL-02 (Nivel 1: Secuencias, Lógica y Mensajes)
 */

document.addEventListener('DOMContentLoaded', () => {
    const tokenSesion = localStorage.getItem('sesion_token');

    // 1. Entradas (Referencia a elementos del DOM)
    const form = document.getElementById('formSolicitud');
    const inputInicio = document.getElementById('fecha_inicio');
    const inputFin = document.getElementById('fecha_fin');
    const totalDisplay = document.getElementById('total-dias');
    const errorGlobal = document.getElementById('error-global');
    
    // MOCK ELIMINADO: Todo cargará en vivo desde Base de Datos Local/Remoto
    let solicitudesExistentes = [];
    let saldoDisponible = 0;
    let feriadosInstitucionales = [];

    // Cargar parámetros reales al inicio
    async function inicializarFormulario() {
        try {
            const response = await fetch('/api/dashboard', {
                headers: {
                    'Authorization': `Bearer ${tokenSesion}`
                }
            });
            const data = await response.json();
            solicitudesExistentes = data.vacacionesProgramadas || [];
            saldoDisponible = data.usuario ? data.usuario.saldo_vacaciones : 0;
            feriadosInstitucionales = data.feriados || [];
            
            // Actualizamos la caja de saldo del DOM si existe (UX)
            const saldoNode = document.getElementById('saldo-disponible-view');
            if(saldoNode) saldoNode.textContent = `${saldoDisponible.toFixed(1)} días`;

            // Actualizar identidad en Header
            const nameNode = document.getElementById('user-name-display');
            if(nameNode) nameNode.textContent = `${data.usuario.Nombre} ${data.usuario.Apellido.charAt(0)}.`;

            const roleNode = document.getElementById('user-role-display');
            if(roleNode && data.usuario.nombramientos && data.usuario.nombramientos.length > 0) {
                const primaryRole = data.usuario.nombramientos[0];
                roleNode.textContent = `${primaryRole.Rol} • ${primaryRole.Tipo}`;
            }

            const avatarNode = document.getElementById('user-avatar');
            if(avatarNode) avatarNode.textContent = (data.usuario.Nombre.charAt(0) || 'U').toUpperCase();
        } catch (e) {
            console.error("Error crítico cargando perfil desde BD.");
        }
    }
    inicializarFormulario();

    /**
     * Secuencia Dencel: CÁLCULO ESTRICTO DE DÍAS HÁBILES
     * Basado en Nivel 1 (PRF-COL-02) - Se deben excluir fines de semana (Sáb/Dom) y Feriados de BD
     */
    function solicitarCalculoBD(fechaStr1, fechaStr2) {
        if (!fechaStr1 || !fechaStr2 || fechaStr1 > fechaStr2) return 0;
        
        let d1 = new Date(fechaStr1 + 'T00:00:00'); // Evitar timezone issues
        const d2 = new Date(fechaStr2 + 'T00:00:00');
        
        let diasHabiles = 0;

        while (d1 <= d2) {
            const diaSemana = d1.getDay();
            const esFinSemana = (diaSemana === 0 || diaSemana === 6);
            
            // Formatear la fecha iterada a string 'YYYY-MM-DD' para comparar con Feriados
            const y = d1.getFullYear();
            const m = String(d1.getMonth() + 1).padStart(2, '0');
            const d = String(d1.getDate()).padStart(2, '0');
            const fechaString = `${y}-${m}-${d}`;

            const esFeriado = feriadosInstitucionales.includes(fechaString);

            if (!esFinSemana && !esFeriado) {
                diasHabiles++;
            }

            d1.setDate(d1.getDate() + 1);
        }
        
        return diasHabiles;
    }

    /**
     * Secuencia: Valida si las fechas se traslapan con solicitudes previas (MSJ4)
     */
    function existeTraslape(fechaInicio, fechaFin) {
        return solicitudesExistentes.some(solicitud => {
            // Un traslape ocurre si la fecha de inicio solicitada es menor o igual al fin de la existente
            // Y la fecha de fin solicitada es mayor o igual al inicio de la existente
            return (fechaInicio <= solicitud.fin && fechaFin >= solicitud.inicio);
        });
    }

    /**
     * Secuencia de Evaluación Dinámica al interactuar con las fechas
     */
    function evaluarReglasNegocio() {
        // Reset de mensajes iterativos
        errorGlobal.style.display = "none";
        errorGlobal.textContent = "";

        // Obtener fecha de "hoy" segura (sin horas para comparar solo el string YYYY-MM-DD local)
        const hoyApp = new Date();
        const y = hoyApp.getFullYear();
        const m = String(hoyApp.getMonth() + 1).padStart(2, '0');
        const d = String(hoyApp.getDate()).padStart(2, '0');
        const hoyString = `${y}-${m}-${d}`;

        const fInicio = inputInicio.value;
        const fFin = inputFin.value;

        // Regla 1 (MSJ3): La fecha de inicio no puede ser anterior a la actual
        if (fInicio && fInicio < hoyString) {
            mostrarError("La fecha de inicio no puede ser anterior a la fecha actual.");
            return false;
        }

        // Validación de coherencia de rango
        if (fInicio && fFin && fInicio > fFin) {
            mostrarError("Error: La fecha de fin no puede ser anterior a la fecha de inicio.");
            return false;
        }

        // Si tenemos ambas fechas correctas lógicamente, procedemos al cálculo central
        if (fInicio && fFin) {
            // Regla 2 (MSJ4): Validar Traslapes
            if (existeTraslape(fInicio, fFin)) {
                mostrarError("Ya existe una solicitud en proceso para las fechas seleccionadas.");
                return false;
            }

            // Ejecutar llamada simulada al backend de Dencel
            const total = solicitarCalculoBD(fInicio, fFin);
            totalDisplay.textContent = total;
            totalDisplay.style.color = "var(--secondary-accent)";
            
            // Si las fechas solo abarcan fin de semana
            if (total === 0) {
                 mostrarError("Aviso: El rango seleccionado no contiene días hábiles a descontar.");
                 totalDisplay.style.color = "#f87171";
                 return false;
            }

            // Regla 3 (MSJ2): Validación de Saldo Disponible
            if (total > saldoDisponible) {
                mostrarError("Los días solicitados superan su saldo disponible.");
                totalDisplay.style.color = "#f87171";
                return false;
            }

            return true; // Pasa todas las validaciones previas
        }

        return false;
    }

    function mostrarError(mensaje) {
        errorGlobal.textContent = mensaje;
        errorGlobal.style.display = "block";
        totalDisplay.textContent = "0";
        totalDisplay.style.color = "#fff";
    }

    // Disparadores (Triggers) de la interfaz
    inputInicio.addEventListener('change', evaluarReglasNegocio);
    inputFin.addEventListener('change', evaluarReglasNegocio);

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault(); 
            
            const esValido = evaluarReglasNegocio();
            const fInicio = inputInicio.value;
            const fFin = inputFin.value;

            if (!fInicio || !fFin) {
                mostrarError("Por favor complete ambas fechas.");
                return;
            }

            if (!esValido) return;

            // Enviar a BASE DE DATOS REAL (API Dencel / Server)
            try {
                const total = solicitarCalculoBD(fInicio, fFin);
                await fetch('/api/solicitudes', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${tokenSesion}`
                    },
                    body: JSON.stringify({ 
                        fInicio: fInicio, 
                        fFin: fFin, 
                        dias: total, 
                        motivo: document.getElementById('comentarios') ? document.getElementById('comentarios').value : "Vacaciones solicitadas en línea"
                    })
                });

                // MSJ1: Mostrar Modal en lugar de un alert primitivo
                const modal = document.getElementById('success-modal');
                if (modal) {
                    modal.classList.add('active');
                } else {
                    alert("Gestión Completada exitosamente.");
                    window.location.href = 'dashboard.html';
                }
                
            } catch(e) {
                mostrarError("Hubo un problema de Red al conectar a la BD SQL Server.");
            }
        });
    }
});
