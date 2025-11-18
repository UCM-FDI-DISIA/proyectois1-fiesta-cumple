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
        panel.classList.add('hidden'); // ✅ AÑADIR CLASE HIDDEN por defecto
        
        // ✅ SIN ESTILOS INLINE - Todo se maneja desde style.css
        // Los estilos ahora están definidos en la hoja de estilos

        // Header
        const header = document.createElement('div');

        const title = document.createElement('strong');
        title.textContent = 'Usuarios registrados';

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Cerrar';
        closeBtn.addEventListener('click', () => {
            panel.classList.add('hidden'); // ✅ Usar clase en lugar de style.display
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
                const isPanelOpen = !panelEl.classList.contains('hidden'); // ✅ Verificar con clase
                if (isPanelOpen && !panelEl.contains(target) && !target.closest('.nav-button')) {
                    panelEl.classList.add('hidden'); // ✅ Usar clase en lugar de style.display
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
            try {
                if (typeof currentUserId !== 'undefined' && currentUserId) {
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

            snapshot.forEach(doc => {
                // Excluir el propio perfil
                if (typeof currentUserId !== 'undefined' && currentUserId && doc.id === currentUserId) return;

                // Excluir perfiles con los que ya existe un chat
                if (openChatPartners.has(doc.id)) return;

                const data = doc.data() || {};
                const display = data.userName || data.username || data.displayName || data.name || data.email || doc.id;
                users.push({ id: doc.id, display, raw: data });
            });

            if (users.length === 0) {
                info.textContent = 'No hay otros usuarios registrados.';
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
                left.className = 'user-info'; // ✅ Clase para el contenedor

                const nameEl = document.createElement('div');
                nameEl.className = 'user-name'; // ✅ Clase para el nombre
                nameEl.textContent = u.display;

                const metaEl = document.createElement('div');
                metaEl.className = 'user-meta'; // ✅ Clase para el email
                metaEl.textContent = u.raw && u.raw.email ? u.raw.email : '';

                left.appendChild(nameEl);
                if (metaEl.textContent) left.appendChild(metaEl);

                const action = document.createElement('button');
                action.className = 'user-action-btn'; // ✅ Clase para el botón
                action.textContent = 'Copiar usuario';
                action.addEventListener('click', () => {
                    const prefer = u.raw && (u.raw.userName || u.raw.username);
                    const toCopy = (u.display && u.display !== u.id)
                        ? u.display
                        : (prefer ? (u.raw.userName || u.raw.username) : u.id);
                    copyToClipboard(toCopy);
                    action.textContent = 'Copiado';
                    setTimeout(() => action.textContent = 'Copiar usuario', 1200);
                });

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

                // Orden: avatar, info, acciones (Ver y Copiar)
                row.appendChild(avatarWrap);
                row.appendChild(left);
                const actionsWrap = document.createElement('div');
                actionsWrap.className = 'actions';
                actionsWrap.appendChild(viewBtn);
                actionsWrap.appendChild(action);
                row.appendChild(actionsWrap);
                list.appendChild(row);
            });

        } catch (err) {
            console.error('[listausuarios] Error leyendo usuarios:', err);
            info.textContent = 'Error al cargar usuarios.';
        }
    }

    // Utilidad para copiar texto al portapapeles
    function copyToClipboard(text) {
        if (!navigator.clipboard) {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); } catch (e) { }
            document.body.removeChild(ta);
            return;
        }
        navigator.clipboard.writeText(text).catch(err => {
            console.warn('No se pudo copiar al portapapeles', err);
        });
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