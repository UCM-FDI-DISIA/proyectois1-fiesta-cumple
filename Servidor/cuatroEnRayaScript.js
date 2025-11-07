/* ========================================
   CUATRO EN RAYA ONLINE - LÓGICA DEL JUEGO
   Versión Multijugador con Firebase Firestore
   ======================================== */

(function() {
    'use strict';

    // ===== ACCESO A FIREBASE (desde app.js) =====
    // db, currentUserId, currentUserName y currentChatId son variables globales de app.js

    // ===== CONSTANTES DEL JUEGO =====
    const ROWS = 6;
    const COLS = 7;
    const EMPTY = 0;
    const PLAYER_RED = 1;
    const PLAYER_YELLOW = 2;

    // ✅ AÑADIR ESTAS FUNCIONES AQUÍ
    // ===== FUNCIONES DE CONVERSIÓN ARRAY 2D ↔ ARRAY PLANO =====
    function flatTo2D(flatBoard) {
        const board2D = [];
        for (let row = 0; row < ROWS; row++) {
            board2D[row] = [];
            for (let col = 0; col < COLS; col++) {
                const index = row * COLS + col;
                board2D[row][col] = flatBoard[index];
            }
        }
        return board2D;
    }

    function board2DToFlat(board2D) {
        const flatBoard = [];
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                flatBoard.push(board2D[row][col]);
            }
        }
        return flatBoard;
    }

    // ===== VARIABLES GLOBALES =====
    let gameListener = null;           // Listener de Firebase para la partida actual
    let currentGameId = null;          // ID del juego actualmente abierto
    let myRole = null;                 // 'red' o 'yellow'
    let gameContainer = null;
    let gameBoardElement = null;
    let openGameBtn = null;

    // ===== INICIALIZACIÓN =====
    document.addEventListener('DOMContentLoaded', () => {
        console.log('[4 en Raya Online] Inicializando...');

        gameContainer = document.getElementById('game-container');
        gameBoardElement = document.getElementById('game-board-online');
        openGameBtn = document.getElementById('open-game-btn');

        if (!gameContainer || !gameBoardElement || !openGameBtn) {
            console.error('[4 en Raya Online] Elementos necesarios no encontrados');
            return;
        }

        // Configurar botón de invitar a jugar
        openGameBtn.addEventListener('click', handleGameButtonClick);

        // Configurar botón de cerrar juego
        const closeBtn = document.getElementById('close-game-online-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', handleCloseGame);
        }

        console.log('[4 en Raya Online] ✅ Inicializado correctamente');
    });

    // ===== FUNCIÓN: MANEJAR CLIC EN BOTÓN 🎮 =====
    async function handleGameButtonClick() {
        if (!currentChatId) {
            console.warn('[4 en Raya] No hay chat activo');
            return;
        }

        try {
            // Verificar si ya existe una partida en este chat
            const gameRef = db.collection('games').doc(currentChatId);
            const gameDoc = await gameRef.get();

            if (gameDoc.exists) {
                const gameData = gameDoc.data();
                if (gameData.status === 'invited' || gameData.status === 'playing') {
                    console.log('[4 en Raya] Ya hay una partida activa en este chat');
                    return; // No hacer nada
                }
            }

            // Enviar invitación
            await sendGameInvitation();

        } catch (error) {
            console.error('[4 en Raya] Error al manejar botón de juego:', error);
        }
    }

    // ===== FUNCIÓN: ENVIAR INVITACIÓN DE JUEGO =====
    async function sendGameInvitation() {
        if (!currentChatId || !currentUserId || !currentUserName) {
            console.error('[4 en Raya] Faltan datos del usuario o chat');
            return;
        }

        try {
            const gameId = currentChatId;
            
            // Determinar el ID del otro jugador
            const chatParticipants = currentChatId.split('_');
            const partnerId = chatParticipants.find(id => id !== currentUserId);

            // ✅ CREAR TABLERO PLANO (array de 42 elementos)
            const flatBoard = new Array(ROWS * COLS).fill(EMPTY);

            // Crear documento de juego en Firebase
            await db.collection('games').doc(gameId).set({
                players: {
                    red: currentUserId,      // Quien invita juega con rojas
                    yellow: partnerId         // Quien acepta juega con amarillas
                },
                board: flatBoard,  // ✅ Array plano en lugar de array 2D
                currentTurn: currentUserId,   // Las rojas empiezan
                status: 'invited',
                winner: null,
                invitedBy: currentUserId,
                invitedAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastMove: null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                closedBy: []  // Array de usuarios que han cerrado
            });

            console.log('[4 en Raya] Invitación enviada');

            // Renderizar mensaje de invitación en el chat
            renderInvitationMessage(currentUserName, gameId);

        } catch (error) {
            console.error('[4 en Raya] Error al enviar invitación:', error);
            alert('Error al enviar invitación: ' + error.message);
        }
    }

    // ===== FUNCIÓN: RENDERIZAR MENSAJE DE INVITACIÓN =====
    function renderInvitationMessage(inviterName, gameId) {
        const messagesDiv = document.getElementById('messages');
        if (!messagesDiv) return;

        // Crear mensaje de invitación
        const invitationDiv = document.createElement('div');
        invitationDiv.className = 'message game-invitation-message';
        invitationDiv.dataset.gameId = gameId;

        invitationDiv.innerHTML = `
            <div class="message-header">
                <strong>${inviterName}</strong>
            </div>
            <div class="game-invitation-text">
                🎮 Te invitó a jugar Cuatro en Raya
            </div>
            <div class="invitation-buttons">
                <button class="accept-game-btn" data-game-id="${gameId}">Aceptar</button>
                <button class="reject-game-btn" data-game-id="${gameId}">Rechazar</button>
            </div>
        `;

        // Añadir listeners a los botones
        const acceptBtn = invitationDiv.querySelector('.accept-game-btn');
        const rejectBtn = invitationDiv.querySelector('.reject-game-btn');

        acceptBtn.addEventListener('click', () => handleAcceptInvitation(gameId));
        rejectBtn.addEventListener('click', () => handleRejectInvitation(gameId));

        messagesDiv.appendChild(invitationDiv);

        // Scroll al final
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    // ===== FUNCIÓN: ACEPTAR INVITACIÓN =====
    async function handleAcceptInvitation(gameId) {
        try {
            const gameRef = db.collection('games').doc(gameId);
            const gameDoc = await gameRef.get();

            if (!gameDoc.exists) {
                console.error('[4 en Raya] Partida no encontrada');
                return;
            }

            const gameData = gameDoc.data();

            if (gameData.status !== 'invited') {
                console.warn('[4 en Raya] La invitación ya no está disponible');
                return;
            }

            // Actualizar estado a 'playing'
            await gameRef.update({
                status: 'playing'
            });

            console.log('[4 en Raya] Invitación aceptada');

            // Eliminar mensaje de invitación de la UI
            removeInvitationMessage(gameId);

            // Mostrar tablero (se mostrará automáticamente por el listener)

        } catch (error) {
            console.error('[4 en Raya] Error al aceptar invitación:', error);
            alert('Error al aceptar invitación: ' + error.message);
        }
    }

    // ===== FUNCIÓN: RECHAZAR INVITACIÓN =====
    async function handleRejectInvitation(gameId) {
        try {
            const gameRef = db.collection('games').doc(gameId);
            const gameDoc = await gameRef.get();

            if (!gameDoc.exists) {
                return;
            }

            const gameData = gameDoc.data();
            const inviterName = await getUserName(gameData.invitedBy);

            // Eliminar juego de Firebase
            await gameRef.delete();

            console.log('[4 en Raya] Invitación rechazada');

            // Eliminar mensaje de invitación
            removeInvitationMessage(gameId);

            // Mostrar mensaje de rechazo en el chat
            renderSystemMessage(`${currentUserName} rechazó la invitación`);

        } catch (error) {
            console.error('[4 en Raya] Error al rechazar invitación:', error);
        }
    }

    // ===== FUNCIÓN: ELIMINAR MENSAJE DE INVITACIÓN =====
    function removeInvitationMessage(gameId) {
        const invitation = document.querySelector(`.game-invitation-message[data-game-id="${gameId}"]`);
        if (invitation) {
            invitation.remove();
        }
    }

    // ===== FUNCIÓN: RENDERIZAR MENSAJE DEL SISTEMA =====
    function renderSystemMessage(text) {
        const messagesDiv = document.getElementById('messages');
        if (!messagesDiv) return;

        const systemMsg = document.createElement('div');
        systemMsg.className = 'message system-message';
        systemMsg.style.textAlign = 'center';
        systemMsg.style.fontStyle = 'italic';
        systemMsg.style.color = '#666';
        systemMsg.textContent = text;

        messagesDiv.appendChild(systemMsg);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    // ===== FUNCIÓN: OBTENER NOMBRE DE USUARIO =====
    async function getUserName(userId) {
        try {
            const userDoc = await db.collection('users').doc(userId).get();
            if (userDoc.exists) {
                return userDoc.data().userName || userId;
            }
            return userId;
        } catch (error) {
            console.error('[4 en Raya] Error al obtener nombre:', error);
            return userId;
        }
    }

    // ===== FUNCIÓN: CARGAR JUEGO PARA CHAT ACTUAL =====
    async function loadGameForCurrentChat(chatId) {
        if (!chatId) {
            hideGameBoard();
            return;
        }

        try {
            // Desuscribir listener anterior si existe
            if (gameListener) {
                gameListener();
                gameListener = null;
            }

            currentGameId = chatId;

            // Suscribirse a cambios en tiempo real
            gameListener = db.collection('games').doc(chatId)
                .onSnapshot(async (snapshot) => {
                    if (!snapshot.exists) {
                        hideGameBoard();
                        return;
                    }

                    const gameData = snapshot.data();

                    // Determinar mi rol
                    if (gameData.players.red === currentUserId) {
                        myRole = 'red';
                    } else if (gameData.players.yellow === currentUserId) {
                        myRole = 'yellow';
                    }

                    // Mostrar tablero si está jugando
                    if (gameData.status === 'playing') {
                        showGameBoard(gameData);
                    } else if (gameData.status === 'invited') {
                        // Mostrar invitación si soy el invitado
                        if (gameData.players.yellow === currentUserId) {
                            hideGameBoard();
                            // La invitación ya debería estar en los mensajes
                        } else {
                            // Soy el invitador, esperar respuesta
                            hideGameBoard();
                        }
                    } else {
                        hideGameBoard();
                    }
                }, (error) => {
                    console.error('[4 en Raya] Error en listener:', error);
                });

        } catch (error) {
            console.error('[4 en Raya] Error al cargar juego:', error);
        }
    }

    // ===== FUNCIÓN: MOSTRAR TABLERO =====
    function showGameBoard(gameData) {
        if (!gameContainer || !gameBoardElement) return;

        // Mostrar contenedor
        gameContainer.style.display = 'flex';

        // Ocultar mensajes
        const messagesDiv = document.getElementById('messages');
        if (messagesDiv) {
            Array.from(messagesDiv.children).forEach(child => {
                if (child.id !== 'game-container') {
                    child.style.display = 'none';
                }
            });
        }

        // Renderizar tablero
        renderBoard(gameData.board, gameData.currentTurn, gameData.status, gameData.winner);

        // Actualizar indicador de turno
        updateTurnIndicator(gameData.currentTurn, gameData.status, gameData.winner);
    }

    // ===== FUNCIÓN: OCULTAR TABLERO =====
    function hideGameBoard() {
        if (!gameContainer) return;

        gameContainer.style.display = 'none';

        // Mostrar mensajes
        const messagesDiv = document.getElementById('messages');
        if (messagesDiv) {
            Array.from(messagesDiv.children).forEach(child => {
                if (child.id !== 'game-container') {
                    child.style.display = '';
                }
            });
        }
    }

    // ===== FUNCIÓN: RENDERIZAR TABLERO =====
    function renderBoard(flatBoard, currentTurn, status, winner) {
        if (!gameBoardElement) return;

        // ✅ Convertir array plano a 2D
        const board = flatTo2D(flatBoard);

        gameBoardElement.innerHTML = '';

        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell-online';
                cell.dataset.row = row;
                cell.dataset.col = col;

                // Añadir ficha si la celda está ocupada
                if (board[row][col] !== EMPTY) {
                    const chip = document.createElement('div');
                    chip.className = `chip-online ${board[row][col] === PLAYER_RED ? 'red' : 'yellow'}`;
                    cell.appendChild(chip);
                    cell.classList.add('filled');
                }

                // Deshabilitar si no es mi turno o el juego terminó
                const isMyTurn = currentTurn === currentUserId;
                const gameActive = status === 'playing' && !winner;

                if (!isMyTurn || !gameActive) {
                    cell.classList.add('disabled');
                } else {
                    // Evento de clic solo si es mi turno
                    cell.addEventListener('click', () => handleCellClick(col));
                }

                gameBoardElement.appendChild(cell);
            }
        }
    }

    // ===== FUNCIÓN: MANEJAR CLIC EN CELDA =====
    async function handleCellClick(col) {
        if (!currentGameId) return;

        try {
            const gameRef = db.collection('games').doc(currentGameId);
            const gameDoc = await gameRef.get();

            if (!gameDoc.exists) return;

            const gameData = gameDoc.data();

            // Verificar que es mi turno
            if (gameData.currentTurn !== currentUserId) {
                console.warn('[4 en Raya] No es tu turno');
                return;
            }

            // Verificar que el juego está activo
            if (gameData.status !== 'playing' || gameData.winner) {
                return;
            }

            // ✅ Convertir array plano a 2D
            const board = flatTo2D(gameData.board);

            // Buscar fila más baja disponible
            const row = getLowestEmptyRow(board, col);
            if (row === -1) {
                console.warn('[4 en Raya] Columna llena');
                return;
            }

            // Determinar valor del jugador
            const playerValue = myRole === 'red' ? PLAYER_RED : PLAYER_YELLOW;

            // Actualizar tablero
            board[row][col] = playerValue;

            // ✅ Convertir de vuelta a array plano
            const newFlatBoard = board2DToFlat(board);

            // Determinar siguiente jugador
            const nextPlayer = gameData.players.red === currentUserId 
                ? gameData.players.yellow 
                : gameData.players.red;

            // Verificar victoria
            const hasWon = checkWin(board, row, col);
            const isTie = checkTie(board);

            // Preparar actualización
            const updateData = {
                board: newFlatBoard,  // ✅ Guardar array plano
                currentTurn: hasWon || isTie ? null : nextPlayer,
                lastMove: {
                    row: row,
                    col: col,
                    player: currentUserId,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                }
            };

            if (hasWon) {
                updateData.status = 'finished';
                updateData.winner = currentUserId;
            } else if (isTie) {
                updateData.status = 'finished';
                updateData.winner = 'tie';
            }

            // Actualizar en Firebase
            await gameRef.update(updateData);

            console.log('[4 en Raya] Movimiento realizado');

        } catch (error) {
            console.error('[4 en Raya] Error al hacer movimiento:', error);
        }
    }

    // ===== FUNCIÓN: OBTENER FILA MÁS BAJA DISPONIBLE =====
    function getLowestEmptyRow(board, col) {
        for (let row = ROWS - 1; row >= 0; row--) {
            if (board[row][col] === EMPTY) {
                return row;
            }
        }
        return -1;
    }

    // ===== FUNCIÓN: VERIFICAR VICTORIA =====
    function checkWin(board, row, col) {
        const player = board[row][col];
        if (player === EMPTY) return false;

        // Verificar horizontal
        if (checkDirection(board, row, col, 0, 1, player)) return true;
        // Verificar vertical
        if (checkDirection(board, row, col, 1, 0, player)) return true;
        // Verificar diagonal ascendente
        if (checkDirection(board, row, col, 1, 1, player)) return true;
        // Verificar diagonal descendente
        if (checkDirection(board, row, col, 1, -1, player)) return true;

        return false;
    }

    // ===== FUNCIÓN: VERIFICAR DIRECCIÓN =====
    function checkDirection(board, row, col, deltaRow, deltaCol, player) {
        let count = 1;
        count += countInDirection(board, row, col, deltaRow, deltaCol, player);
        count += countInDirection(board, row, col, -deltaRow, -deltaCol, player);
        return count >= 4;
    }

    // ===== FUNCIÓN: CONTAR EN DIRECCIÓN =====
    function countInDirection(board, row, col, deltaRow, deltaCol, player) {
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
    function checkTie(board) {
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
    async function updateTurnIndicator(currentTurn, status, winner) {
        const indicator = document.getElementById('current-player-game');
        const messageContainer = document.getElementById('game-message-container');

        if (!indicator || !messageContainer) return;

        messageContainer.className = 'game-message-container';
        messageContainer.textContent = '';

        if (status === 'finished') {
            if (winner === 'tie') {
                indicator.textContent = 'Juego terminado';
                messageContainer.textContent = '🤝 ¡Empate!';
                messageContainer.classList.add('tie');
            } else {
                const winnerName = await getUserName(winner);
                const isWinner = winner === currentUserId;
                indicator.textContent = 'Juego terminado';
                messageContainer.textContent = isWinner 
                    ? '🎉 ¡Ganaste!'
                    : `🎉 ¡Ganó ${winnerName}!`;
                messageContainer.classList.add('winner');
            }
        } else {
            const isMyTurn = currentTurn === currentUserId;
            const turnPlayerName = await getUserName(currentTurn);
            
            if (isMyTurn) {
                indicator.textContent = `Es tu turno (${myRole === 'red' ? '🔴 Rojas' : '🟡 Amarillas'})`;
            } else {
                indicator.textContent = `Turno de ${turnPlayerName} (${myRole === 'red' ? '🟡 Amarillas' : '🔴 Rojas'})`;
            }
        }
    }

    // ===== FUNCIÓN: CERRAR JUEGO (ABANDONAR) =====
    async function handleCloseGame() {
        if (!currentGameId) return;

        const confirmClose = confirm('¿Estás seguro de que quieres cerrar el juego? Esto contará como abandono y el otro jugador ganará.');
        if (!confirmClose) return;

        try {
            const gameRef = db.collection('games').doc(currentGameId);
            const gameDoc = await gameRef.get();

            if (!gameDoc.exists) {
                hideGameBoard();
                return;
            }

            const gameData = gameDoc.data();
            const closedBy = gameData.closedBy || [];

            // Añadir mi ID a la lista de usuarios que han cerrado
            if (!closedBy.includes(currentUserId)) {
                closedBy.push(currentUserId);
            }

            // Si el juego todavía está en progreso, el otro gana
            if (gameData.status === 'playing') {
                const otherPlayer = gameData.players.red === currentUserId 
                    ? gameData.players.yellow 
                    : gameData.players.red;

                await gameRef.update({
                    status: 'finished',
                    winner: otherPlayer,
                    closedBy: closedBy
                });

                // Mostrar mensaje
                renderSystemMessage('Has abandonado la partida');
            } else {
                // Solo actualizar closedBy
                await gameRef.update({
                    closedBy: closedBy
                });
            }

            // Si ambos han cerrado, eliminar el juego
            if (closedBy.length >= 2) {
                await gameRef.delete();
                console.log('[4 en Raya] Partida eliminada (ambos cerraron)');
            }

            hideGameBoard();

        } catch (error) {
            console.error('[4 en Raya] Error al cerrar juego:', error);
        }
    }

    // ===== FUNCIONES PÚBLICAS (llamadas desde app.js) =====

    // Llamada cuando se abre un chat
    window.loadGameForChat = function(chatId) {
        loadGameForCurrentChat(chatId);
    };

    // Llamada cuando se cierra sesión
    window.cleanupGameListeners = function() {
        if (gameListener) {
            gameListener();
            gameListener = null;
        }
        currentGameId = null;
        myRole = null;
        hideGameBoard();
    };

    // Mostrar/ocultar botón de juego (llamado desde app.js al hacer login/logout)
    window.showGameButton = function() {
        if (openGameBtn) {
            openGameBtn.style.display = 'flex';
        }
    };

    window.hideGameButton = function() {
        if (openGameBtn) {
            openGameBtn.style.display = 'none';
        }
    };

})();