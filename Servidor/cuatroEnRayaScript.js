/* ========================================
   CUATRO EN RAYA - LÓGICA DEL JUEGO
   Versión Local (Jugador vs Sí mismo)
   ======================================== */

(function () {
    'use strict';

    // ===== CONSTANTES DEL JUEGO =====
    const ROWS = 6;
    const COLS = 7;
    const EMPTY = 0;
    const PLAYER_RED = 1;
    const PLAYER_YELLOW = 2;

    // ===== VARIABLES GLOBALES =====
    let board = [];
    let currentPlayer = PLAYER_RED;
    let gameOver = false;
    let gamePanel = null;
    let openGameBtn = null;

    // ===== INICIALIZACIÓN =====
    document.addEventListener('DOMContentLoaded', () => {
        console.log('[Cuatro en Raya] Inicializando...');

        gamePanel = document.getElementById('game-panel');
        openGameBtn = document.getElementById('open-game-btn');

        if (!gamePanel || !openGameBtn) {
            console.error('[Cuatro en Raya] No se encontraron los elementos necesarios');
            return;
        }

        // Configurar eventos de botones
        document.getElementById('open-game-btn').addEventListener('click', openGame);
        document.getElementById('close-game-btn').addEventListener('click', closeGame);
        document.getElementById('restart-game-btn').addEventListener('click', restartGame);

        // Inicializar el tablero
        initBoard();
        renderBoard();

        console.log('[Cuatro en Raya] ✅ Inicializado correctamente');
    });

    // ===== FUNCIÓN: ABRIR JUEGO =====
    function openGame() {
        if (!gamePanel) return;
        gamePanel.classList.remove('hidden');
        console.log('[Cuatro en Raya] Juego abierto');
    }

    // ===== FUNCIÓN: CERRAR JUEGO =====
    function closeGame() {
        if (!gamePanel) return;
        gamePanel.classList.add('hidden');
        console.log('[Cuatro en Raya] Juego cerrado');
    }

    // ===== FUNCIÓN: REINICIAR JUEGO =====
    function restartGame() {
        initBoard();
        renderBoard();
        currentPlayer = PLAYER_RED;
        gameOver = false;
        updatePlayerIndicator();
        updateGameMessage('');
        console.log('[Cuatro en Raya] Juego reiniciado');
    }

    // ===== FUNCIÓN: INICIALIZAR TABLERO =====
    function initBoard() {
        board = [];
        for (let row = 0; row < ROWS; row++) {
            board[row] = [];
            for (let col = 0; col < COLS; col++) {
                board[row][col] = EMPTY;
            }
        }
    }

    // ===== FUNCIÓN: RENDERIZAR TABLERO =====
    // ✅ CORRECCIÓN 3: Modificada para NO re-renderizar todo el tablero
    function renderBoard() {
        const boardElement = document.getElementById('game-board');
        if (!boardElement) return;

        boardElement.innerHTML = '';

        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.col = col;

                // Añadir ficha si la celda está ocupada (SIN animación)
                if (board[row][col] !== EMPTY) {
                    const chip = document.createElement('div');
                    chip.className = `chip ${board[row][col] === PLAYER_RED ? 'red' : 'yellow'}`;
                    cell.appendChild(chip);
                    cell.classList.add('filled');
                }

                // Evento de clic
                cell.addEventListener('click', () => handleCellClick(col));

                boardElement.appendChild(cell);
            }
        }
    }

    // ✅ CORRECCIÓN 3: Nueva función para añadir SOLO la ficha nueva con animación
    function addChipWithAnimation(row, col, player) {
        const boardElement = document.getElementById('game-board');
        if (!boardElement) return;

        // Calcular el índice de la celda en el grid (row * COLS + col)
        const cellIndex = row * COLS + col;
        const cell = boardElement.children[cellIndex];

        if (!cell) return;

        // Crear la ficha con animación
        const chip = document.createElement('div');
        chip.className = `chip ${player === PLAYER_RED ? 'red' : 'yellow'} drop-animation`;

        // Añadir la ficha a la celda
        cell.appendChild(chip);
        cell.classList.add('filled');
    }

    // ===== FUNCIÓN: MANEJAR CLIC EN COLUMNA =====
    // ✅ CORRECCIÓN 3: Modificada para usar la nueva función
    function handleCellClick(col) {
        if (gameOver) {
            return;
        }

        // Buscar la fila más baja disponible en esta columna
        const row = getLowestEmptyRow(col);

        if (row === -1) {
            // Columna llena
            return;
        }

        // Colocar la ficha en el array
        board[row][col] = currentPlayer;

        // ✅ USAR LA NUEVA FUNCIÓN: Añadir SOLO la ficha nueva con animación
        addChipWithAnimation(row, col, currentPlayer);

        // Verificar victoria
        if (checkWin(row, col)) {
            gameOver = true;
            const winner = currentPlayer === PLAYER_RED ? 'Rojas' : 'Amarillas';
            updateGameMessage(`🎉 ¡Ganan las ${winner}!`, 'winner');
            console.log(`[Cuatro en Raya] Victoria de las ${winner}`);
            return;
        }

        // Verificar empate
        if (checkTie()) {
            gameOver = true;
            updateGameMessage('🤝 ¡Empate!', 'tie');
            console.log('[Cuatro en Raya] Empate');
            return;
        }

        // Cambiar turno
        currentPlayer = (currentPlayer === PLAYER_RED) ? PLAYER_YELLOW : PLAYER_RED;
        updatePlayerIndicator();
    }

    // ===== FUNCIÓN: OBTENER FILA MÁS BAJA DISPONIBLE =====
    function getLowestEmptyRow(col) {
        for (let row = ROWS - 1; row >= 0; row--) {
            if (board[row][col] === EMPTY) {
                return row;
            }
        }
        return -1; // Columna llena
    }

    // ===== FUNCIÓN: VERIFICAR VICTORIA =====
    function checkWin(row, col) {
        const player = board[row][col];

        // Verificar horizontal
        if (checkDirection(row, col, 0, 1, player)) return true;
        // Verificar vertical
        if (checkDirection(row, col, 1, 0, player)) return true;
        // Verificar diagonal ascendente
        if (checkDirection(row, col, 1, 1, player)) return true;
        // Verificar diagonal descendente
        if (checkDirection(row, col, 1, -1, player)) return true;

        return false;
    }

    // ===== FUNCIÓN: VERIFICAR DIRECCIÓN =====
    function checkDirection(row, col, deltaRow, deltaCol, player) {
        let count = 1; // Contar la ficha actual

        // Contar en dirección positiva
        count += countInDirection(row, col, deltaRow, deltaCol, player);
        // Contar en dirección negativa
        count += countInDirection(row, col, -deltaRow, -deltaCol, player);

        return count >= 4;
    }

    // ===== FUNCIÓN: CONTAR EN DIRECCIÓN =====
    function countInDirection(row, col, deltaRow, deltaCol, player) {
        let count = 0;
        let r = row + deltaRow;
        let c = col + deltaCol;

        while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === player) {
            count++;
            r += deltaRow;
            c += deltaCol;
        }

        return count;
    }

    // ===== FUNCIÓN: VERIFICAR EMPATE =====
    function checkTie() {
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                if (board[row][col] === EMPTY) {
                    return false;
                }
            }
        }
        return true;
    }

    // ===== FUNCIÓN: ACTUALIZAR INDICADOR DE TURNO =====
    function updatePlayerIndicator() {
        const indicator = document.getElementById('current-player');
        if (!indicator) return;

        if (currentPlayer === PLAYER_RED) {
            indicator.innerHTML = 'Turno: <span class="player-chip red-chip"></span> <strong>Rojas</strong>';
        } else {
            indicator.innerHTML = 'Turno: <span class="player-chip yellow-chip"></span> <strong>Amarillas</strong>';
        }
    }

    // ===== FUNCIÓN: ACTUALIZAR MENSAJE DEL JUEGO =====
    function updateGameMessage(message, className = '') {
        const messageElement = document.getElementById('game-message');
        if (!messageElement) return;

        messageElement.textContent = message;
        messageElement.className = 'game-message ' + className;
    }

    // ===== EXPONER FUNCIÓN GLOBAL PARA MOSTRAR/OCULTAR BOTÓN =====
    // Esta función será llamada desde app.js cuando el usuario inicie sesión
    window.showGameButton = function () {
        if (openGameBtn) {
            openGameBtn.style.display = 'flex';
            console.log('[Cuatro en Raya] Botón visible');
        }
    };

    window.hideGameButton = function () {
        if (openGameBtn) {
            openGameBtn.style.display = 'none';
            console.log('[Cuatro en Raya] Botón oculto');
        }
    };

})();