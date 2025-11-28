(function () {
    'use strict';

    let gamesBtn = null;
    let dropdown = null;

    document.addEventListener('DOMContentLoaded', () => {
        gamesBtn = document.getElementById('open-games-menu-btn');
        dropdown = document.getElementById('games-dropdown');

        if (!gamesBtn || !dropdown) {
            console.warn('[Games Menu] Elementos no encontrados');
            return;
        }

        // Toggle dropdown cuando se hace click en el botón
        gamesBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDropdown();
        });

        // Manejar clicks en las opciones del menú
        const options = dropdown.querySelectorAll('.game-option');
        options.forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const gameType = option.dataset.game;
                handleGameSelection(gameType);
                hideDropdown();
            });
        });

        // Cerrar dropdown al hacer click fuera
        document.addEventListener('click', (e) => {
            if (dropdown && !dropdown.contains(e.target) && e.target !== gamesBtn) {
                hideDropdown();
            }
        });

        console.log('[Games Menu] Inicializado correctamente');
    });

    function toggleDropdown() {
        if (!dropdown) return;
        dropdown.classList.toggle('show');
    }

    function hideDropdown() {
        if (!dropdown) return;
        dropdown.classList.remove('show');
    }

    function handleGameSelection(gameType) {
        console.log('[Games Menu] Juego seleccionado:', gameType);

        if (gameType === 'cuatroEnRaya') {
            console.log('[Games Menu] Intentando llamar a triggerCuatroEnRaya...');
            console.log('[Games Menu] Función disponible:', typeof window.triggerCuatroEnRaya);
            // Llamar a la función expuesta del cuatro en raya
            if (typeof window.triggerCuatroEnRaya === 'function') {
                window.triggerCuatroEnRaya();
            } else {
                console.warn('[Games Menu] No se encontró la función para Cuatro en Raya');
                alert('Error: La función del juego no está disponible. Recarga la página.');
            }
        } else if (gameType === 'dosVerdades') {
            console.log('[Games Menu] Intentando llamar a triggerDosVerdades...');
            console.log('[Games Menu] Función disponible:', typeof window.triggerDosVerdades);
            // Llamar a la función expuesta de dos verdades
            if (typeof window.triggerDosVerdades === 'function') {
                window.triggerDosVerdades();
            } else {
                console.warn('[Games Menu] No se encontró la función para Dos Verdades');
                alert('Error: La función del juego no está disponible. Recarga la página.');
            }
        }
    }

})();
