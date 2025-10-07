document.getElementById("botonSaludo").addEventListener("click", function() {
  alert("¡Hola! Gracias por visitar mi página 😄");
});

// Muestra la ventana de iniciar sesión al pulsar el botón 
document.addEventListener('DOMContentLoaded', function() {
  // Mostrar ventana y fondo al pulsar el botón superior derecho
  document.getElementById('botonUsuario').onclick = function() {
    document.getElementById('ventanaIS').style.display = 'flex';
    document.getElementById('fondoIS').style.display = 'block';
  };

  // Cerrar ventana al hacer click en el fondo
  document.getElementById('fondoIS').onclick = function() {
    document.getElementById('ventanaIS').style.display = 'none';
    document.getElementById('fondoIS').style.display = 'none';
  };
});