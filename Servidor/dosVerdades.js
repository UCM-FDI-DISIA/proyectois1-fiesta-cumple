(function () {
    'use strict';

    let openBtn = null;
    let modal = null;

    document.addEventListener('DOMContentLoaded', () => {
        openBtn = document.getElementById('open-dosverdades-btn');
        // Solo añadir listener si existe el botón antiguo (compatibilidad)
        if (openBtn) {
            openBtn.addEventListener('click', openDosVerdadesModal);
        }
    });

    function createModalIfNeeded() {
        if (modal) return;

        modal = document.createElement('div');
        modal.id = 'dosverdades-modal';
        modal.className = 'dv-modal';
        modal.innerHTML = `
            <div class="dv-backdrop" id="dv-backdrop"></div>
            <div class="dv-dialog">
                <h3>Dos Verdades y Una Mentira</h3>
                <p>Escribe tres frases y marca cuál es la mentira.</p>
                <div class="dv-inputs">
                    <label>Frase 1 <input type="text" id="dv-phrase-0" placeholder="Frase 1"></label>
                    <label>Frase 2 <input type="text" id="dv-phrase-1" placeholder="Frase 2"></label>
                    <label>Frase 3 <input type="text" id="dv-phrase-2" placeholder="Frase 3"></label>
                </div>
                <div class="dv-choose-lie">
                    <label><input type="radio" name="dv-lie" value="0"> Mentira: 1</label>
                    <label><input type="radio" name="dv-lie" value="1"> Mentira: 2</label>
                    <label><input type="radio" name="dv-lie" value="2"> Mentira: 3</label>
                </div>
                <div class="dv-actions">
                    <button id="dv-send-btn">Enviar</button>
                    <button id="dv-cancel-btn">Cancelar</button>
                </div>
                <div id="dv-error" class="dv-error"></div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('#dv-backdrop').addEventListener('click', closeDosVerdadesModal);
        modal.querySelector('#dv-cancel-btn').addEventListener('click', closeDosVerdadesModal);
        modal.querySelector('#dv-send-btn').addEventListener('click', sendDosVerdades);
    }

    function openDosVerdadesModal() {
        if (!currentChatId) {
            alert('Selecciona un chat antes de iniciar el juego.');
            return;
        }
        // Comprobar si el partner nos ha bloqueado: impedir abrir modal
        try {
            if (typeof window.partnerHasBlockedMe !== 'undefined' && window.partnerHasBlockedMe) {
                alert('No puedes iniciar Dos Verdades: este usuario te ha bloqueado.');
                return;
            }
            const chatParticipants = currentChatId.split('_');
            const partnerId = chatParticipants.find(id => id !== currentUserId);
            if (partnerId) {
                const partnerDoc = await db.collection('users').doc(partnerId).get();
                if (partnerDoc.exists) {
                    const pData = partnerDoc.data() || {};
                    if (Array.isArray(pData.blockedUsers) && pData.blockedUsers.includes(currentUserId)) {
                        window.partnerHasBlockedMe = true;
                        alert('No puedes iniciar Dos Verdades: este usuario te ha bloqueado.');
                        return;
                    }
                }
            }
        } catch (err) {
            console.warn('openDosVerdadesModal: error comprobando bloqueo del partner', err);
        }
        createModalIfNeeded();
        modal.style.display = 'block';
        // reset fields
        for (let i = 0; i < 3; i++) {
            const inp = document.getElementById('dv-phrase-' + i);
            if (inp) inp.value = '';
        }
        const radios = modal.querySelectorAll('input[name="dv-lie"]');
        radios.forEach(r => r.checked = false);
        const err = document.getElementById('dv-error'); if (err) err.textContent = '';
    }

    function closeDosVerdadesModal() {
        if (!modal) return;
        modal.style.display = 'none';
    }

    async function sendDosVerdades() {
        // Safety: comprobar bloqueo del partner en servidor antes de enviar
        try {
            if (typeof window.partnerHasBlockedMe !== 'undefined' && window.partnerHasBlockedMe) {
                alert('No puedes enviar Dos Verdades: este usuario te ha bloqueado.');
                return;
            }
            const chatParticipants = currentChatId.split('_');
            const partnerId = chatParticipants.find(id => id !== currentUserId);
            if (partnerId) {
                const partnerDoc = await db.collection('users').doc(partnerId).get();
                if (partnerDoc.exists) {
                    const pData = partnerDoc.data() || {};
                    if (Array.isArray(pData.blockedUsers) && pData.blockedUsers.includes(currentUserId)) {
                        window.partnerHasBlockedMe = true;
                        alert('No puedes enviar Dos Verdades: este usuario te ha bloqueado.');
                        return;
                    }
                }
            }
        } catch (err) {
            console.warn('sendDosVerdades: error comprobando bloqueo del partner', err);
        }
        const phrases = [];
        for (let i = 0; i < 3; i++) {
            const v = document.getElementById('dv-phrase-' + i).value.trim();
            phrases.push(v);
        }
        const radios = modal.querySelector('input[name="dv-lie"]:checked');
        const err = document.getElementById('dv-error');
        if (!phrases[0] || !phrases[1] || !phrases[2]) {
            if (err) err.textContent = 'Por favor rellena las tres frases.';
            return;
        }
        if (!radios) {
            if (err) err.textContent = 'Marca cuál de las frases es la mentira.';
            return;
        }

        const lieIndex = parseInt(radios.value, 10);

        try {
            await db.collection('chats').doc(currentChatId).collection('messages').add({
                senderId: currentUserId,
                senderName: currentUserName,
                text: '',
                messageType: 'dosverdades',
                phrases: phrases,
                lieIndex: lieIndex,
                processed: false,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                readBy: [currentUserId]
            });

            closeDosVerdadesModal();
        } catch (err) {
            console.error('Error enviando Dos Verdades:', err);
            if (err) (document.getElementById('dv-error')).textContent = 'Error al enviar: ' + err.message;
        }
    }

    // Render function llamado desde app.js cuando se cargan mensajes
    window.renderDosVerdadesFromMessage = function (messageElement, messageData, messageDocId) {
        const isSender = messageData.senderId === currentUserId;
        messageElement.setAttribute('data-message-id', messageDocId);

        // Si ya fue procesado mostramos resumen del resultado
        if (messageData.processed) {
            const guesser = messageData.guesserName || messageData.guesserId || 'Alguien';
            const correct = !!messageData.correct;
            const resultText = correct ? `${guesser} acertó la mentira ✅` : `${guesser} falló ❌`;

            // Build phrases with highlight: correct in green, wrong chosen in red
            const phraseHtml = messageData.phrases.map((p, idx) => {
                const classes = ['dv-phrase'];
                if (idx === messageData.lieIndex) classes.push('dv-correct');
                if (typeof messageData.guessIndex !== 'undefined' && messageData.guessIndex !== null && idx === messageData.guessIndex && messageData.guessIndex !== messageData.lieIndex) classes.push('dv-wrong');
                return `<div class="${classes.join(' ')}">${idx + 1}. ${escapeHtml(p)}</div>`;
            }).join('');

            messageElement.innerHTML = `
                <div class="message-header"><strong>${messageData.senderName}</strong></div>
                <div class="dv-summary">🎲 Dos Verdades y Una Mentira · Resultado: ${resultText}</div>
                <div class="dv-phrases">${phraseHtml}</div>
            `;
            return;
        }

        // If sender, show a simple message listing the three phrases
        if (isSender) {
            messageElement.innerHTML = `
                <div class="message-header"><strong>${messageData.senderName}</strong></div>
                <div class="dv-sent">🎲 Propusiste Dos Verdades y Una Mentira</div>
                <div class="dv-phrases">
                    <div class="dv-phrase">1. ${escapeHtml(messageData.phrases[0])}</div>
                    <div class="dv-phrase">2. ${escapeHtml(messageData.phrases[1])}</div>
                    <div class="dv-phrase">3. ${escapeHtml(messageData.phrases[2])}</div>
                </div>
            `;
            return;
        }

        // Else: render interactive choices for the other user
        const html = `
            <div class="message-header"><strong>${messageData.senderName}</strong></div>
            <div class="dv-invite">🎲 Te han retado a adivinar la mentira</div>
            <div class="dv-phrases">
                <button class="dv-choose" data-index="0">1. ${escapeHtml(messageData.phrases[0])}</button>
                <button class="dv-choose" data-index="1">2. ${escapeHtml(messageData.phrases[1])}</button>
                <button class="dv-choose" data-index="2">3. ${escapeHtml(messageData.phrases[2])}</button>
            </div>
        `;

        messageElement.innerHTML = html;

        // Attach events
        const buttons = messageElement.querySelectorAll('.dv-choose');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => submitGuess(messageDocId, parseInt(btn.dataset.index, 10)));
        });
    };

    async function submitGuess(messageDocId, selectedIndex) {
        if (!currentChatId) {
            alert('Chat no seleccionado');
            return;
        }

        // immediate UI feedback: disable buttons to avoid double clicks
        try {
            const messageEl = document.querySelector(`[data-message-id="${messageDocId}"]`);
            if (messageEl) {
                const btns = messageEl.querySelectorAll('.dv-choose');
                btns.forEach(b => b.disabled = true);
            }
        } catch (e) { /* ignore */ }

        const msgRef = db.collection('chats').doc(currentChatId).collection('messages').doc(messageDocId);
        try {
            await db.runTransaction(async (t) => {
                const doc = await t.get(msgRef);
                if (!doc.exists) throw new Error('Mensaje no encontrado');
                const data = doc.data();
                if (data.processed) throw new Error('El juego ya fue respondido');

                const isCorrect = (data.lieIndex === selectedIndex);

                t.update(msgRef, {
                    processed: true,
                    guesserId: currentUserId,
                    guesserName: currentUserName,
                    guessIndex: selectedIndex,
                    correct: isCorrect,
                    processedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                // OPTIONAL: actualizar puntos en el documento del chat
                const chatRef = db.collection('chats').doc(currentChatId);
                if (isCorrect) {
                    t.update(chatRef, {
                        couplePoints: firebase.firestore.FieldValue.increment(1)
                    });
                }
            });

            // Añadir mensaje de sistema con el resultado
            const chatRef2 = db.collection('chats').doc(currentChatId);
            const resultText = (selectedIndex === undefined) ? 'Se ha respondido.' : (selectedIndex === null ? 'No hay respuesta.' : ( (await getUserNamePromise(currentUserId)) + (await getUserNamePromise(currentUserId)) ));

            // Construir texto legible
            const msgDoc = await msgRef.get();
            const updated = msgDoc.data();
            const readable = updated.correct ? `${currentUserName} acertó la mentira ✅` : `${currentUserName} falló ❌`;

            await chatRef2.collection('messages').add({
                senderId: 'system',
                senderName: 'Sistema',
                text: readable,
                messageType: 'game-system',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                readBy: []
            });

            // After transaction the listener will re-render the message with highlights.
            // Optional: if message element still present, update highlights immediately.
            try {
                const messageEl2 = document.querySelector(`[data-message-id="${messageDocId}"]`);
                if (messageEl2) {
                    // apply highlights to phrase buttons / items
                    const children = messageEl2.querySelectorAll('.dv-choose, .dv-phrase');
                    children.forEach((el, idx) => {
                        el.classList.remove('dv-correct', 'dv-wrong');
                        if (idx === updated.lieIndex) el.classList.add('dv-correct');
                        if (typeof updated.guessIndex !== 'undefined' && updated.guessIndex !== null && idx === updated.guessIndex && updated.guessIndex !== updated.lieIndex) el.classList.add('dv-wrong');
                        if (el.tagName.toLowerCase() === 'button') el.disabled = true;
                    });
                }
            } catch (e) { /* ignore */ }

        } catch (err) {
            console.error('Error procesando la respuesta:', err);
            alert(err.message || 'Error al enviar la respuesta');
        }
    }

    // Small helper to escape HTML when inserting phrases
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Helper to fetch username if needed (returns currentUserName quickly)
    async function getUserNamePromise(id) {
        if (id === currentUserId) return currentUserName || id;
        try {
            const doc = await db.collection('users').doc(id).get();
            if (doc.exists) return doc.data().userName || id;
        } catch (e) { /* ignore */ }
        return id;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            sendDosVerdades, 
            renderDosVerdadesFromMessage, 
            submitGuess
        };
    }
    // Exponer función para el menú de juegos
    window.triggerDosVerdades = function() {
        openDosVerdadesModal();
    };
})();
