
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btnExplorar");
  const container = document.getElementById("scrollContainer");
  const perfilContainer = document.getElementById("perfilContainer");

  let usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];
  let index = 0;

  btn.addEventListener("click", () => {
    container.classList.toggle("hidden");
    if (!container.classList.contains("hidden")) renderPerfil();
  });

  function renderPerfil() {
    perfilContainer.innerHTML = ""; // Limpia
    const user = usuarios[index];

    if (user) {
      const card = document.createElement("div");
      card.className = "perfil";
      card.innerHTML = `
        <img src="${user.foto || 'default.jpg'}" alt="${user.nombre}">
        <h3>${user.nombre}</h3>
        <p>${user.edad ? user.edad + ' años' : ''}</p>
      `;
      perfilContainer.appendChild(card);
    }

    // Manejar scroll infinito
    index = (index + 1) % usuarios.length;
    setTimeout(renderPerfil, 2000); // cambia cada 2 segundos
  }
});
