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
        title.textContent = 'Usuarios registrados';

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
            try {
                if (typeof currentUserId !== 'undefined' && currentUserId) {
                    // Leer perfil del usuario actual para conocer su preferencia
                    try {
                        const meDoc = await db.collection('users').doc(currentUserId).get();
                        if (meDoc.exists) {
                            const meData = meDoc.data() || {};
                            myPreference = singular(stripPunct(normalize(meData.preference || meData.interests || '')));
                            myGender = singular(stripPunct(normalize(meData.gender || meData.genero || '')));
                        }
                    } catch (prefErr) {
                        console.warn('[listausuarios] No se pudo leer la preferencia del usuario actual:', prefErr);
                    }
                    const chatsSnap = await db.collection('chats')
                        .where('participants', 'array-contains', currentUserId)
                        .get();

                    chatsSnap.forEach(docChat => {
                        const dataChat = docChat.data() || {};
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

            // Render con clases CSS específicas
            users.forEach(u => {
                const row = document.createElement('div');
                row.className = 'user-row';

                // Avatar a la izquierda
                const avatarWrap = document.createElement('div');
                avatarWrap.className = 'user-avatar';

                // Si el usuario tiene photoURL (almacenada como photoURL), la usamos
                if (u.raw && (u.raw.photoURL || u.raw.photo)) {
                    const img = document.createElement('img');
                    img.src = u.raw.photoURL || u.raw.photo;
                    img.alt = (u.display || 'Usuario') + ' - foto';
                    img.loading = 'lazy';
                    avatarWrap.appendChild(img);
                } else {
                    // Fallback: pequeño SVG inline (estilo avatar neutro)
                    avatarWrap.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40" fill="#ccc"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.6 0-10.8 1.8-10.8 5.4V22h21.6v-2.2c0-3.6-7.2-5.4-10.8-5.4z"/></svg>';
                }

                const left = document.createElement('div');
                left.className = 'user-info';

                const nameEl = document.createElement('div');
                nameEl.className = 'user-name';
                nameEl.textContent = u.display;

                const metaEl = document.createElement('div');
                metaEl.className = 'user-meta';
                metaEl.textContent = u.raw && u.raw.email ? u.raw.email : '';

                left.appendChild(nameEl);
                if (metaEl.textContent) left.appendChild(metaEl);

                // ✅ BOTÓN "VER" - MANTENIDO SIN CAMBIOS
                const viewBtn = document.createElement('button');
                viewBtn.className = 'user-action-btn user-view-btn';
                viewBtn.textContent = 'Ver';
                viewBtn.addEventListener('click', () => {
                    // Si la función global showUserProfile existe, la usamos
                    if (window.showUserProfile && typeof window.showUserProfile === 'function') {
                        window.showUserProfile(u.id, u.raw);
                    } else {
                        // Fallback: intentar abrir modal propio mínimo
                        alert('Funcionalidad de ver perfil no disponible.');
                    }
                });

                // BOTÓN "CHATEAR" - REEMPLAZA A "COPIAR USUARIO"
                const chatBtn = document.createElement('button');
                chatBtn.className = 'user-action-btn user-chat-btn';
                chatBtn.textContent = 'Chatear';
                chatBtn.addEventListener('click', async () => {
                    try {
                        // 1. Obtener datos del usuario
                        const partnerId = u.id;
                        const partnerName = u.display;
                        
                        // 2. Generar ID del chat
                        const chatId = generateChatId(currentUserId, partnerId);
                        
                        // 3. Cerrar panel de usuarios
                        const usersPanel = document.getElementById('users-panel');
                        if (usersPanel) {
                            usersPanel.classList.add('hidden');
                        }
                        
                        // 4. Abrir panel de chat
                        const chatScreen = document.getElementById('chat-screen');
                        if (chatScreen) {
                            chatScreen.style.display = 'flex';
                        }
                        
                        // 5. Abrir chat específico
                        openChat(chatId, partnerId, partnerName);
                        
                    } catch (error) {
                        console.error('[listausuarios] Error al abrir chat:', error);
                    }
                });

                // Orden: avatar, info, acciones (Ver y Chatear)
                row.appendChild(avatarWrap);
                row.appendChild(left);
                const actionsWrap = document.createElement('div');
                actionsWrap.className = 'actions';
                actionsWrap.appendChild(viewBtn);    // Primero: "Ver"
                actionsWrap.appendChild(chatBtn);    // Segundo: "Chatear"
                row.appendChild(actionsWrap);
                list.appendChild(row);
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