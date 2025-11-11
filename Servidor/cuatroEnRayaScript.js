/* ========================================
   CUATRO EN RAYA ONLINE - LÓGICA DEL JUEGO
   Versión Multijugador con Firebase Firestore
   ======================================== */

(function () {
    'use strict';

    // ===== ACCESO A FIREBASE (desde app.js) =====
    // db, currentUserId, currentUserName y currentChatId son variables globales de app.js

    // ===== CONSTANTES DEL JUEGO =====
    const ROWS = 6;
    const COLS = 7;
    const EMPTY = 0;
    const PLAYER_RED = 1;
    const PLAYER_YELLOW = 2;

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
    let gameListener = null;
    let currentGameId = null;
    let myRole = null;
    let gameContainer = null;
    let gameBoardElement = null;
    let openGameBtn = null;
    let lastRenderedBoard = null; // ✅ Para detectar fichas nuevas

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

        openGameBtn.addEventListener('click', handleGameButtonClick);

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
            const gameRef = db.collection('games').doc(currentChatId);
            const gameDoc = await gameRef.get();

            if (gameDoc.exists) {
                const gameData = gameDoc.data();
                if (gameData.status === 'invited' || gameData.status === 'playing') {
                    console.log('[4 en Raya] Ya hay una partida activa en este chat');
                    return;
                }
            }

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
            const chatParticipants = currentChatId.split('_');
            const partnerId = chatParticipants.find(id => id !== currentUserId);
            const flatBoard = new Array(ROWS * COLS).fill(EMPTY);

            // Crear documento de juego
            await db.collection('games').doc(gameId).set({
                players: {
                    red: currentUserId,
                    yellow: partnerId
                },
                board: flatBoard,
                currentTurn: currentUserId,
                status: 'invited',
                winner: null,
                invitedBy: currentUserId,
                invitedAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastMove: null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                closedBy: []
            });

            // ✅ CAMBIO 1: Enviar mensaje de invitación a Firebase
            await db.collection('chats').doc(currentChatId).collection('messages').add({
                senderId: currentUserId,
                senderName: currentUserName,
                text: '',
                messageType: 'game-invitation', // ✅ Tipo especial
                gameId: gameId,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            console.log('[4 en Raya] Invitación enviada');

        } catch (error) {
            console.error('[4 en Raya] Error al enviar invitación:', error);
            alert('Error al enviar invitación: ' + error.message);
        }
    }

    // ===== FUNCIÓN: ACEPTAR INVITACIÓN =====
    async function handleAcceptInvitation(gameId, messageDocId) {
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

            // ✅ NUEVO: Marcar el mensaje como procesado en Firebase
            await db.collection('chats').doc(gameId)
                .collection('messages').doc(messageDocId)
                .update({
                    processed: true
                });

            console.log('[4 en Raya] ✅ Mensaje marcado como procesado en Firebase');

            // Actualizar estado del juego
            await gameRef.update({
                status: 'playing'
            });

            console.log('[4 en Raya] Invitación aceptada');

        } catch (error) {
            console.error('[4 en Raya] Error al aceptar invitación:', error);
            alert('Error al aceptar invitación: ' + error.message);
        }
    }

    // ===== FUNCIÓN: RECHAZAR INVITACIÓN =====
    async function handleRejectInvitation(gameId, messageDocId) {
        try {
            const gameRef = db.collection('games').doc(gameId);
            const gameDoc = await gameRef.get();

            if (!gameDoc.exists) return;

            const gameData = gameDoc.data();

            // ✅ NUEVO: Marcar el mensaje como procesado en Firebase
            await db.collection('chats').doc(gameId)
                .collection('messages').doc(messageDocId)
                .update({
                    processed: true
                });

            console.log('[4 en Raya] ✅ Mensaje marcado como procesado en Firebase');

            // Enviar mensajes personalizados a Firebase
            const chatRef = db.collection('chats').doc(gameId);
            
            await chatRef.collection('messages').add({
                senderId: currentUserId,
                senderName: currentUserName,
                text: 'Has rechazado la invitación',
                messageType: 'game-system',
                visibleTo: currentUserId,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            await chatRef.collection('messages').add({
                senderId: 'system',
                senderName: 'Sistema',
                text: `${currentUserName} ha rechazado la invitación`,
                messageType: 'game-system',
                visibleTo: gameData.invitedBy,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            await gameRef.delete();

            console.log('[4 en Raya] Invitación rechazada');

        } catch (error) {
            console.error('[4 en Raya] Error al rechazar invitación:', error);
        }
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
            if (gameListener) {
                gameListener();
                gameListener = null;
            }

            currentGameId = chatId;

            gameListener = db.collection('games').doc(chatId)
                .onSnapshot(async (snapshot) => {
                    if (!snapshot.exists) {
                        hideGameBoard();
                        return;
                    }

                    const gameData = snapshot.data();

                    if (gameData.players.red === currentUserId) {
                        myRole = 'red';
                    } else if (gameData.players.yellow === currentUserId) {
                        myRole = 'yellow';
                    }

                    // ✅ CORREGIDO: NO mostrar el tablero si el juego terminó Y el usuario ya lo cerró
                    if (gameData.status === 'finished') {
                        const closedBy = gameData.closedBy || [];
                        if (closedBy.includes(currentUserId)) {
                            // El usuario ya cerró este juego terminado
                            hideGameBoard();
                            return;
                        }
                        // Si no ha cerrado, mostrar el tablero con el resultado
                        showGameBoard(gameData);
                    } else if (gameData.status === 'playing') {
                        showGameBoard(gameData);
                    } else if (gameData.status === 'invited') {
                        hideGameBoard();
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

        // ✅ Ocultar el contenedor de mensajes
        const messagesDiv = document.getElementById('messages');
        if (messagesDiv) {
            messagesDiv.style.display = 'none';
        }

        // ✅ Mostrar el contenedor del juego
        gameContainer.style.display = 'flex';

        renderBoard(gameData.board, gameData.currentTurn, gameData.status, gameData.winner, gameData.lastMove);
        updateTurnIndicator(gameData.currentTurn, gameData.status, gameData.winner);
    }

    // ===== FUNCIÓN: OCULTAR TABLERO =====
    function hideGameBoard() {
        if (!gameContainer) return;

        // ✅ Ocultar el contenedor del juego
        gameContainer.style.display = 'none';

        // ✅ Mostrar el contenedor de mensajes
        const messagesDiv = document.getElementById('messages');
        if (messagesDiv) {
            messagesDiv.style.display = '';

            // ✅ Scroll automático al final
            setTimeout(() => {
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            }, 50);
        }
    }

    // ===== FUNCIÓN: RENDERIZAR TABLERO =====
    function renderBoard(flatBoard, currentTurn, status, winner, lastMove) {
        if (!gameBoardElement) return;

        const board = flatTo2D(flatBoard);
        gameBoardElement.innerHTML = '';

        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell-online';
                cell.dataset.row = row;
                cell.dataset.col = col;

                if (board[row][col] !== EMPTY) {
                    const chip = document.createElement('div');
                    chip.className = `chip-online ${board[row][col] === PLAYER_RED ? 'red' : 'yellow'}`;

                    // ✅ CAMBIO 3: Añadir animación solo a la última ficha
                    if (lastMove && lastMove.row === row && lastMove.col === col) {
                        chip.classList.add('drop-animation');
                    }

                    cell.appendChild(chip);
                    cell.classList.add('filled');
                }

                const isMyTurn = currentTurn === currentUserId;
                const gameActive = status === 'playing' && !winner;

                if (!isMyTurn || !gameActive) {
                    cell.classList.add('disabled');
                } else {
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

            if (gameData.currentTurn !== currentUserId) {
                console.warn('[4 en Raya] No es tu turno');
                return;
            }

            if (gameData.status !== 'playing' || gameData.winner) {
                return;
            }

            const board = flatTo2D(gameData.board);
            const row = getLowestEmptyRow(board, col);

            if (row === -1) {
                console.warn('[4 en Raya] Columna llena');
                return;
            }

            const playerValue = myRole === 'red' ? PLAYER_RED : PLAYER_YELLOW;
            board[row][col] = playerValue;
            const newFlatBoard = board2DToFlat(board);

            const nextPlayer = gameData.players.red === currentUserId
                ? gameData.players.yellow
                : gameData.players.red;

            const hasWon = checkWin(board, row, col);
            const isTie = checkTie(board);

            const updateData = {
                board: newFlatBoard,
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

            // ✅ Actualizar primero el juego
            await gameRef.update(updateData);

            // ✅ MODIFICADO: Enviar mensaje de finalización al chat con NOMBRE del ganador
            const chatRef = db.collection('chats').doc(currentGameId);

            if (hasWon) {
                // Obtener el nombre del ganador (que soy yo en este caso)
                const winnerName = await getUserName(currentUserId);
                
                await chatRef.collection('messages').add({
                    senderId: 'system',
                    senderName: 'Sistema',
                    text: `🎉 ¡Ganó ${winnerName}!`,
                    messageType: 'game-system',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else if (isTie) {
                await chatRef.collection('messages').add({
                    senderId: 'system',
                    senderName: 'Sistema',
                    text: '🤝 ¡Empate!',
                    messageType: 'game-system',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

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

        if (checkDirection(board, row, col, 0, 1, player)) return true;
        if (checkDirection(board, row, col, 1, 0, player)) return true;
        if (checkDirection(board, row, col, 1, 1, player)) return true;
        if (checkDirection(board, row, col, 1, -1, player)) return true;

        return false;
    }

    function checkDirection(board, row, col, deltaRow, deltaCol, player) {
        let count = 1;
        count += countInDirection(board, row, col, deltaRow, deltaCol, player);
        count += countInDirection(board, row, col, -deltaRow, -deltaCol, player);
        return count >= 4;
    }

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
                indicator.textContent = '🤝 ¡Empate!';
                indicator.style.fontSize = '24px';
                indicator.style.fontWeight = 'bold';
                indicator.style.color = '#ff9800';
            } else {
                const gameRef = db.collection('games').doc(currentGameId);
                const gameDoc = await gameRef.get();
                
                if (gameDoc.exists) {
                    const gameData = gameDoc.data();
                    const winnerColor = gameData.players.red === winner ? 'Rojas' : 'Amarillas';
                    
                    indicator.textContent = `🎉 ¡Ganan las ${winnerColor}!`;
                    indicator.style.fontSize = '24px';
                    indicator.style.fontWeight = 'bold';
                    indicator.style.color = winnerColor === 'Rojas' ? '#c92a2a' : '#f0a500';
                }
            }
        } else {
            // ✅ Restablecer estilos para juego activo
            indicator.style.fontSize = '';
            indicator.style.fontWeight = '';
            indicator.style.color = '';
            
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

        try {
            const gameRef = db.collection('games').doc(currentGameId);
            const gameDoc = await gameRef.get();

            if (!gameDoc.exists) {
                hideGameBoard();
                return;
            }

            const gameData = gameDoc.data();
            const closedBy = gameData.closedBy || [];

            // ✅ SIEMPRE añadir el usuario actual a closedBy
            if (!closedBy.includes(currentUserId)) {
                closedBy.push(currentUserId);
            }

            // ✅ Si el juego ya terminó, solo actualizar closedBy y cerrar tablero
            if (gameData.status === 'finished') {
                console.log('[4 en Raya] Cerrando tablero de partida terminada');
                
                await gameRef.update({
                    closedBy: closedBy
                });

                // Si ambos cerraron, eliminar el juego
                if (closedBy.length >= 2) {
                    await gameRef.delete();
                    console.log('[4 en Raya] Partida eliminada (ambos cerraron)');
                }

                hideGameBoard();
                return;
            }

            // Si el juego está en curso, confirmar abandono
            const confirmClose = confirm('¿Estás seguro de que quieres cerrar el juego? Esto contará como abandono y el otro jugador ganará.');
            if (!confirmClose) return;

            const otherPlayer = gameData.players.red === currentUserId
                ? gameData.players.yellow
                : gameData.players.red;

            await gameRef.update({
                status: 'finished',
                winner: otherPlayer,
                closedBy: closedBy
            });

            // Mensajes personalizados al abandonar
            const chatRef = db.collection('chats').doc(currentGameId);

            await chatRef.collection('messages').add({
                senderId: currentUserId,
                senderName: currentUserName,
                text: 'Has abandonado la partida',
                messageType: 'game-system',
                visibleTo: currentUserId,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            await chatRef.collection('messages').add({
                senderId: 'system',
                senderName: 'Sistema',
                text: `${currentUserName} ha abandonado la partida`,
                messageType: 'game-system',
                visibleTo: otherPlayer,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            if (closedBy.length >= 2) {
                await gameRef.delete();
                console.log('[4 en Raya] Partida eliminada (ambos cerraron)');
            }

            hideGameBoard();

        } catch (error) {
            console.error('[4 en Raya] Error al cerrar juego:', error);
        }
    }

    // ===== FUNCIONES PÚBLICAS =====
    window.loadGameForChat = function (chatId) {
        loadGameForCurrentChat(chatId);
    };

    window.cleanupGameListeners = function () {
        if (gameListener) {
            gameListener();
            gameListener = null;
        }
        currentGameId = null;
        myRole = null;
        hideGameBoard();
    };

    window.showGameButton = function () {
        if (openGameBtn) {
            openGameBtn.style.display = 'flex';
        }
    };

    window.hideGameButton = function () {
        if (openGameBtn) {
            openGameBtn.style.display = 'none';
        }
    };

    window.renderGameInvitationFromMessage = function (messageElement, messageData, messageDocId) {
        const isInviter = messageData.senderId === currentUserId;

        // Añadir data-message-id al elemento
        messageElement.setAttribute('data-message-id', messageDocId);

        // ✅ NUEVO: Verificar si ya fue procesada
        if (messageData.processed) {
            // Si fue procesada, mostrar solo el texto sin botones (SIN mensaje adicional)
            messageElement.innerHTML = `    <div class="message-header">
                    <strong>${messageData.senderName}</strong>
                </div>
                <div class="game-invitation-text">
                    🎮 ${isInviter ? 'Invitaste a jugar Cuatro en Raya' : 'Te invitó a jugar Cuatro en Raya' }
                </div>
            `;
            return;
        }

        // Mensaje sin procesar (lógica original)
        if (isInviter) {
            messageElement.innerHTML = `
                <div class="message-header">
                    <strong>${messageData.senderName}</strong>
                </div>
                <div class="game-invitation-text">
                    🎮 Invitaste a jugar Cuatro en Raya
                </div>
            `;
        } else {
            // Quien recibe ve los botones
            messageElement.innerHTML = `
                <div class="message-header">
                    <strong>${messageData.senderName}</strong>
                </div>
                <div class="game-invitation-text">
                    🎮 Te invitó a jugar Cuatro en Raya
                </div>
                <div class="invitation-buttons">
                    <button class="accept-game-btn">Aceptar</button>
                    <button class="reject-game-btn">Rechazar</button>
                </div>
            `;

            const acceptBtn = messageElement.querySelector('.accept-game-btn');
            const rejectBtn = messageElement.querySelector('.reject-game-btn');

            if (acceptBtn) {
                acceptBtn.addEventListener('click', () => handleAcceptInvitation(messageData.gameId, messageDocId));
            }
            if (rejectBtn) {
                rejectBtn.addEventListener('click', () => handleRejectInvitation(messageData.gameId, messageDocId));
            }
        }
    };

    //Exportar funciones para pruebas unitarias
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            flatTo2D,
            board2DToFlat,
            checkWin,
            checkTie
        };
    }

})();