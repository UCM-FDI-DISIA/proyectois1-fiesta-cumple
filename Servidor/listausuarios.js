/* listausuarios.js
   - Crea un panel que muestra los usuarios guardados en Firestore
   - El panel se controla desde el botón "Lista de Usuarios" de la barra de navegación
   - No crea botón flotante (se eliminó esa funcionalidad)

   Notas:
   - Este archivo debe ser incluido en el HTML *DESPUÉS* de app.js para poder
     usar la variable global `db` (inicializada en app.js).
   - Si `db` no está disponible, se mostrará un error en la consola.
*/

(function () {
    'use strict';

    // Esperamos a que el DOM esté listo
    document.addEventListener('DOMContentLoaded', () => {
        try {
            // Ya NO creamos el botón flotante, solo el panel
            createUsersPanel();
        } catch (err) {
            console.error('[listausuarios] Error inicializando:', err);
        }
    });

    // Crea el panel/modal que mostrará la lista de usuarios
    function createUsersPanel() {
        if (document.getElementById('users-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'users-panel';
        panel.classList.add('hidden');
        
        // Header
        const header = document.createElement('div');

        const title = document.createElement('strong');
        title.textContent = 'Especialmente para ti';

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Cerrar';
        closeBtn.addEventListener('click', () => {
            panel.classList.add('hidden');
        });

        header.appendChild(title);
        header.appendChild(closeBtn);

        // Mensaje de carga / vacío
        const info = document.createElement('div');
        info.id = 'users-info';
        info.textContent = 'Cargando usuarios...';

        // Contenedor de la lista
        const list = document.createElement('div');
        list.id = 'users-list';

        panel.appendChild(header);
        panel.appendChild(info);
        panel.appendChild(list);

        document.body.appendChild(panel);

        // Cerrar el panel si el usuario hace click fuera de él
        document.addEventListener('click', (ev) => {
            try {
                const panelEl = document.getElementById('users-panel');
                const navBtn = document.querySelector('.nav-button');
                if (!panelEl) return;
                const target = ev.target;
                const isPanelOpen = !panelEl.classList.contains('hidden');

                const profileModal = document.getElementById('profileModal');
                const profileBackdrop = document.querySelector('.profile-modal-backdrop');
                const isClickInsideProfileModal = profileModal && profileModal.contains(target);
                const isClickOnProfileBackdrop = profileBackdrop && profileBackdrop.contains(target);

                if (isPanelOpen &&
                    !panelEl.contains(target) &&
                    !target.closest('.nav-button') &&
                    !isClickInsideProfileModal &&  
                    !isClickOnProfileBackdrop) {   
                    panelEl.classList.add('hidden');
                }
            } catch (e) {
                console.warn('[listausuarios] Error en click fuera:', e);
            }
        });
    }

    // Recupera los usuarios desde Firestore y los renderiza en el panel
    async function loadAndRenderUsers() {
        const panel = document.getElementById('users-panel');
        const list = document.getElementById('users-list');
        const info = document.getElementById('users-info');

        if (!panel || !list || !info) return;

        // Limpia la lista e indica carga
        list.innerHTML = '';
        info.textContent = 'Cargando usuarios...';

        // Verificamos que la variable global `db` exista
        if (typeof db === 'undefined' || !db) {
            console.error('[listausuarios] La variable `db` (Firestore) no está disponible.');
            info.textContent = 'Error: Firestore no disponible.';
            return;
        }

        try {
            const snapshot = await db.collection('users').get();
            if (snapshot.empty) {
                info.textContent = 'No hay usuarios registrados.';
                return;
            }

            info.textContent = '';

            const users = [];

            // Obtener IDs de usuarios con los que ya hay un chat abierto
            const openChatPartners = new Set();
            // Obtener la preferencia de género y el género del usuario actual para filtrar resultados
            let myPreference = '';
            let myGender = '';

            // Helpers locales para normalizar valores y detectar "no especificado"
            const normalize = v => (v || '').toString().toLowerCase().trim();
            const stripPunct = s => s.replace(/[\.,!\?;:\(\)\[\]\-]/g, '').trim();
            const singular = s => {
                if (!s) return '';
                if (s === 'ambos') return 'ambos';
                // convertir plurales simples ('hombres' -> 'hombre')
                return s.endsWith('s') ? s.slice(0, -1) : s;
            };
            const isUnspecified = s => {
                if (!s) return true;
                const cleaned = stripPunct(normalize(s));
                const tokens = ['no especificado', 'no especificada', 'sin especificar', 'n/a', 'none', 'unknown', 'unspecified', 'no definido', 'no definida'];
                return tokens.includes(cleaned) || cleaned === '';
            };
            let myBlockedUsers = [];
            try {
                if (typeof currentUserId !== 'undefined' && currentUserId) {
                    // Leer perfil del usuario actual para conocer su preferencia
                    try {
                        const meDoc = await db.collection('users').doc(currentUserId).get();
                        if (meDoc.exists) {
                            const meData = meDoc.data() || {};
                            myPreference = singular(stripPunct(normalize(meData.preference || meData.interests || '')));
                            myGender = singular(stripPunct(normalize(meData.gender || meData.genero || '')));
                            myBlockedUsers = Array.isArray(meData.blockedUsers) ? meData.blockedUsers : [];
                        }
                    } catch (prefErr) {
                        console.warn('[listausuarios] No se pudo leer la preferencia del usuario actual:', prefErr);
                    }
                    const chatsSnap = await db.collection('chats')
                        .where('participants', 'array-contains', currentUserId)
                        .get();

                    chatsSnap.forEach(docChat => {
                        const dataChat = docChat.data() || {};
                        // Si el usuario lo ocultó, comprobar si hay mensajes posteriores a la marca hiddenAt
                        const hiddenAtMap = dataChat.hiddenAt || null;
                        const hiddenAtForMe = hiddenAtMap && hiddenAtMap[currentUserId] ? hiddenAtMap[currentUserId] : null;
                        if (hiddenAtForMe) {
                            // Si no hay mensajes posteriores (lastMessageTime <= hiddenAt), ignorar este chat
                            if (!dataChat.lastMessageTime || (dataChat.lastMessageTime && dataChat.lastMessageTime.toMillis() <= hiddenAtForMe.toMillis())) {
                                return; // no consideramos que exista chat abierto para efectos de Descubre gente
                            }
                        }
                        const parts = Array.isArray(dataChat.participants) ? dataChat.participants : [];
                        parts.forEach(p => {
                            if (p && p !== currentUserId) openChatPartners.add(p);
                        });
                    });
                }
            } catch (e) {
                console.warn('[listausuarios] No se pudieron leer los chats para filtrar:', e);
            }

            // Si el usuario actual no tiene género especificado, mostramos aviso y no listamos usuarios
            if (!myGender) {
                info.textContent = 'Por favor actualiza tu género en tu perfil para ver personas en Descubre gente.';
                return;
            }

            try {
                    snapshot.forEach(doc => {
                    try {
                        // Excluir el propio perfil
                        if (typeof currentUserId !== 'undefined' && currentUserId && doc.id === currentUserId) return;

                        // Excluir perfiles con los que ya existe un chat
                        if (openChatPartners.has(doc.id)) return;

                        // Excluir perfiles bloqueados por mi o que me hayan bloqueado
                        const docData = doc.data() || {};
                        if (Array.isArray(myBlockedUsers) && myBlockedUsers.includes(doc.id)) return;
                        if (Array.isArray(docData.blockedUsers) && docData.blockedUsers.includes(currentUserId)) return;

                        const data = doc.data() || {};

                        // Normalizar datos del otro usuario
                        const rawOtherGender = data.gender || data.genero || '';
                        const rawOtherPreference = data.preference || data.interests || '';
                        const otherGenderNorm = singular(stripPunct(normalize(rawOtherGender)));
                        const otherPreference = singular(stripPunct(normalize(rawOtherPreference)));

                        // Regla: no mostramos usuarios con género no especificado (valores como "No especificado", "sin especificar", "n/a" se consideran no especificados)
                        if (isUnspecified(rawOtherGender) || !otherGenderNorm) return;

                        // Regla 2: mutual compatibility
                        if (!myPreference) {
                            // Mostrar solo si el otro usuario está interesado en mi género
                            if (!(otherPreference === myGender || otherPreference === 'ambos')) return;
                        } else {
                            // Tengo preferencia especificada
                            if (myPreference !== 'ambos') {
                                if (otherGenderNorm !== myPreference) return; // el genero del otro no es el que busco
                            }
                            // El otro usuario debe estar interesado en mi género
                            if (!(otherPreference === myGender || otherPreference === 'ambos')) return;
                        }

                        const display = data.userName || data.username || data.displayName || data.name || data.email || doc.id;
                        users.push({ id: doc.id, display, raw: data });
                    } catch (perUserErr) {
                        console.warn('[listausuarios] Error procesando usuario', doc.id, perUserErr);
                        // continue to next user
                    }
                });
            } catch (iterErr) {
                console.error('[listausuarios] Error iterando usuarios:', iterErr);
                info.textContent = 'Error al cargar usuarios: ' + (iterErr && iterErr.message ? iterErr.message : String(iterErr));
                return;
            }

            if (users.length === 0) {
                info.textContent = 'No hay otros usuarios registrados que coincidan con tus preferencias.';
                return;
            }

            users.sort((a, b) => a.display.toString().localeCompare(b.display.toString(), 'es'));

            // Render con clases CSS específicas - Estilo app de citas
            users.forEach(u => {
                const card = document.createElement('div');
                card.className = 'user-card';

                // Foto principal (grande)
                const photoSection = document.createElement('div');
                photoSection.className = 'user-card-photo';

                if (u.raw && (u.raw.photoURL || u.raw.photo)) {
                    const img = document.createElement('img');
                    img.src = u.raw.photoURL || u.raw.photo;
                    img.alt = (u.display || 'Usuario') + ' - foto';
                    img.loading = 'lazy';
                    img.decoding = 'async';
                    img.style.maxWidth = '100%';
                    img.style.height = 'auto';
                    
                    // Manejo de error si la imagen no carga (WiFi bloqueada, etc.)
                    img.onerror = function() {
                        console.warn('Imagen bloqueada o no disponible:', img.src);
                        photoSection.innerHTML = '<div class="user-card-photo-placeholder"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="80" height="80" fill="white"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.6 0-10.8 1.8-10.8 5.4V22h21.6v-2.2c0-3.6-7.2-5.4-10.8-5.4z"/></svg></div>';
                    };
                    
                    photoSection.appendChild(img);
                } else {
                    // Fallback con gradiente
                    photoSection.innerHTML = '<div class="user-card-photo-placeholder"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="80" height="80" fill="white"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.6 0-10.8 1.8-10.8 5.4V22h21.6v-2.2c0-3.6-7.2-5.4-10.8-5.4z"/></svg></div>';
                }

                // Información del perfil
                const infoSection = document.createElement('div');
                infoSection.className = 'user-card-info';

                // Nombre y edad
                const nameAgeRow = document.createElement('div');
                nameAgeRow.className = 'user-card-name-age';
                const age = u.raw && u.raw.age ? `, ${u.raw.age}` : '';
                nameAgeRow.innerHTML = `<h3>${u.display}${age}</h3>`;
                infoSection.appendChild(nameAgeRow);

                // Hábitos (chips)
                if (u.raw && u.raw.habits && Array.isArray(u.raw.habits) && u.raw.habits.length > 0) {
                    const habitsRow = document.createElement('div');
                    habitsRow.className = 'user-card-habits';
                    u.raw.habits.slice(0, 3).forEach(habit => {
                        const chip = document.createElement('span');
                        chip.className = 'habit-chip';
                        chip.textContent = habit;
                        habitsRow.appendChild(chip);
                    });
                    infoSection.appendChild(habitsRow);
                }

                // Género (mostrar capitalizado) — reemplaza la visualización de intereses
                (function(){
                    const rawGender = u.raw && (u.raw.gender || u.raw.genero);
                    if (!rawGender) return;
                    const genderStr = String(rawGender).trim();
                    if (!genderStr) return;

                    const genderRow = document.createElement('div');
                    genderRow.className = 'user-card-gender';

                    // Capitalizar la primera letra y dejar el resto en minúsculas
                    const genderDisplay = genderStr.charAt(0).toUpperCase() + genderStr.slice(1).toLowerCase();
                    genderRow.textContent = genderDisplay;
                    infoSection.appendChild(genderRow);
                })();

                card.appendChild(photoSection);
                card.appendChild(infoSection);

                // Botones de acción
                const actionsSection = document.createElement('div');
                actionsSection.className = 'user-card-actions';

                // Botón Ver perfil completo
                const viewBtn = document.createElement('button');
                viewBtn.className = 'user-card-btn user-card-btn-secondary';
                viewBtn.innerHTML = '👤 Ver perfil';
                viewBtn.addEventListener('click', () => {
                    if (window.showUserProfile && typeof window.showUserProfile === 'function') {
                        window.showUserProfile(u.id, u.raw);
                    } else {
                        alert('Funcionalidad de ver perfil no disponible.');
                    }
                });

                // Botón Chatear (acción principal)
                const chatBtn = document.createElement('button');
                chatBtn.className = 'user-card-btn user-card-btn-primary';
                chatBtn.innerHTML = '💬 Chatear';
                chatBtn.addEventListener('click', async () => {
                    try {
                        const partnerId = u.id;
                        const partnerName = u.display;
                        const chatId = generateChatId(currentUserId, partnerId);
                        
                        const usersPanel = document.getElementById('users-panel');
                        if (usersPanel) usersPanel.classList.add('hidden');
                        
                        const chatScreen = document.getElementById('chat-screen');
                        if (chatScreen) chatScreen.style.display = 'flex';
                        
                        openChat(chatId, partnerId, partnerName);
                    } catch (error) {
                        console.error('[listausuarios] Error al abrir chat:', error);
                    }
                });

                actionsSection.appendChild(viewBtn);
                actionsSection.appendChild(chatBtn);
                card.appendChild(actionsSection);

                list.appendChild(card);
            });

        } catch (err) {
            console.error('[listausuarios] Error leyendo usuarios:', err);
            info.textContent = 'Error al cargar usuarios.';
        }
    }

    // ===========================================================================
    // EXPONER FUNCIÓN PARA SER LLAMADA DESDE APP.JS (toggleUserList)
    // ===========================================================================
    /**
     * Esta función se llama desde app.js cuando el usuario hace clic
     * en el botón "Lista de Usuarios" de la barra de navegación.
     */
    window.loadAndRenderUsersFromApp = loadAndRenderUsers;

})();