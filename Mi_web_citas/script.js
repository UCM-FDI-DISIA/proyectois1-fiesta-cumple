document.getElementById("botonSaludo").addEventListener("click", function() {
  alert("¡Hola! Gracias por visitar mi página 😄");
});

// Muestra la ventana de iniciar sesión al pulsar el botón 
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('botonIniciarSesion').onclick = function() {
    document.getElementById('ventanaIS').style.display = 'flex';
  };
});