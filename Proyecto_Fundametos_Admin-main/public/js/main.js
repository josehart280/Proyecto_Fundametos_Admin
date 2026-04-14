document.addEventListener('DOMContentLoaded', () => {
  console.log('Pagina cargada correctamente');

  const btnSaludo = document.getElementById('btnSaludo');
  const respuesta = document.getElementById('respuesta');

  if (btnSaludo) {
    btnSaludo.addEventListener('click', () => {
      const hora = new Date().getHours();
      let saludo;

      if (hora < 12) {
        saludo = 'Buenos dias!';
      } else if (hora < 18) {
        saludo = 'Buenas tardes!';
      } else {
        saludo = 'Buenas noches!';
      }

      respuesta.textContent = `${saludo} Bienvenido al proyecto.`;
    });
  }
});