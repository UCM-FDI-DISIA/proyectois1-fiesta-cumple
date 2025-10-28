/* listausuarios.js
   - Crea un botón "Lista de usuarios" junto al botón de chat
   - Al pulsarlo, abre un panel que muestra los usuarios guardados en Firestore
   - No modifica app.js, Index.html ni style.css

   Notas:
   - Este archivo debe ser incluido en el HTML *DESPUÉS* de app.js para poder
     usar la variable global `db` (inicializada en app.js).
   - Si `db` no está disponible, se mostrará un error en la consola.
*/

(function(){
    'use strict';

    // Esperamos a que el DOM esté listo
    document.addEventListener('DOMContentLoaded', () => {
        try {
            createUsersButton();
            createUsersPanel();
        } catch (err) {
            console.error('[listausuarios] Error inicializando:', err);
        }
    });

    // Crea y posiciona el botón "Lista de usuarios" junto al botón de chat
    function createUsersButton() {
        // Evitar duplicados
        if (document.getElementById('openUsersBtn')) return;

        const openChatBtn = document.getElementById('openChatBtn');

        // Creamos el nuevo botón
        const btn = document.createElement('div');
        btn.id = 'openUsersBtn';
        btn.textContent = 'Lista de usuarios';
        // Reutilizamos la clase para que herede estilos similares
        btn.className = 'chat-open-button';

        // Aplicamos estilos inline adicionales para separarlo del botón de chat
        // (No editamos style.css, solo estilos locales en el elemento.)
        btn.style.right = '130px'; // sitúa a la izquierda del botón de chat
        btn.style.bottom = '30px';
        btn.style.padding = '12px 18px';
        btn.style.fontSize = '14px';
        btn.style.borderRadius = '20px';
        btn.style.zIndex = '1001';
        btn.style.display = 'none'; // Oculto por defecto hasta iniciar sesión

        // Click toggles panel
        btn.addEventListener('click', async () => {
            const panel = document.getElementById('users-panel');
            if (!panel) return;
            const isHidden = panel.style.display === 'none' || !panel.style.display;
            if (isHidden) {
                panel.style.display = 'block';
                await loadAndRenderUsers();
            } else {
                panel.style.display = 'none';
            }
        });

        // Si existe openChatBtn, insertamos el nuestro junto a él en el body
        // para preservar posicionamiento fixed. Si no existe, lo añadimos al body.
        const parent = document.body;
        parent.appendChild(btn);
    }

    // Crea el panel/modal que mostrará la lista de usuarios
    function createUsersPanel() {
        if (document.getElementById('users-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'users-panel';

        // Estilos básicos del panel (inline para no tocar style.css)
        Object.assign(panel.style, {
            position: 'fixed',
            bottom: '90px',
            right: '30px',
            width: '320px',
            maxHeight: '50vh',
            overflowY: 'auto',
            background: 'white',
            boxShadow: '0 6px 18px rgba(0,0,0,0.15)',
            borderRadius: '10px',
            padding: '10px',
            zIndex: '1002',
            display: 'none'
        });

        // Header
        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.marginBottom = '8px';

        const title = document.createElement('strong');
        title.textContent = 'Usuarios registrados';

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Cerrar';
        Object.assign(closeBtn.style, {
            background: '#0084ff',
            color: 'white',
            border: 'none',
            padding: '6px 10px',
            borderRadius: '6px',
            cursor: 'pointer'
        });
        closeBtn.addEventListener('click', () => {
            panel.style.display = 'none';
        });

        header.appendChild(title);
        header.appendChild(closeBtn);

        // Contenedor de la lista
        const list = document.createElement('div');
        list.id = 'users-list';
        list.style.display = 'flex';
        list.style.flexDirection = 'column';
        list.style.gap = '6px';

        // Mensaje de carga / vacío
        const info = document.createElement('div');
        info.id = 'users-info';
        info.textContent = 'Pulse "Lista de usuarios" para cargar.';
        info.style.color = '#666';
        info.style.padding = '8px 4px';

        panel.appendChild(header);
        panel.appendChild(info);
        panel.appendChild(list);

        document.body.appendChild(panel);
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
            console.error('[listausuarios] La variable `db` (Firestore) no está disponible. Asegúrate de incluir listausuarios.js DESPUÉS de app.js en el HTML.');
            info.textContent = 'Error: Firestore no disponible.';
            return;
        }

        try {
            // Intentamos leer la colección 'users'. Si tu proyecto usa otro nombre, ajusta aquí.
            const snapshot = await db.collection('users').get();
            if (snapshot.empty) {
                info.textContent = 'No hay usuarios registrados.';
                return;
            }

            info.textContent = '';

            const users = [];
            snapshot.forEach(doc => {
                // Si hay un usuario logueado, excluirlo de la lista para que
                // no aparezca a sí mismo en "Lista de usuarios".
                if (typeof currentUserId !== 'undefined' && currentUserId && doc.id === currentUserId) return;

                const data = doc.data() || {};
                // Priorizar el campo `userName` (usado en app.js). Si no existe,
                // intentamos `username`, luego otros campos comunes y finalmente el id.
                const display = data.userName || data.username || data.displayName || data.name || data.email || doc.id;
                users.push({ id: doc.id, display, raw: data });
            });

            // Si tras filtrar sólo quedaba el usuario actual, indicarlo
            if (users.length === 0) {
                info.textContent = 'No hay otros usuarios registrados.';
                return;
            }

            // Ordenar alfabéticamente por display
            users.sort((a,b) => a.display.toString().localeCompare(b.display.toString(), 'es'));

            // Render
            users.forEach(u => {
                const row = document.createElement('div');
                row.className = 'user-row';
                Object.assign(row.style, {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px',
                    borderRadius: '6px',
                    background: '#f7f9fb'
                });

                const left = document.createElement('div');
                left.style.display = 'flex';
                left.style.flexDirection = 'column';

                const nameEl = document.createElement('div');
                nameEl.textContent = u.display;
                nameEl.style.fontWeight = '600';
                nameEl.style.color = '#333';

                const metaEl = document.createElement('div');
                metaEl.style.fontSize = '12px';
                metaEl.style.color = '#666';
                // mostramos email si existe
                metaEl.textContent = u.raw && u.raw.email ? u.raw.email : '';

                left.appendChild(nameEl);
                if (metaEl.textContent) left.appendChild(metaEl);

                // Botón de acción opcional (ej: iniciar chat). Por ahora solo copia el id
                const action = document.createElement('button');
                // Copiamos el valor mostrado (username preferente) en lugar del uid
                action.textContent = 'Copiar usuario';
                Object.assign(action.style, {
                    background: '#0084ff',
                    color: 'white',
                    border: 'none',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer'
                });
                action.addEventListener('click', () => {
                    // Preferir copiar el valor mostrado (display). Si display es igual al id,
                    // intentar prefijar los campos userName o username en el documento.
                    const prefer = u.raw && (u.raw.userName || u.raw.username);
                    const toCopy = (u.display && u.display !== u.id)
                        ? u.display
                        : (prefer ? (u.raw.userName || u.raw.username) : u.id);
                    copyToClipboard(toCopy);
                    action.textContent = 'Copiado';
                    setTimeout(() => action.textContent = 'Copiar usuario', 1200);
                });

                row.appendChild(left);
                row.appendChild(action);
                list.appendChild(row);
            });

        } catch (err) {
            console.error('[listausuarios] Error leyendo usuarios:', err);
            info.textContent = 'Error al cargar usuarios.';
        }
    }

    // Utilidad para copiar texto al portapapeles
    function copyToClipboard(text){
        if (!navigator.clipboard) {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); } catch(e){}
            document.body.removeChild(ta);
            return;
        }
        navigator.clipboard.writeText(text).catch(err => {
            console.warn('No se pudo copiar al portapapeles', err);
        });
    }

})();
