/*
Sistema de chat SIMPLIFICADO para pruebas.
Versión sin contraseñas - solo requiere nombre de usuario.
Incluye: registro simple, encuesta de perfil, foto de perfil, y chat en tiempo real.

NOTA: Para versión con autenticación completa (email/contraseña),
descomenta las secciones marcadas como "VERSIÓN CON AUTENTICACIÓN".
*/ 

// ========================================
// CONFIGURACIÓN DE FIREBASE
// ========================================
const firebaseConfig = {
    apiKey: "AIzaSyDcptuIsvTD_HLcu0-XV2sUiJXbshobN-w",
    authDomain: "chatcitas-787ca.firebaseapp.com",
    projectId: "chatcitas-787ca",
    storageBucket: "chatcitas-787ca.firebasestorage.app",
    messagingSenderId: "854775905723",
    appId: "1:854775905723:web:221dbc8ac51ed76231d89e"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// ========================================
// SERVICIOS DE FIREBASE
// ========================================
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
let currentUser = null;
let currentUserId = '';
let currentUserName = '';

// ========================================
// VARIABLES GLOBALES PARA EL CHAT
// ========================================
/*
   Variables que almacenan referencias a los elementos del DOM
   relacionados con el sistema de apertura/cierre del chat.
   
   Se inicializan en el evento DOMContentLoaded para asegurar
   que los elementos HTML ya existan cuando se asignen.
*/
let chatScreen;      // Contenedor principal del chat (#chat-screen)
let chatIsVisible = false; // Estado actual del chat (visible/oculto)

// ========================================
// VARIABLES GLOBALES PARA CHATS PRIVADOS
// ========================================
/*
   Variables para el sistema de chats privados entre usuarios.
   Cada usuario puede tener múltiples conversaciones.
*/
let currentChatId = null;        // ID del chat actualmente abierto
let currentChatPartner = null;   // Nombre del usuario con quien se está chateando
let activeChatListener = null;   // Listener activo de mensajes (para poder desuscribirse)
let chatsListener = null;        // Listener de la lista de chats (para evitar duplicados)       
// Chats ocultados localmente (optimistic UI). Evita que el snapshot
// vuelva a renderizar un chat inmediatamente después de ocultarlo.
let locallyHiddenChats = new Set();
// Bandera para saber si el partner nos ha bloqueado (evitar enviar mensajes)
let partnerHasBlockedMe = false;

// ========================================
// VERSIÓN ACTUAL: INICIALIZACIÓN CON AUTENTICACIÓN
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    // ===== INICIALIZACIÓN DEL SISTEMA DE CHAT =====
    console.log('Inicializando sistema de chat...');
    
    // Obtener referencia al chat screen
    chatScreen = document.getElementById('chat-screen');

    // Verificar que el elemento existe
    if (!chatScreen) {
        console.error('ERROR: No se encontró el elemento #chat-screen');
        return;
    }

    // Asegurar que el chat empiece oculto
    chatScreen.style.display = 'none';

    console.log('[OK] Sistema de botón de chat configurado correctamente');
    
    updateProfileButtonVisibility();

    // ===== CONFIGURAR TECLA ENTER EN EL INPUT =====
    const input = document.getElementById('message-input');
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !input.disabled) {
                sendMessage();
            }
        });
    }
    
    // ===== CONFIGURAR BOTÓN AÑADIR CHAT =====
    const addChatBtn = document.getElementById('add-chat-btn');
    if (addChatBtn) {
        addChatBtn.addEventListener('click', addNewChat);
    }

    // ===== PREVIEW DE FOTO DE PERFIL =====
    const profilePhotoInput = document.getElementById('profile-photo');
    if (profilePhotoInput) {
        profilePhotoInput.addEventListener('change', (e) => previewProfilePhoto(e, 'photo-preview'));
    }
    const profilePhotoInput2 = document.getElementById('profile-photo-2');
    if (profilePhotoInput2) {
        profilePhotoInput2.addEventListener('change', (e) => previewProfilePhoto(e, 'photo-preview-2'));
    }
    // Actualizar el botón de perfil (muestra silueta o foto si hay sesión)
    try { updateProfileButton(); } catch(e) { /* no crítico */ }
    // Crear el menú de perfil (DOM) y listeners
    try { createProfileMenu(); } catch(e) { /* no crítico */ }
    // Cerrar el menú al hacer click fuera
    document.addEventListener('click', (ev) => {
        const menu = document.getElementById('profileMenu');
        const btn = document.getElementById('profileBtn');
        if (!menu || !btn) return;
        const target = ev.target;
        if (menu.style.display === 'block' && !menu.contains(target) && !btn.contains(target)) {
            menu.style.display = 'none';
        }
    });

    // Cerrar chat únicamente cuando se haga click directamente sobre el fondo de la página
    // (es decir, el elemento `body` o el `documentElement`). Esto evita que clicks en la
    // barra lateral o en otros paneles cierren el chat accidentalmente.
    document.addEventListener('click', (ev) => {
        try {
            const chatScreenEl = document.getElementById('chat-screen');
            const target = ev.target;

            if (chatScreenEl && chatScreenEl.style.display === 'flex') {
                // Solo cerrar si el objetivo del click es exactamente el body o el root
                if (target === document.body || target === document.documentElement) {
                    chatScreenEl.style.display = 'none';
                    console.log('[Click Outside] Chat cerrado automáticamente (fondo)');
                }
            }
        } catch (e) {
            // no crítico
        }
    });

    // Permitir enviar Enter en los inputs de login para iniciar sesión
    const loginEmailInput = document.getElementById('login-email');
    const loginPasswordInput = document.getElementById('login-password');
    
    [loginEmailInput, loginPasswordInput].forEach(input => {
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    login();
                }
            });
        }
    });

    // Restaurar sesión desde sessionStorage (por pestaña) si no hay usuario en Firebase Auth
    try {
        let savedUserId = null;
        try { savedUserId = sessionStorage.getItem('chat_currentUserId'); } catch(e) { savedUserId = null; }

        // Si hay una sesión guardada y no hay usuario autenticado en Auth, rehidratar desde Firestore
        if (savedUserId && !auth.currentUser) {
            console.log('[Session] Restaurando sesión local de', savedUserId);
            currentUserId = savedUserId;
            try { showSessionSpinner(); } catch(e) { /* ignore */ }

            (async () => {
                try {
                    // Intentar cargar perfil y chats
                    await loadUserProfile();
                    loadUserChats();
                    updateProfileButtonVisibility();
                    showChatInterface();
                } catch (e) {
                    console.error('[Session] Error restaurando sesión local:', e);
                    // Si falla al restaurar (usuario borrado), limpiar almacenamiento de la pestaña
                    try { sessionStorage.removeItem('chat_currentUserId'); } catch(_) { /* ignore */ }
                    currentUserId = '';
                } finally {
                    try { hideSessionSpinner(); } catch(e) { /* ignore */ }
                }
            })();
        }
    } catch (e) {
        console.warn('No se pudo restaurar sesión desde storage:', e);
    }

    // ========================================
    // AUTENTICACIÓN: Listener de estado de autenticación
    // ========================================
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            currentUserId = user.uid;
            // Persistir sesión en storage por pestaña (sessionStorage). No usar localStorage para evitar compartir sesión entre pestañas
            try { sessionStorage.setItem('chat_currentUserId', currentUserId); } catch(e) { console.warn('No se pudo persistir sesión en sessionStorage en onAuthStateChanged:', e); }
            loadUserProfile(); // ya llama internamente a updateProfileButton
            loadUserChats();
            showChatInterface(); // ahora también llama a updateProfileButton con reintentos
            updateProfileButtonVisibility();
            // Reintento extra fuera de showChatInterface por seguridad
            setTimeout(() => { try { updateProfileButton(); } catch(_) {} }, 1500);
            if (typeof window.showGameButton === 'function') window.showGameButton();
        } else {
            showLoginForm();
        }
    });
});

// Mostrar un spinner centralizado mientras se restaura la sesión
function showSessionSpinner() {
    // No crear doble overlay
    if (document.getElementById('session-spinner-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'session-spinner-overlay';
    overlay.className = 'session-spinner-overlay';

    const holder = document.createElement('div');
    holder.style.display = 'flex';
    holder.style.flexDirection = 'column';
    holder.style.alignItems = 'center';

    const spinner = document.createElement('div');
    spinner.className = 'session-spinner';

    const txt = document.createElement('div');
    txt.className = 'session-spinner-text';
    txt.textContent = 'Restaurando sesión...';

    holder.appendChild(spinner);
    holder.appendChild(txt);
    overlay.appendChild(holder);

    document.body.appendChild(overlay);
}

function hideSessionSpinner() {
    const overlay = document.getElementById('session-spinner-overlay');
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    // Limpiar la clase que ocultaba el login antes de pintar
    try { document.documentElement.classList.remove('session-restoring'); } catch(e) { /* ignore */ }
}

// Alterna la apertura del modal de login/registro cuando se pulsa el botón de perfil
function toggleAuthMenu() {
    // SOLO funciona cuando hay usuario logueado
    if (currentUserId) {
        // Mostrar/ocultar el menú de perfil
        toggleProfileMenu();
    }
    // Si no hay usuario, no hace nada (el botón está oculto de todas formas)
}

// Crea el DOM del menú de perfil si no existe
function createProfileMenu() {
    if (document.getElementById('profileMenu')) return;
    const menu = document.createElement('div');
    menu.id = 'profileMenu';
    menu.className = 'profile-menu';
    menu.style.display = 'none';
    menu.innerHTML = `
        <div class="profile-menu-header">
            <div class="pm-photo" id="pmPhoto"></div>
            <div class="pm-name" id="profileMenuName">Invitado</div>
        </div>
        <div class="profile-menu-actions">
            <button id="viewProfileBtn">Ver perfil</button>
            <button id="blockedUsersBtn">Usuarios bloqueados</button>
            <button id="logoutMenuBtn">Cerrar sesión</button>
        </div>
    `;
    document.body.appendChild(menu);
    // Listeners
    menu.querySelector('#viewProfileBtn').addEventListener('click', () => {
        hideProfileMenu();
        viewProfile();
    });
    menu.querySelector('#blockedUsersBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        hideProfileMenu();
        showBlockedUsersModal();
    });
    menu.querySelector('#logoutMenuBtn').addEventListener('click', () => {
        hideProfileMenu();
        logout();
    });
}

// ========================================
// BLOQUEADOS: Modal / Tarjeta de Usuarios Bloqueados
// ========================================
function createBlockedUsersModal() {
    if (document.getElementById('blockedUsersModal')) return;

    const backdrop = document.createElement('div');
    backdrop.className = 'blocked-users-backdrop';
    backdrop.style.display = 'none';
    backdrop.id = 'blockedUsersBackdrop';

    const modal = document.createElement('div');
    modal.id = 'blockedUsersModal';
    modal.className = 'blocked-users-modal';
    modal.style.display = 'none';

    modal.innerHTML = `
        <div class="blocked-users-header">
            <strong>Usuarios bloqueados</strong>
            <button id="closeBlockedUsersBtn" class="btn-secondary">Cerrar</button>
        </div>
        <div id="blockedUsersList" class="blocked-users-list">
            <div class="blocked-empty">Cargando...</div>
        </div>
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(modal);
    
    // Listener para el botón Eliminar Perfil (flujo: aviso -> pedir contraseña -> confirmar)
    const deleteBtn = document.getElementById('deleteProfileBtn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', showDeleteProfileDialog);
    }

    backdrop.addEventListener('click', closeBlockedUsersModal);
    modal.querySelector('#closeBlockedUsersBtn').addEventListener('click', closeBlockedUsersModal);
}

// DIALOGOS Y FUNCIONES PARA ELIMINAR PERFIL
// Eliminar todos los chats en los que participa un usuario (y sus mensajes)
async function deleteAllUserChats(uid) {
    if (!uid) return;
    if (typeof db === 'undefined' || !db) {
        console.warn('Firestore no disponible para eliminar chats del usuario', uid);
        return;
    }

    try {
        const chatsSnap = await db.collection('chats').where('participants', 'array-contains', uid).get();
        if (chatsSnap.empty) {
            console.log('[deleteAllUserChats] No se encontraron chats para', uid);
            return;
        }

        console.log('[deleteAllUserChats] Chats encontrados:', chatsSnap.size);

        for (const chatDoc of chatsSnap.docs) {
            const chatRef = chatDoc.ref;
            console.log('[deleteAllUserChats] Procesando chat', chatRef.id);

            // Primer borrado: eliminar todos los documentos en la subcolección 'messages' en batches
            try {
                const msgsSnap = await chatRef.collection('messages').get();
                if (!msgsSnap.empty) {
                    let batch = db.batch();
                    let counter = 0;
                    for (const m of msgsSnap.docs) {
                        batch.delete(m.ref);
                        counter++;
                        if (counter >= 450) { // commit periódicamente (seguro por debajo de 500)
                            await batch.commit();
                            batch = db.batch();
                            counter = 0;
                        }
                    }
                    if (counter > 0) await batch.commit();
                    console.log('[deleteAllUserChats] Mensajes eliminados para chat', chatRef.id);
                }
            } catch (e) {
                console.warn('[deleteAllUserChats] Error borrando mensajes en', chatRef.id, e);
            }

            // Intentar eliminar el documento del chat. Si falla por reglas, marcarlo como oculto
            try {
                await chatRef.delete();
                console.log('[deleteAllUserChats] Chat eliminado:', chatRef.id);
            } catch (e) {
                console.warn('[deleteAllUserChats] No se pudo eliminar chat (intentando ocultarlo):', chatRef.id, e);
                try {
                    // Obtener participantes para ocultar el chat para ellos
                    const fresh = await chatRef.get();
                    const data = fresh.exists ? fresh.data() || {} : {};
                    const participants = Array.isArray(data.participants) ? data.participants : [];
                    const toHide = participants.filter(p => p !== uid);
                    if (toHide.length > 0) {
                        const updateObj = {
                            hiddenFor: firebase.firestore.FieldValue.arrayUnion(...toHide)
                        };
                        // Añadir marcas hiddenAt para cada participante ocultado
                        toHide.forEach(p => {
                            updateObj['hiddenAt.' + p] = firebase.firestore.FieldValue.serverTimestamp();
                        });
                        await chatRef.update(updateObj);
                        console.log('[deleteAllUserChats] Chat marcado como oculto para participantes:', toHide.join(','));
                    } else {
                        console.log('[deleteAllUserChats] No hay participantes a ocultar para chat', chatRef.id);
                    }
                } catch (updErr) {
                    console.warn('[deleteAllUserChats] Error marcando chat como oculto', chatRef.id, updErr);
                }
            }
        }

    } catch (err) {
        console.error('[deleteAllUserChats] Error consultando chats para', uid, err);
    }
}

function showDeleteProfileDialog() {
    // Crear backdrop específico para el diálogo
    const dlgBackdrop = document.createElement('div');
    dlgBackdrop.className = 'delete-profile-backdrop';
    dlgBackdrop.id = 'deleteProfileBackdrop';

    const dlg = document.createElement('div');
    dlg.className = 'delete-profile-dialog';
    dlg.id = 'deleteProfileDialog';

    dlg.innerHTML = `
        <div class="delete-header"><h3>Eliminar perfil</h3></div>
        <div class="delete-body">
            <p>Al eliminar tu perfil se perderán datos asociados a tu cuenta y dejarás de poder acceder. Esta acción es irreversible.</p>
            <p>¿Quieres continuar?</p>
        </div>
        <div class="delete-actions">
            <button id="deleteCancelBtn" class="btn-secondary">Cancelar</button>
            <button id="deleteContinueBtn" class="btn-primary">Continuar</button>
        </div>
    `;

    document.body.appendChild(dlgBackdrop);
    document.body.appendChild(dlg);

    document.getElementById('deleteCancelBtn').addEventListener('click', () => {
        dlg.remove();
        dlgBackdrop.remove();
    });

    document.getElementById('deleteContinueBtn').addEventListener('click', () => {
        // Cambiar el contenido para pedir contraseña
        const body = dlg.querySelector('.delete-body');
        body.innerHTML = `
            <p>Introduce tu contraseña para confirmar la eliminación de la cuenta:</p>
            <input id="confirmDeletePassword" type="password" placeholder="Contraseña" class="auth-input">
            <div id="confirmDeleteError" class="auth-error" style="display:none;color:red;margin-top:8px"></div>
        `;

        const actions = dlg.querySelector('.delete-actions');
        actions.innerHTML = `
            <button id="deleteBackBtn" class="btn-secondary">Volver</button>
            <button id="deleteConfirmBtn" class="btn-danger">Confirmar eliminación</button>
        `;

        document.getElementById('deleteBackBtn').addEventListener('click', () => {
            dlg.remove();
            dlgBackdrop.remove();
        });

        document.getElementById('deleteConfirmBtn').addEventListener('click', async () => {
            const pwdEl = document.getElementById('confirmDeletePassword');
            const errEl = document.getElementById('confirmDeleteError');
            const password = pwdEl.value || '';
            errEl.style.display = 'none';

            if (!password || password.trim() === '') {
                errEl.textContent = 'La contraseña es obligatoria';
                errEl.style.display = 'block';
                return;
            }

            // Reautenticar y eliminar
            try {
                const user = auth.currentUser;
                if (!user) throw new Error('No hay usuario autenticado');
                const email = user.email;
                const cred = firebase.auth.EmailAuthProvider.credential(email, password);
                await user.reauthenticateWithCredential(cred);

                // Mostrar pantalla de progreso
                const body2 = dlg.querySelector('.delete-body');
                body2.innerHTML = `<p>Estamos procediendo con la eliminación de tu cuenta, se habrá hecho en unos segundos... cerrando sesión.</p>`;
                const actions2 = dlg.querySelector('.delete-actions');
                actions2.innerHTML = `<div style="text-align:center;">Procesando...</div>`;

                // Eliminar todos los chats asociados al usuario antes de borrar el perfil
                try {
                    const body3 = dlg.querySelector('.delete-body');
                    if (body3) body3.innerHTML = `<p>Eliminando chats asociados...</p>`;
                    await deleteAllUserChats(currentUserId);
                } catch (e) {
                    console.warn('Error eliminando chats asociados:', e);
                }

                // Eliminar documento de Firestore (si existe)
                try {
                    await db.collection('users').doc(currentUserId).delete();
                } catch (e) {
                    console.warn('No se pudo eliminar documento de usuario en Firestore o no existía:', e);
                }

                // Eliminar usuario en Auth
                try {
                    await user.delete();
                } catch (delErr) {
                    console.error('Error eliminando usuario en Auth:', delErr);
                }

                // Forzar cierre: limpiar UI y mostrar login
                try {
                    dlg.remove();
                    dlgBackdrop.remove();
                } catch (e) {}

                try { 
                    // Limpiar estado y mostrar pantalla de login
                    showLoginForm();
                } catch (e) {
                    location.reload();
                }

            } catch (reauthErr) {
                console.error('Reautenticación fallida:', reauthErr);
                const code = reauthErr && reauthErr.code ? reauthErr.code : '';
                const errElInner = document.getElementById('confirmDeleteError');
                if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
                    errElInner.textContent = 'Contraseña incorrecta';
                } else {
                    errElInner.textContent = 'Error al verificar la contraseña';
                }
                errElInner.style.display = 'block';
            }
        });
    });
}

async function showBlockedUsersModal() {
    createBlockedUsersModal();
    const backdrop = document.getElementById('blockedUsersBackdrop');
    const modal = document.getElementById('blockedUsersModal');
    if (!modal || !backdrop) return;

    backdrop.style.display = 'block';
    modal.style.display = 'block';
    // Cargar lista
    await renderBlockedUsersList();
}

function closeBlockedUsersModal() {
    const backdrop = document.getElementById('blockedUsersBackdrop');
    const modal = document.getElementById('blockedUsersModal');
    if (backdrop) backdrop.style.display = 'none';
    if (modal) modal.style.display = 'none';
}

async function renderBlockedUsersList() {
    const listEl = document.getElementById('blockedUsersList');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!currentUserId || typeof db === 'undefined' || !db) {
        listEl.innerHTML = '<div class="blocked-empty">No hay sesión activa.</div>';
        return;
    }

    try {
        const meDoc = await db.collection('users').doc(currentUserId).get();
        if (!meDoc.exists) { listEl.innerHTML = '<div class="blocked-empty">Perfil no encontrado.</div>'; return; }
        const meData = meDoc.data() || {};
        const blocked = Array.isArray(meData.blockedUsers) ? meData.blockedUsers : [];
        if (blocked.length === 0) { listEl.innerHTML = '<div class="blocked-empty">No has bloqueado a nadie.</div>'; return; }

        // Render each blocked user
        for (const uid of blocked) {
            try {
                const uDoc = await db.collection('users').doc(uid).get();
                const uData = uDoc && uDoc.exists ? (uDoc.data() || {}) : { userName: uid };

                const row = document.createElement('div');
                row.className = 'blocked-user-item';

                const left = document.createElement('div');
                left.className = 'blocked-user-left';
                const img = document.createElement('img');
                img.className = 'blocked-user-avatar';
                img.alt = uData.userName || 'Usuario';
                img.src = uData.photoURL || uData.photo || '';
                img.onerror = function() { this.style.display = 'none'; };
                left.appendChild(img);

                const name = document.createElement('div');
                name.className = 'blocked-user-name';
                name.textContent = uData.userName || uData.username || uid;

                const right = document.createElement('div');
                right.className = 'blocked-user-actions';
                const btn = document.createElement('button');
                btn.className = 'btn-primary';
                btn.textContent = 'Desbloquear';
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    btn.disabled = true;
                    try {
                        await unblockUser(uid);
                        // quitar fila
                        row.parentNode && row.parentNode.removeChild(row);
                        // si no quedan elementos, mostrar empty
                        if (document.querySelectorAll('.blocked-user-item').length === 0) {
                            listEl.innerHTML = '<div class="blocked-empty">No has bloqueado a nadie.</div>';
                        }
                    } catch (err) {
                        console.error('unblock error', err);
                        alert('No se pudo desbloquear al usuario.');
                        btn.disabled = false;
                    }
                });
                right.appendChild(btn);

                row.appendChild(left);
                row.appendChild(name);
                row.appendChild(right);

                listEl.appendChild(row);
            } catch (e) {
                console.warn('Error cargando usuario bloqueado', uid, e);
            }
        }

    } catch (err) {
        console.error('Error renderBlockedUsersList', err);
        listEl.innerHTML = '<div class="blocked-empty">Error cargando usuarios bloqueados.</div>';
    }
}

async function unblockUser(userId) {
    if (!currentUserId) throw new Error('No hay usuario logueado');
    try {
        // 1) Leer marca de bloqueo (si existe) y eliminar de la lista blockedUsers
        // Guardamos la marca para poder decidir si debemos limpiar `hiddenAt` en el chat
        const myUserRef = db.collection('users').doc(currentUserId);
        const myDocBefore = await myUserRef.get();
        const myDataBefore = myDocBefore.exists ? (myDocBefore.data() || {}) : {};
        const blockedAtMap = myDataBefore.blockedAt || null; // map of userId -> timestamp
        const blockedTimestampForUser = blockedAtMap && blockedAtMap[userId] ? blockedAtMap[userId] : null;

        await myUserRef.update({
            blockedUsers: firebase.firestore.FieldValue.arrayRemove(userId),
            // limpiar la marca blockedAt para este usuario
            ['blockedAt.' + userId]: firebase.firestore.FieldValue.delete()
        });

        // 2) Si existe un chat entre ambos, quitar marcas de oculto para este usuario
        try {
            const chatId = generateChatId(currentUserId, userId);
            const chatRef = db.collection('chats').doc(chatId);
            const chatDoc = await chatRef.get();
            if (chatDoc.exists) {
                const updateObj = {};
                // Quitar hiddenFor para AMBOS participantes: el que desbloquea y el desbloqueado.
                // Conservamos hiddenAt.* para respetar marcas temporales (solo mensajes posteriores se mostrarán).
                updateObj['hiddenFor'] = firebase.firestore.FieldValue.arrayRemove(currentUserId, userId);
                await chatRef.update(updateObj);
                // limpiar caché local para que vuelva a renderizarse inmediatamente
                try { locallyHiddenChats.delete(chatId); } catch(e) { /* ignore */ }
            }
        } catch (e) {
            console.warn('unblockUser: no se pudo restaurar visibilidad del chat:', e);
        }

        // 3) Refrescar UI: lista de usuarios y chats si es posible
        try {
            if (typeof window.loadAndRenderUsersFromApp === 'function') {
                try { await window.loadAndRenderUsersFromApp(); } catch(e) { console.warn('refresh users failed', e); }
            }
        } catch (e) { /* ignore */ }

        // Forzar recarga del listener de chats para actualizar la barra lateral
        try {
            if (chatsListener) {
                // Unsubscribe and recreate
                try { chatsListener(); } catch(e) { /* ignore */ }
                chatsListener = null;
            }
            try { loadUserChats(); } catch(e) { console.warn('loadUserChats error after unblock:', e); }
        } catch (e) { /* ignore */ }

        return;
    } catch (err) {
        console.error('Error en unblockUser', err);
        throw err;
    }
}

function toggleProfileMenu() {
    const menu = document.getElementById('profileMenu');
    if (!menu) return;
    const isShown = menu.style.display === 'block';
    if (isShown) {
        menu.style.display = 'none';
    } else {
        populateProfileMenu();
        menu.style.display = 'block';
    }
}

function hideProfileMenu() {
    const menu = document.getElementById('profileMenu');
    if (menu) menu.style.display = 'none';
}

async function populateProfileMenu() {
    const nameEl = document.getElementById('profileMenuName');
    const photoEl = document.getElementById('pmPhoto');
    if (!nameEl || !photoEl) return;
    nameEl.textContent = 'Invitado';
    photoEl.innerHTML = '';
    if (!currentUserId) {
        nameEl.textContent = 'Invitado';
        photoEl.innerHTML = '';
        return;
    }
    try {
        const doc = await db.collection('users').doc(currentUserId).get();
        if (doc.exists) {
            const data = doc.data() || {};
            nameEl.textContent = data.userName || data.username || currentUserId;
            if (data.photoURL) {
                photoEl.innerHTML = '';
                const img = document.createElement('img');
                img.src = data.photoURL;
                img.alt = 'Foto';
                img.onerror = function() {
                    console.warn('Imagen de perfil bloqueada:', img.src);
                    photoEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.6 0-10.8 1.8-10.8 5.4V22h21.6v-2.2c0-3.6-7.2-5.4-10.8-5.4z"/></svg>';
                };
                photoEl.appendChild(img);
                return;
            }
        }
    } catch (err) {
        console.warn('populateProfileMenu error', err);
    }
    // fallback silhouette
    photoEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.6 0-10.8 1.8-10.8 5.4V22h21.6v-2.2c0-3.6-7.2-5.4-10.8-5.4z"/></svg>';
}

async function viewProfile() {
    if (!currentUserId) { alert('No hay usuario conectado.'); return; }
    createProfileModal();
    // Si previamente se ocultó la pestaña de edición (al ver otros perfiles), la restauramos
    const modal = document.getElementById('profileModal');
    if (modal) {
        const editTab = modal.querySelector('.profile-tab[data-tab="edit"]');
        if (editTab) editTab.style.display = '';
        const editSection = document.getElementById('editProfileContent');
        if (editSection) editSection.style.display = 'none';
        const photoInput = document.getElementById('newProfilePhoto');
        // Mantener el input de archivo oculto (el botón sigue presente y lanza el click)
        if (photoInput) photoInput.style.display = 'none';
        // Si había un botón de cambiar foto dentro de la sección de edición, restaurarlo
        if (editSection) {
            const changeBtn = editSection.querySelector('button');
            if (changeBtn) changeBtn.style.display = '';
        }
    }
    showProfileModal();
    await loadProfileData();
}

// Crear el modal de perfil si no existe
function createProfileModal() {
    if (document.getElementById('profileModal')) return;
    
    const modal = document.createElement('div');
    modal.id = 'profileModal';
    modal.className = 'profile-modal';
    
    modal.innerHTML = `
    <div class="profile-modal-header">
        <h2>Perfil de Usuario</h2>
        <button class="profile-modal-close" onclick="hideProfileModal()">&times;</button>
    </div>
    <div class="profile-tabs">
        <div class="profile-tab active" data-tab="view">Ver perfil</div>
        <div class="profile-tab" data-tab="edit">Editar perfil</div>
    </div>
    <div class="profile-content">
        <!-- Vista del perfil -->
        <div id="viewProfileContent">
            <div class="profile-photo-section">
                <div class="profile-photo-container" id="profilePhotoView">
                    <!-- La foto principal se inserta aquí -->
                </div>
                <div class="profile-photo-container" id="profilePhotoView2">
                    <!-- La segunda foto se inserta aquí (solo visible para el dueño) -->
                </div>
            </div>
            <div class="profile-info-section">
                <h3>Nombre de usuario</h3>
                <p id="profileNameView">Cargando...</p>
            
                <h3>Hábitos</h3>
                <div class="profile-habits" id="profileHabitsView">
                    <!-- Los hábitos se insertan aquí -->
                </div>
            
                <h3>Gustos e intereses</h3>
                <p id="profileInterestsView">Cargando...</p>

                <h3>Género</h3>
                <p id="profileGeneroView">Cargando...</p>

            </div>
        </div>
    
        <!-- Formulario de edición -->
        <div id="editProfileContent" style="display:none">
            <form class="edit-profile-form" onsubmit="return false;">
                <div class="profile-photo-section">
                    <label>Foto principal</label>
                    <div class="profile-photo-container" id="profilePhotoEdit">
                        <!-- La foto principal se inserta aquí -->
                    </div>
                    <input type="file" id="newProfilePhoto" accept="image/*" style="display:none">
                    <button type="button" onclick="document.getElementById('newProfilePhoto').click()">
                        Cambiar foto principal
                    </button>
                    
                    <label style="margin-top: 15px;">Segunda foto</label>
                    <div class="profile-photo-container" id="profilePhotoEdit2">
                        <!-- La segunda foto se inserta aquí -->
                    </div>
                    <input type="file" id="newProfilePhoto2" accept="image/*" style="display:none">
                    <button type="button" onclick="document.getElementById('newProfilePhoto2').click()">
                        Cambiar segunda foto
                    </button>
                </div>
            
                <label>
                    Nombre de usuario
                    <input type="text" id="editProfileName">
                </label>
            
                <!-- ✅ CAMPOS CON ETIQUETAS (igual que nombre de usuario) -->
                <label>
                    Altura (cm)
                    <input type="number" id="editProfileAltura" min="54" max="272" step="1">
                </label>
            
                <label>
                    Peso (kg)
                    <input type="number" id="editProfilePeso" min="1" max="737" step="1">
                </label>
            
                <div class="habits-section">
                    <h3>Hábitos</h3>
                    <label><input type="checkbox" name="editHabit" value="Deportista"> Deportista</label>
                    <label><input type="checkbox" name="editHabit" value="Lector"> Lector</label>
                    <label><input type="checkbox" name="editHabit" value="Viajero"> Viajero</label>
                    <label><input type="checkbox" name="editHabit" value="Cocinero"> Cocinero</label>
                    <label><input type="checkbox" name="editHabit" value="Músico"> Músico</label>
                    <label><input type="checkbox" name="editHabit" value="Gamer"> Gamer</label>
                </div>
            
                <label>Gustos e intereses</label>
                <div id="editPreferenceOptions">
                    <label><input type="radio" name="editPreference" value="hombre"> Hombre</label>
                    <label><input type="radio" name="editPreference" value="mujer"> Mujer</label>
                    <label><input type="radio" name="editPreference" value="ambos"> Ambos</label>
                </div>
            
                <label>Género</label>
                <div id="editGeneroOptions">
                    <label><input type="radio" name="editGenero" value="hombre"> Hombre</label>
                    <label><input type="radio" name="editGenero" value="mujer"> Mujer</label>
                </div>

                <div class="profile-delete-section">
                    <button type="button" id="deleteProfileBtn" class="btn-danger btn-danger--small">Eliminar Perfil</button>
                </div>

                <button type="button" id="saveProfileBtn" class="btn-primary save-btn" onclick="saveProfileChanges()">Guardar cambios</button>
            </form>
        </div>
    </div>
`;
    
    // Backdrop para cerrar el modal al hacer click fuera
    const backdrop = document.createElement('div');
    backdrop.className = 'profile-modal-backdrop';
    backdrop.onclick = hideProfileModal;
    
    document.body.appendChild(backdrop);
    document.body.appendChild(modal);
    
    // Event listeners para las pestañas
    const tabs = modal.querySelectorAll('.profile-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabType = tab.dataset.tab;
            switchProfileTab(tabType);
        });
    });
    
    // Event listener para la foto de perfil
    const photoInput = document.getElementById('newProfilePhoto');
    if (photoInput) {
        photoInput.addEventListener('change', (e) => handleProfilePhotoChange(e, 'profilePhotoEdit'));
    }
    
    // Event listener para la segunda foto
    const photoInput2 = document.getElementById('newProfilePhoto2');
    if (photoInput2) {
        photoInput2.addEventListener('change', (e) => handleProfilePhotoChange(e, 'profilePhotoEdit2'));
    }

    // Listener para el botón Eliminar Perfil (asegurar que se añade cuando el modal se crea)
    const deleteBtnLocal = document.getElementById('deleteProfileBtn');
    if (deleteBtnLocal) {
        deleteBtnLocal.addEventListener('click', showDeleteProfileDialog);
    }
}

function showProfileModal() {
    const modal = document.getElementById('profileModal');
    const backdrop = document.querySelector('.profile-modal-backdrop');
    if (modal && backdrop) {
        modal.style.display = 'block';
        backdrop.style.display = 'block';
        // Asegurar que siempre se muestre la pestaña de vista al abrir el modal
        try { switchProfileTab('view'); } catch(e) { /* ignore */ }
    }
}

function hideProfileModal() {
    const modal = document.getElementById('profileModal');
    const backdrop = document.querySelector('.profile-modal-backdrop');
    if (modal && backdrop) {
        // Restaurar la pestaña de vista (descartar cambios en edición)
        try { switchProfileTab('view'); } catch(e) { /* ignore */ }

        // Limpiar input temporal de foto si existe
        try {
            const photoInput = document.getElementById('newProfilePhoto');
            if (photoInput) photoInput.value = '';
        } catch(e) {}

        // Eliminar cualquier diálogo secundario de eliminación de perfil si está abierto
        try {
            const delDlg = document.getElementById('deleteProfileDialog');
            const delBackdrop = document.getElementById('deleteProfileBackdrop');
            if (delDlg) delDlg.remove();
            if (delBackdrop) delBackdrop.remove();
        } catch(e) {}

        modal.style.display = 'none';
        backdrop.style.display = 'none';
    }
}

function switchProfileTab(tabType) {
    const tabs = document.querySelectorAll('.profile-tab');
    const viewContent = document.getElementById('viewProfileContent');
    const editContent = document.getElementById('editProfileContent');
    
    tabs.forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tabType}"]`).classList.add('active');
    
    if (tabType === 'view') {
        viewContent.style.display = 'block';
        editContent.style.display = 'none';
    } else {
        viewContent.style.display = 'none';
        editContent.style.display = 'block';
        populateEditForm();
    }
}

async function loadProfileData() {
    try {
        const doc = await db.collection('users').doc(currentUserId).get();
        if (!doc.exists) {
            alert('Perfil no encontrado');
            return;
        }
        
        const data = doc.data();
        
        // Actualizar vista del perfil
        document.getElementById('profileNameView').textContent = data.userName || 'Sin nombre';
        // Mostrar la preferencia (compatibilidad con registros antiguos que usan `interests` libre)
        document.getElementById('profileInterestsView').textContent = data.preference || data.interests || 'No especificado';
        document.getElementById('profileGeneroView').textContent = data.gender || 'No especificado';

        // Actualizar hábitos
        const habitsContainer = document.getElementById('profileHabitsView');
        habitsContainer.innerHTML = '';
        if (data.habits && data.habits.length > 0) {
            data.habits.forEach(habit => {
                const tag = document.createElement('span');
                tag.className = 'habit-tag';
                tag.textContent = habit;
                habitsContainer.appendChild(tag);
            });
        } else {
            habitsContainer.innerHTML = '<p>No hay hábitos registrados</p>';
        }
        
        // Actualizar foto principal
        const photoContainer = document.getElementById('profilePhotoView');
        if (data.photoURL) {
            const img = document.createElement('img');
            img.src = data.photoURL;
            img.alt = 'Foto principal';
            img.onerror = function() {
                console.warn('Imagen de perfil bloqueada:', img.src);
                photoContainer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="50" height="50" fill="#999"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.6 0-10.8 1.8-10.8 5.4V22h21.6v-2.2c0-3.6-7.2-5.4-10.8-5.4z"/></svg>';
            };
            photoContainer.innerHTML = '';
            photoContainer.appendChild(img);
        } else {
            photoContainer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="50" height="50" fill="#999"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.6 0-10.8 1.8-10.8 5.4V22h21.6v-2.2c0-3.6-7.2-5.4-10.8-5.4z"/></svg>';
        }
        
        // Actualizar segunda foto (solo visible para el dueño)
        const photoContainer2 = document.getElementById('profilePhotoView2');
        if (photoContainer2) {
            if (data.photoURL2) {
                const img2 = document.createElement('img');
                img2.src = data.photoURL2;
                img2.alt = 'Segunda foto';
                img2.onerror = function() {
                    console.warn('Segunda imagen bloqueada:', img2.src);
                    photoContainer2.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="50" height="50" fill="#999"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.6 0-10.8 1.8-10.8 5.4V22h21.6v-2.2c0-3.6-7.2-5.4-10.8-5.4z"/></svg>';
                };
                photoContainer2.innerHTML = '';
                photoContainer2.appendChild(img2);
            } else {
                photoContainer2.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="50" height="50" fill="#999"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.6 0-10.8 1.8-10.8 5.4V22h21.6v-2.2c0-3.6-7.2-5.4-10.8-5.4z"/></svg>';
            }
        }
        
    } catch (err) {
        console.error('Error cargando perfil:', err);
        alert('Error al cargar el perfil');
    }
}

/**
 * Mostrar el perfil de un usuario cualquiera en el modal.
 * Si se pasa `userData` se usa directamente, si no se intenta leer desde Firestore.
 * Expuesto globalmente para que otros módulos (p. ej. listausuarios.js) puedan llamarlo.
 */
window.showUserProfile = async function(userId, userData) {
    try {
        createProfileModal();
        // Si se está viendo otro usuario, ocultamos la pestaña 'edit'
        const modal = document.getElementById('profileModal');
        const tabs = modal ? modal.querySelectorAll('.profile-tab') : null;
        if (tabs && tabs.length > 0) {
            tabs.forEach(t => t.style.display = ''); // reset
            // Si es otro usuario (no el actual), ocultamos la pestaña 'edit'
            if (typeof currentUserId !== 'undefined' && userId && userId !== currentUserId) {
                const editTab = modal.querySelector('.profile-tab[data-tab="edit"]');
                if (editTab) editTab.style.display = 'none';
            }
        }
        // forzamos la pestaña de vista
        switchProfileTab('view');

        let data = userData || null;
        if (!data && userId && typeof db !== 'undefined' && db) {
            try {
                const doc = await db.collection('users').doc(userId).get();
                if (doc && doc.exists) data = doc.data();
            } catch (e) {
                console.warn('showUserProfile: no se pudo leer Firestore', e);
            }
        }

        // Rellenar campos con los datos (si no hay datos, usamos valores por defecto)
        const nameEl = document.getElementById('profileNameView');
        const interestsEl = document.getElementById('profileInterestsView');
        const habitsContainer = document.getElementById('profileHabitsView');
        const photoContainer = document.getElementById('profilePhotoView');
        const generoEl = document.getElementById('profileGeneroView');

        if (nameEl) nameEl.textContent = (data && (data.userName || data.username)) || userId || 'Sin nombre';
        // Mostrar preferencia si existe, si no usar interests (compatibilidad)
        if (interestsEl) interestsEl.textContent = (data && (data.preference || data.interests)) || 'No especificado';

        if (generoEl) generoEl.textContent = (data && data.gender) || 'No especificado';

        if (habitsContainer) {
            habitsContainer.innerHTML = '';
            if (data && data.habits && data.habits.length > 0) {
                data.habits.forEach(habit => {
                    const tag = document.createElement('span');
                    tag.className = 'habit-tag';
                    tag.textContent = habit;
                    habitsContainer.appendChild(tag);
                });
            } else {
                habitsContainer.innerHTML = '<p>No hay hábitos registrados</p>';
            }
        }

        if (photoContainer) {
            if (data && data.photoURL) {
                const img = document.createElement('img');
                img.src = data.photoURL;
                img.alt = 'Foto de perfil';
                img.onerror = function() {
                    console.warn('Imagen bloqueada:', img.src);
                    photoContainer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="50" height="50" fill="#999"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.6 0-10.8 1.8-10.8 5.4V22h21.6v-2.2c0-3.6-7.2-5.4-10.8-5.4z"/></svg>';
                };
                photoContainer.innerHTML = '';
                photoContainer.appendChild(img);
            } else if (data && data.photo) {
                const img = document.createElement('img');
                img.src = data.photo;
                img.alt = 'Foto de perfil';
                img.onerror = function() {
                    console.warn('Imagen bloqueada:', img.src);
                    photoContainer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="50" height="50" fill="#999"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.6 0-10.8 1.8-10.8 5.4V22h21.6v-2.2c0-3.6-7.2-5.4-10.8-5.4z"/></svg>';
                };
                photoContainer.innerHTML = '';
                photoContainer.appendChild(img);
            } else {
                photoContainer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="50" height="50" fill="#999"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.6 0-10.8 1.8-10.8 5.4V22h21.6v-2.2c0-3.6-7.2-5.4-10.8-5.4z"/></svg>';
            }
        }

        // Si no es el propio usuario, ocultar controles de edición y segunda foto
        if (typeof currentUserId !== 'undefined' && userId && userId !== currentUserId) {
            const editSection = document.getElementById('editProfileContent');
            if (editSection) editSection.style.display = 'none';
            const editTab = document.querySelector('.profile-tab[data-tab="edit"]');
            if (editTab) editTab.style.display = 'none';
            // ocultar input de foto y botón de cambiar foto si existen
            const photoInput = document.getElementById('newProfilePhoto');
            if (photoInput) photoInput.style.display = 'none';
            const changeBtn = editSection ? editSection.querySelector('button') : null;
            if (changeBtn) changeBtn.style.display = 'none';
            // Ocultar la segunda foto (solo visible para el dueño del perfil)
            const photoContainer2 = document.getElementById('profilePhotoView2');
            if (photoContainer2) photoContainer2.style.display = 'none';
        } else {
            // Si es el propio usuario, asegurar que la segunda foto sea visible
            const photoContainer2 = document.getElementById('profilePhotoView2');
            if (photoContainer2) photoContainer2.style.display = '';
        }

        showProfileModal();
    } catch (err) {
        console.error('showUserProfile error', err);
        alert('No se pudo mostrar el perfil.');
    }
};

async function populateEditForm() {
    try {
        const doc = await db.collection('users').doc(currentUserId).get();
        if (!doc.exists) return;
        
        const data = doc.data();
        
        // Rellenar campos
        document.getElementById('editProfileName').value = data.userName || '';
        
        // ✅ NUEVO: Rellenar altura y peso
        document.getElementById('editProfileAltura').value = data.altura || '';
        document.getElementById('editProfilePeso').value = data.peso || '';
        
        // Rellenar la preferencia (editPreference radios). Usar `preference` si existe, si no `interests`.
        try {
            const pref = data.preference || data.interests || 'ambos';
            const radios = document.querySelectorAll('input[name="editPreference"]');
            radios.forEach(r => r.checked = (r.value === pref));
        } catch (e) {
            // si no existen los radios (por alguna razón), no hacemos nada
        }

        // Rellenar el género
        try {
            const genero = data.gender || '';
            const generoRadios = document.querySelectorAll('input[name="editGenero"]');
            generoRadios.forEach(r => r.checked = (r.value === genero));
        } catch (e) {
            // si no existen los radios, no hacemos nada
        }
        
        // Marcar hábitos
        const checkboxes = document.querySelectorAll('input[name="editHabit"]');
        checkboxes.forEach(cb => {
            cb.checked = data.habits ? data.habits.includes(cb.value) : false;
        });
        
        // Mostrar foto principal actual
        const photoContainer = document.getElementById('profilePhotoEdit');
        if (data.photoURL) {
            const img = document.createElement('img');
            img.src = data.photoURL;
            img.alt = 'Foto principal';
            img.onerror = function() {
                console.warn('Imagen bloqueada:', img.src);
                photoContainer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="50" height="50" fill="#999"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.6 0-10.8 1.8-10.8 5.4V22h21.6v-2.2c0-3.6-7.2-5.4-10.8-5.4z"/></svg>';
            };
            photoContainer.innerHTML = '';
            photoContainer.appendChild(img);
        } else {
            photoContainer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="50" height="50" fill="#999"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.6 0-10.8 1.8-10.8 5.4V22h21.6v-2.2c0-3.6-7.2-5.4-10.8-5.4z"/></svg>';
        }
        
        // Mostrar segunda foto actual
        const photoContainer2 = document.getElementById('profilePhotoEdit2');
        if (photoContainer2) {
            if (data.photoURL2) {
                const img2 = document.createElement('img');
                img2.src = data.photoURL2;
                img2.alt = 'Segunda foto';
                img2.onerror = function() {
                    console.warn('Segunda imagen bloqueada:', img2.src);
                    photoContainer2.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="50" height="50" fill="#999"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.6 0-10.8 1.8-10.8 5.4V22h21.6v-2.2c0-3.6-7.2-5.4-10.8-5.4z"/></svg>';
                };
                photoContainer2.innerHTML = '';
                photoContainer2.appendChild(img2);
            } else {
                photoContainer2.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="50" height="50" fill="#999"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.6 0-10.8 1.8-10.8 5.4V22h21.6v-2.2c0-3.6-7.2-5.4-10.8-5.4z"/></svg>';
            }
        }
        
    } catch (err) {
        console.error('Error poblando formulario:', err);
        alert('Error al cargar datos para edición');
    }
}

async function handleProfilePhotoChange(event, containerIdParam) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        // Validar tamaño y tipo de archivo
        if (file.size > 5 * 1024 * 1024) { // 5MB máximo
            alert('La imagen es demasiado grande. Máximo 5MB.');
            event.target.value = ''; // Limpiar input
            return;
        }
        
        if (!file.type.startsWith('image/')) {
            alert('Por favor selecciona una imagen válida.');
            event.target.value = '';
            return;
        }
        
        // Mostrar preview en el contenedor correspondiente
        const reader = new FileReader();
        reader.onload = function(e) {
            const containerId = containerIdParam || 'profilePhotoEdit';
            const photoContainer = document.getElementById(containerId);
            if (photoContainer) {
                photoContainer.innerHTML = `<img src="${e.target.result}" alt="Nueva foto">`;
            }
        };
        reader.readAsDataURL(file);
        
    } catch (err) {
        console.error('Error con la foto:', err);
        alert('Error al procesar la imagen: ' + err.message);
    }
}

async function saveProfileChanges() {
    try {
        console.log('Iniciando guardado de cambios...');

        // 1. Recoger datos del formulario
        const newName = document.getElementById('editProfileName').value.trim();
        const newAltura = document.getElementById('editProfileAltura').value.trim();
        const newPeso = document.getElementById('editProfilePeso').value.trim();
        
        const prefEl = document.querySelector('input[name="editPreference"]:checked');
        const generoEl = document.querySelector('input[name="editGenero"]:checked');
        const selectedHabits = Array.from(document.querySelectorAll('input[name="editHabit"]:checked'))
            .map(cb => cb.value);

        // Validación básica
        if (!newName) {
            alert('El nombre es obligatorio');
            return;
        }

        // ✅ NUEVAS VALIDACIONES: Altura y Peso
        if (!newAltura || newAltura === '') {
            alert('La altura es obligatoria');
            return;
        }

        const alturaNum = parseFloat(newAltura);
        if (isNaN(alturaNum) || alturaNum <= 0) {
            alert('La altura debe ser un número positivo');
            return;
        }

        if (alturaNum < 54) {
            alert('La altura introducida es falsa');
            return;
        }

        if (alturaNum > 272) {
            alert('La altura introducida es falsa');
            return;
        }

        if (!newPeso || newPeso === '') {
            alert('El peso es obligatorio');
            return;
        }

        const pesoNum = parseFloat(newPeso);
        if (isNaN(pesoNum) || pesoNum <= 0) {
            alert('El peso debe ser un número positivo');
            return;
        }

        if (pesoNum > 737) {
            alert('El peso introducido es falso');
            return;
        }

        // 2. Obtener datos actuales del usuario (necesario para valores por defecto)
        console.log('Obteniendo datos actuales...');
        const userDoc = await db.collection('users').doc(currentUserId).get();
        if (!userDoc.exists) {
            alert('Error: Perfil no encontrado');
            return;
        }
        const currentData = userDoc.data();

        // Ahora que tenemos `currentData`, calcular las opciones que dependen de él
        const newPreference = prefEl ? prefEl.value : (currentData && (currentData.preference || currentData.interests) ? (currentData.preference || currentData.interests) : 'ambos');
        const newGenero = generoEl ? generoEl.value : (currentData && (currentData.gender || currentData.genero) ? (currentData.gender || currentData.genero) : '');

        // 3. Procesar foto principal si hay nueva
        console.log('Procesando foto principal...');
        const photoInput = document.getElementById('newProfilePhoto');
        let photoURL = currentData.photoURL || '';

        if (photoInput && photoInput.files && photoInput.files.length > 0) {
            const file = photoInput.files[0];
            console.log('Subiendo nueva foto principal a ImgBB...');

            try {
                if (file.size > 5 * 1024 * 1024) {
                    alert('La imagen principal es demasiado grande. Máximo 5MB.');
                    photoURL = currentData.photoURL || '';
                } else {
                    const formData = new FormData();
                    formData.append('image', file);
                    const API_KEY = 'c44651d43039727932eaf6daf0918e74';

                    const response = await fetch(
                        `https://api.imgbb.com/1/upload?key=${API_KEY}`,
                        {
                            method: 'POST',
                            body: formData
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`Error HTTP: ${response.status}`);
                    }

                    const data = await response.json();

                    if (data.success) {
                        photoURL = data.data.url;
                        console.log('✅ Foto principal subida exitosamente a ImgBB:', photoURL);
                    } else {
                        throw new Error('ImgBB devolvió error');
                    }
                }

            } catch (photoErr) {
                console.error('❌ Error subiendo foto principal:', photoErr);
                alert(`Error al subir la foto principal: ${photoErr.message}`);
                photoURL = currentData.photoURL || '';
                console.log('Se mantendrá la foto principal actual debido al error');
            }
        }

        // 3b. Procesar segunda foto si hay nueva
        console.log('Procesando segunda foto...');
        const photoInput2 = document.getElementById('newProfilePhoto2');
        let photoURL2 = currentData.photoURL2 || '';

        if (photoInput2 && photoInput2.files && photoInput2.files.length > 0) {
            const file2 = photoInput2.files[0];
            console.log('Subiendo nueva segunda foto a ImgBB...');

            try {
                if (file2.size > 5 * 1024 * 1024) {
                    alert('La segunda imagen es demasiado grande. Máximo 5MB.');
                    photoURL2 = currentData.photoURL2 || '';
                } else {
                    const formData2 = new FormData();
                    formData2.append('image', file2);
                    const API_KEY = 'c44651d43039727932eaf6daf0918e74';

                    const response2 = await fetch(
                        `https://api.imgbb.com/1/upload?key=${API_KEY}`,
                        {
                            method: 'POST',
                            body: formData2
                        }
                    );

                    if (!response2.ok) {
                        throw new Error(`Error HTTP: ${response2.status}`);
                    }

                    const data2 = await response2.json();

                    if (data2.success) {
                        photoURL2 = data2.data.url;
                        console.log('✅ Segunda foto subida exitosamente a ImgBB:', photoURL2);
                    } else {
                        throw new Error('ImgBB devolvió error');
                    }
                }

            } catch (photoErr2) {
                console.error('❌ Error subiendo segunda foto:', photoErr2);
                alert(`Error al subir la segunda foto: ${photoErr2.message}`);
                photoURL2 = currentData.photoURL2 || '';
                console.log('Se mantendrá la segunda foto actual debido al error');
            }
        }

        // 4. Preparar datos para actualizar
        console.log('Preparando datos para actualizar...');
        const updateData = {
            userId: currentUserId,
            userName: newName,
            preference: newPreference,
            interests: newPreference || '',
            gender: newGenero,
            genero: newGenero,
            habits: selectedHabits || [],
            photoURL: photoURL,
            photoURL2: photoURL2,
            altura: alturaNum,  // ✅ NUEVO
            peso: pesoNum,      // ✅ NUEVO
            age: currentData.age || 18,
            createdAt: currentData.createdAt || firebase.firestore.FieldValue.serverTimestamp()
        };

        // 5. Guardar en Firestore
        console.log('Guardando cambios en Firestore...');
        await db.collection('users').doc(currentUserId).set(updateData, { merge: true });

        // 6. Actualizar UI
        console.log('Actualizando UI...');
        await loadProfileData();
        updateProfileButton();
        document.getElementById('user-info').textContent = 'Conectado como: ' + newName;

        // 7. Limpiar formulario de fotos
        if (photoInput) photoInput.value = '';
        if (photoInput2) photoInput2.value = '';

        // 8. Mostrar confirmación y cambiar a vista
        console.log('✅ ¡Cambios guardados exitosamente!');
        alert('Perfil actualizado correctamente');
        switchProfileTab('view');

    } catch (err) {
        console.error('❌ Error guardando cambios:', err);
        alert('Error al guardar los cambios: ' + err.message);
    }
}

// Actualiza el botón de perfil: si hay foto la muestra, si no muestra la silueta
async function updateProfileButton() {
    const btn = document.getElementById('profileBtn');
    if (!btn) return;
    console.log('[updateProfileButton] START user:', currentUserId);

    // Caso sin usuario
    if (!currentUserId) {
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.6 0-10.8 1.8-10.8 5.4V22h21.6v-2.2c0-3.6-7.2-5.4-10.8-5.4z"/></svg>';
        btn.title = 'Iniciar sesión / Crear cuenta';
        return;
    }

    let data;
    try {
        const doc = await db.collection('users').doc(currentUserId).get();
        data = doc.exists ? (doc.data() || {}) : {};
    } catch (e) {
        console.warn('[updateProfileButton] Firestore error:', e);
        data = {};
    }

    const photoSrc = data.photoURL || data.photo || null;
    const displayName = data.userName || data.username || 'Mi perfil';
    btn.title = displayName;

    // Limpia siempre para evitar imagen anterior
    btn.innerHTML = '';

    if (!photoSrc) {
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.6 0-10.8 1.8-10.8 5.4V22h21.6v-2.2c0-3.6-7.2-5.4-10.8-5.4z"/></svg>';
        console.log('[updateProfileButton] No photo, showing silhouette');
        return;
    }

    // Añadir cache bust para evitar imagen anterior (solo si es misma URL)
    const cacheBust = (photoSrc.includes('?') ? '&' : '?') + 'cb=' + Date.now();
    const finalSrc = photoSrc + cacheBust;
    const img = document.createElement('img');
    img.alt = 'Foto de perfil';
    img.src = finalSrc;
    img.loading = 'eager';
    img.decoding = 'async';
    img.onerror = () => {
        console.warn('[updateProfileButton] Error cargando foto, fallback');
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.6 0-10.8 1.8-10.8 5.4V22h21.6v-2.2c0-3.6-7.2-5.4-10.8-5.4z"/></svg>';
    };
    img.onload = () => console.log('[updateProfileButton] Foto cargada ok');
    btn.appendChild(img);
    console.log('[updateProfileButton] Foto aplicada:', finalSrc);
}

// ========================================
// FUNCIÓN: MOSTRAR CHAT
// ========================================
/*
   mostrar_chat()
   
   Función pública que muestra la ventana de chat en pantalla.
   
   ¿Qué hace?
   1. Cambia el estilo display de 'none' a 'flex'
   2. Actualiza la variable de estado chatIsVisible a true
   3. Registra la acción en la consola para debugging
   
   ¿Por qué 'flex'?
   El contenedor del chat usa flexbox para organizar horizontalmente
   la barra lateral y la ventana de mensajes.
   
   ¿Cuándo se llama?
   - Cuando el usuario hace clic en el botón flotante (y el chat está oculto)
   - Puede ser llamada desde otras partes del código en el futuro
     (por ejemplo, al recibir un mensaje nuevo)
*/
function mostrar_chat() {
    chatScreen.style.display = 'flex';
    chatIsVisible = true;
    console.log('Chat mostrado');
}

// ========================================
// FUNCIÓN: OCULTAR CHAT
// ========================================
/*
   ocultar_chat()
   
   Función pública que oculta la ventana de chat de la pantalla.
   
   ¿Qué hace?
   1. Cambia el estilo display a 'none'
   2. Actualiza la variable de estado chatIsVisible a false
   3. Registra la acción en la consola para debugging
   
   IMPORTANTE: NO borra los mensajes ni cierra la sesión.
   Solo oculta visualmente el chat. Los mensajes siguen
   cargándose en tiempo real en segundo plano.
   
   ¿Cuándo se llama?
   - Cuando el usuario hace clic en el botón flotante (y el chat está visible)
   - Puede ser llamada desde otras partes del código en el futuro
     (por ejemplo, al cerrar sesión)
*/
function ocultar_chat() {
    chatScreen.style.display = 'none';
    chatIsVisible = false;
    console.log('Chat ocultado');
}

// ========================================
// FUNCIONES DE AUTENTICACIÓN Y REGISTRO
// ========================================

// Mostrar formulario de registro
function showRegisterForm() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('register-screen').style.display = 'block';
    updateProfileButtonVisibility();
}

// Volver al login
function showLoginForm() {
    document.getElementById('login-screen').style.display = 'block';
    document.getElementById('register-screen').style.display = 'none';
    document.getElementById('chat-screen').style.display = 'none';
    document.getElementById('nav-bar').style.display = 'none';
    // Ensure no modals or panels remain open when returning to login
    try { hideProfileModal(); } catch(e) { /* ignore if not present */ }
    try { closeAllPanels(); } catch(e) { /* ignore */ }
    // Limpiar errores y campos
    document.getElementById('login-error').textContent = '';
    document.getElementById('register-error').textContent = '';
    if (document.getElementById('login-email')) {
        document.getElementById('login-email').value = '';
    }
    if (document.getElementById('login-password')) {
        document.getElementById('login-password').value = '';
    }
    updateProfileButtonVisibility();
}

/// Iniciar sesión con email y contraseña O nombre de usuario y contraseña
async function login() {
    const emailOrUsername = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorElement = document.getElementById('login-error');
    
    if (!emailOrUsername || emailOrUsername === '') {
        errorElement.textContent = 'Por favor ingresa tu email o nombre de usuario';
        return;
    }
    
    if (!password || password.trim() === '') {
        errorElement.textContent = 'Por favor ingresa tu contraseña';
        return;
    }
    
    try {
        errorElement.textContent = 'Iniciando sesión...';

        // Asegurar persistencia por pestaña (session) para permitir múltiples sesiones en diferentes pestañas
        try {
            await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
        } catch (pErr) {
            console.warn('No se pudo establecer persistencia SESSION en Auth:', pErr);
        }

        // ✅ NUEVA LÓGICA: Detectar si es email o username
        let emailToUse = emailOrUsername;
        
        // Si NO contiene '@', asumimos que es un nombre de usuario
        if (!emailOrUsername.includes('@')) {
            console.log('Detectado nombre de usuario, buscando email asociado...');
            
            try {
                // Buscar el email asociado a este nombre de usuario en Firestore
                const usersSnapshot = await db.collection('users')
                    .where('userName', '==', emailOrUsername)
                    .limit(1)
                    .get();
                
                if (usersSnapshot.empty) {
                    errorElement.style.color = 'red';
                    errorElement.textContent = 'Usuario o contraseña incorrectos';
                    return;
                }
                
                // Obtener el email del documento encontrado
                const userDoc = usersSnapshot.docs[0];
                const userData = userDoc.data();
                emailToUse = userData.email;
                
                console.log('Email encontrado para el usuario:', emailToUse);
                
            } catch (firestoreError) {
                console.error('Error buscando usuario en Firestore:', firestoreError);
                errorElement.style.color = 'red';
                errorElement.textContent = 'Error al buscar usuario';
                return;
            }
        }

        // ✅ Autenticar con Firebase Auth usando el email (original o encontrado)
        const userCredential = await auth.signInWithEmailAndPassword(emailToUse, password);
        const user = userCredential.user;

        // Persistir sesión por pestaña (sessionStorage). No usar localStorage para evitar compartir sesión entre pestañas
        try { 
            sessionStorage.setItem('chat_currentUserId', user.uid); 
        } catch(e) { 
            console.warn('No se pudo persistir sesión en sessionStorage tras login:', e); 
        }

        // El resto se maneja en onAuthStateChanged
        errorElement.style.color = 'green';
        errorElement.textContent = '¡Iniciando sesión!';
        
    } catch (error) {
        errorElement.style.color = 'red';
        let message = 'Error al iniciar sesión';
        
        switch(error.code) {
            case 'auth/user-not-found':
            case 'auth/wrong-password':
            case 'auth/invalid-credential':  
                message = 'Usuario o contraseña incorrectos';
                break;
            case 'auth/invalid-email':
                message = 'Formato de email inválido';
                break;
            case 'auth/user-disabled':
                message = 'Esta cuenta ha sido deshabilitada';
                break;
            case 'auth/too-many-requests':
                message = 'Demasiados intentos fallidos. Inténtalo más tarde.';
                break;
            default:
                message = 'Usuario o contraseña incorrectos'; 
        }
        
        errorElement.textContent = message;
        console.error('Error al iniciar sesión:', error);
    }
}

// Preview de foto de perfil
function previewProfilePhoto(event, previewId) {
    const file = event.target.files[0];
    const preview = document.getElementById(previewId || 'photo-preview');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
        };
        reader.readAsDataURL(file);
    }
}

// Completar registro con encuesta y autenticación
async function completeRegistration() {
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const name = document.getElementById('register-name').value;
    const photoFile = document.getElementById('profile-photo').files[0];
    const photoFile2 = document.getElementById('profile-photo-2').files[0];
    // Leer la preferencia seleccionada en el registro (radio name="preference")
    const prefEl = document.querySelector('input[name="preference"]:checked');
    const interests = prefEl ? prefEl.value : 'ambos';
    const age = document.getElementById('age').value;
    const generoEl = document.querySelector('input[name="genero"]:checked');
    const genero = generoEl ? generoEl.value : '';
    const altura = document.getElementById('altura').value;
    const peso = document.getElementById('peso').value;
    const errorElement = document.getElementById('register-error');

    // Obtener hábitos seleccionados
    const habitsCheckboxes = document.querySelectorAll('input[name="habit"]:checked');
    const habits = Array.from(habitsCheckboxes).map(cb => cb.value);

    // Validaciones
    if (!email || email.trim() === '') {
        errorElement.textContent = 'Por favor ingresa tu email';
        return;
    }

    if (!password || password.trim() === '') {
        errorElement.textContent = 'Por favor ingresa una contraseña';
        return;
    }

    if (password.length < 6) {
        errorElement.textContent = 'La contraseña debe tener mínimo 6 caracteres';
        return;
    }

    if (!name || name.trim() === '') {
        errorElement.textContent = 'Por favor ingresa tu nombre de usuario';
        return;
    }

    if (!age || age < 18) {
        errorElement.textContent = 'Debes ser mayor de 18 años';
        return;
    }

    if(!genero) {
        errorElement.textContent = 'Por favor selecciona tu género';
        return;
    }

    // ✅ NUEVA VALIDACIÓN: Ambas fotos obligatorias
    if (!photoFile) {
        errorElement.textContent = 'La foto principal es obligatoria';
        return;
    }

    if (!photoFile2) {
        errorElement.textContent = 'La segunda foto es obligatoria';
        return;
    }

    // ✅ NUEVA VALIDACIÓN: Altura obligatoria
    if (!altura || altura.trim() === '') {
        errorElement.textContent = 'La altura es obligatoria';
        return;
    }

    const alturaNum = parseFloat(altura);
    if (isNaN(alturaNum) || alturaNum <= 0) {
        errorElement.textContent = 'La altura debe ser un número positivo';
        return;
    }

    if (alturaNum < 54) {
        errorElement.textContent = 'La altura introducida es falsa';
        return;
    }

    if (alturaNum > 272) {
        errorElement.textContent = 'La altura introducida es falsa';
        return;
    }

    // ✅ NUEVA VALIDACIÓN: Peso obligatorio
    if (!peso || peso.trim() === '') {
        errorElement.textContent = 'El peso es obligatorio';
        return;
    }

    const pesoNum = parseFloat(peso);
    if (isNaN(pesoNum) || pesoNum <= 0) {
        errorElement.textContent = 'El peso debe ser un número positivo';
        return;
    }

    if (pesoNum > 737) {
        errorElement.textContent = 'El peso introducido es falso';
        return;
    }

    try {
        errorElement.textContent = 'Verificando disponibilidad del nombre...';

        // Verificar si el nombre de usuario ya existe
        const existingUsers = await db.collection('users')
            .where('userName', '==', name.trim())
            .get();

        if (!existingUsers.empty) {
            errorElement.textContent = 'Este nombre de usuario ya está en uso. Por favor elige otro.';
            return;
        }

        errorElement.textContent = 'Creando cuenta...';

        // Asegurar persistencia por pestaña (session) para permitir múltiples sesiones en diferentes pestañas
        try {
            await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
        } catch (pErr) {
            console.warn('No se pudo establecer persistencia SESSION en Auth:', pErr);
        }

        // 1. Crear usuario en Firebase Auth
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Establecer ID de usuario
        currentUserId = user.uid;
        currentUserName = name.trim();
        // Persistir sesión por pestaña (sessionStorage). No usar localStorage para evitar compartir sesión entre pestañas
        try { sessionStorage.setItem('chat_currentUserId', currentUserId); } catch(e) { console.warn('No se pudo persistir sesión en sessionStorage tras registro:', e); }

        // ✅ Subir foto principal a ImgBB
        let photoURL = '';
        errorElement.textContent = 'Subiendo foto principal...';
        try {
            const formData = new FormData();
            formData.append('image', photoFile);
            const API_KEY = 'c44651d43039727932eaf6daf0918e74';

            const response = await fetch(
                `https://api.imgbb.com/1/upload?key=${API_KEY}`,
                {
                    method: 'POST',
                    body: formData
                }
            );

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                photoURL = data.data.url;
                console.log('✅ Foto principal subida a ImgBB:', photoURL);
            } else {
                throw new Error('ImgBB devolvió error');
            }
        } catch (upErr) {
            console.error('Error subiendo foto principal durante registro:', upErr);
            errorElement.textContent = 'Imagen principal no soportada';
            // ✅ ELIMINAR usuario de Firebase Auth si falla la foto
            try {
                await user.delete();
                console.log('Usuario eliminado de Auth tras error de foto principal');
            } catch (deleteErr) {
                console.error('Error eliminando usuario tras fallo de foto:', deleteErr);
            }
            return;
        }

        // ✅ Subir segunda foto a ImgBB
        let photoURL2 = '';
        errorElement.textContent = 'Subiendo segunda foto...';
        try {
            const formData2 = new FormData();
            formData2.append('image', photoFile2);
            const API_KEY = 'c44651d43039727932eaf6daf0918e74';

            const response2 = await fetch(
                `https://api.imgbb.com/1/upload?key=${API_KEY}`,
                {
                    method: 'POST',
                    body: formData2
                }
            );

            if (!response2.ok) {
                throw new Error(`Error HTTP: ${response2.status}`);
            }

            const data2 = await response2.json();

            if (data2.success) {
                photoURL2 = data2.data.url;
                console.log('✅ Segunda foto subida a ImgBB:', photoURL2);
            } else {
                throw new Error('ImgBB devolvió error');
            }
        } catch (upErr2) {
            console.error('Error subiendo segunda foto durante registro:', upErr2);
            errorElement.textContent = 'Segunda imagen no soportada';
            // ✅ ELIMINAR usuario de Firebase Auth si falla la segunda foto
            try {
                await user.delete();
                console.log('Usuario eliminado de Auth tras error de segunda foto');
            } catch (deleteErr) {
                console.error('Error eliminando usuario tras fallo de segunda foto:', deleteErr);
            }
            return;
        }

        // Guardar perfil completo en Firestore usando el UID de Firebase Auth
        errorElement.textContent = 'Guardando perfil...';
        await db.collection('users').doc(user.uid).set({
            userId: user.uid,
            userName: name.trim(),
            email: email,
            photoURL: photoURL,
            photoURL2: photoURL2,
            habits: habits,
            preference: interests,
            interests: interests,
            gender: genero,
            age: parseInt(age),
            altura: alturaNum,
            peso: pesoNum,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        errorElement.style.color = 'green';
        errorElement.textContent = '¡Perfil creado con éxito! Redirigiendo...';

        // El auth.onAuthStateChanged se encargará de cargar el perfil automáticamente

    } catch (error) {
        errorElement.style.color = 'red';
        let message = 'Error al crear cuenta';
        
        switch(error.code) {
            case 'auth/email-already-in-use':
                message = 'Este email ya está registrado. Usa "Iniciar Sesión"';
                break;
            case 'auth/weak-password':
                message = 'La contraseña debe tener mínimo 6 caracteres';
                break;
            case 'auth/invalid-email':
                message = 'El email no es válido';
                break;
            default:
                message = 'Error: ' + error.message;
        }
        
        errorElement.textContent = message;
        console.error('Error al crear perfil:', error);
    }
}

/* VERSIÓN CON AUTENTICACIÓN (COMENTADA)
async function completeRegistration() {
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const photoFile = document.getElementById('profile-photo').files[0];
    const interests = document.getElementById('interests').value;
    const age = document.getElementById('age').value;
    const errorElement = document.getElementById('register-error');
    
    // Obtener hábitos seleccionados
    const habitsCheckboxes = document.querySelectorAll('input[name="habit"]:checked');
    const habits = Array.from(habitsCheckboxes).map(cb => cb.value);
    
    // Validaciones
    if (!name || !email || !password) {
        errorElement.textContent = 'Por favor completa los campos obligatorios (nombre, email, contraseña)';
        return;
    }
    
    if (password.length < 6) {
        errorElement.textContent = 'La contraseña debe tener mínimo 6 caracteres';
        return;
    }
    
    if (!age || age < 18) {
        errorElement.textContent = 'Debes ser mayor de 18 años';
        return;
    }
    
    try {
        errorElement.textContent = 'Creando cuenta...';

        // Asegurar persistencia por pestaña (session) para permitir múltiples sesiones en diferentes pestañas
        try {
            await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
        } catch (pErr) {
            console.warn('No se pudo establecer persistencia SESSION en Auth:', pErr);
        }

        // 1. Crear usuario en Firebase Auth
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // 2. Subir foto de perfil si existe
        let photoURL = '';
        if (photoFile) {
            errorElement.textContent = 'Subiendo foto de perfil...';
            const storageRef = storage.ref(`profile-photos/${user.uid}`);
            await storageRef.put(photoFile);
            photoURL = await storageRef.getDownloadURL();
        }
        
        // 3. Guardar perfil completo en Firestore
        errorElement.textContent = 'Guardando perfil...';
        // Transformar el nombre de usuario: minúsculas y guiones bajos
        const formattedUserName = name.toLowerCase().replace(/\s+/g, '_');
        await db.collection('users').doc(user.uid).set({
            userId: user.uid,
            userName: formattedUserName,
            email: email,
            photoURL: photoURL,
            habits: habits,
            interests: interests,
            age: parseInt(age),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        errorElement.style.color = 'green';
        errorElement.textContent = '¡Cuenta creada con éxito! Redirigiendo...';
        
        // El auth.onAuthStateChanged se encargará de cargar el perfil automáticamente
        
    } catch (error) {
        errorElement.style.color = 'red';
        if (error.code === 'auth/email-already-in-use') {
            errorElement.textContent = 'Este email ya está registrado. Usa "Iniciar Sesión"';
        } else if (error.code === 'auth/weak-password') {
            errorElement.textContent = 'La contraseña debe tener mínimo 6 caracteres';
        } else if (error.code === 'auth/invalid-email') {
            errorElement.textContent = 'El email no es válido';
        } else {
            errorElement.textContent = 'Error: ' + error.message;
        }
    }
}
*/

// Cargar perfil de usuario
async function loadUserProfile() {
    try {
        const userDoc = await db.collection('users').doc(currentUserId).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            currentUserName = userData.userName;
            document.getElementById('user-info').textContent = 'Conectado como: ' + currentUserName;
            console.log('[OK] Perfil de usuario cargado');
            
            // Actualizar botón de perfil con la foto del usuario
            await updateProfileButton();
        } else {
            console.error('No se encontró el perfil del usuario');
        }
    } catch (error) {
        console.error('Error al cargar perfil:', error);
    }
}

// ========================================
// FUNCIÓN: CERRAR SESIÓN
// ========================================
function logout() {
    // Cerrar chat activo si lo hay
    if (currentChatId) {
        closeCurrentChat();
    }
    
    // Desuscribir listener de chats
    if (chatsListener) {
        chatsListener();
        chatsListener = null;
    }

    // Limpiar la ventana de chat
    showEmptyState();
    
        // Limpiar lista de usuarios si existe
        const usersList = document.getElementById('users-list');
        if (usersList) {
            usersList.innerHTML = '';
        }
    
        // Limpiar panel de usuarios
        const usersPanel = document.getElementById('users-panel');
        if (usersPanel) {
            usersPanel.classList.add('hidden');
        }
    
        // Limpiar menú de perfil
        const profileMenu = document.getElementById('profileMenu');
        if (profileMenu) {
            profileMenu.style.display = 'none';
        }
    
    // Limpiar variables
    // Limpiar persistencia de sesión (solo sessionStorage para mantener sesiones por pestaña)
    try { sessionStorage.removeItem('chat_currentUserId'); } catch(e) { console.warn('No se pudo limpiar sessionStorage en logout:', e); }
    currentUserId = '';
    currentUserName = '';
    currentUser = null;
    
    // Limpiar el botón de perfil
    const btn = document.getElementById('profileBtn');
    if (btn) {
            btn.innerHTML = '<svg id="profileSvg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.6 0-10.8 1.8-10.8 5.4V22h21.6v-2.2c0-3.6-7.2-5.4-10.8-5.4z"/></svg>';
        btn.title = 'Iniciar sesión / Crear cuenta';
    }
    
    // Cerrar sesión en Firebase Auth
    auth.signOut()
        .then(() => {
            console.log('Sesión cerrada correctamente');
            // El onAuthStateChanged manejará el resto
        })
        .catch((error) => {
            console.error('Error al cerrar sesión:', error);
        });

    if (typeof window.hideGameButton === 'function') window.hideGameButton();

    if (typeof window.cleanupGameListeners === 'function') {
        window.cleanupGameListeners();
    }

    // Cerrar todos los paneles
    closeAllPanels();
}

// ========================================
// FUNCIÓN: GENERAR ID DE CHAT
// ========================================
/*
   generateChatId(userId1, userId2)
   
   Genera un ID único para una conversación entre dos usuarios.
   
   Importante: El ID es SIEMPRE el mismo independientemente del orden
   de los usuarios. Esto asegura que no se creen chats duplicados.
   
   Ejemplo:
   - generateChatId("maria", "juan") -> "juan_maria"
   - generateChatId("juan", "maria") -> "juan_maria"
   
   Ambos generan el mismo ID porque se ordenan alfabéticamente.
*/

//**IMPORTANTE***  COPILOT NO PUEDE MODIFICAR ESTA FUNCION
function generateChatId(userId1, userId2) {
    // Ordenar alfabéticamente para garantizar consistencia
    const sortedIds = [userId1, userId2].sort();
    return sortedIds.join('_');
}

// ========================================
// FUNCIÓN: CARGAR CHATS DEL USUARIO
// ========================================
/*
   loadUserChats()
   
   Carga y muestra en la barra lateral todos los chats
   en los que participa el usuario actual.
   
   ¿Cómo funciona?
   1. Consulta Firebase buscando chats donde el usuario es participante
   2. Ordena los chats por el mensaje más reciente primero
   3. Renderiza cada chat en la barra lateral
   4. Si no hay chats, muestra el mensaje "No hay chats registrados"
   
   Esta función se ejecuta:
   - Al iniciar sesión
   - En tiempo real cuando se crean nuevos chats
*/
function loadUserChats() {
    const chatList = document.getElementById('chat-list');
    const noChatsMessage = document.getElementById('no-chats-message');
    
    // Si ya hay un listener activo, NO crear otro
    if (chatsListener) {
        console.log('Ya existe un listener de chats activo');
        return;
    }
    
    console.log('Creando listener de chats...');
    
    // Escuchar cambios en tiempo real
    // Usamos un handler async para evitar condiciones de carrera al crear
    // elementos DOM desde llamadas async (p.ej. obtener nombre del otro usuario).
    chatsListener = db.collection('chats')
        .where('participants', 'array-contains', currentUserId)
        .orderBy('lastMessageTime', 'desc')
        .onSnapshot(async snapshot => {
            console.log('Snapshot de chats recibido:', snapshot.size, 'chats');

            try {
                if (snapshot.empty) {
                    // No hay chats: limpiar y mostrar mensaje
                    chatList.innerHTML = '';
                    chatList.appendChild(noChatsMessage);
                    console.log('No hay chats para este usuario');
                    return;
                }

                // Transformar cada doc en una promesa que resuelve al elemento DOM
                const itemPromises = snapshot.docs.map(async doc => {
                    const chatData = doc.data();
                    return await renderChatItem(doc.id, chatData);
                });

                // Esperar a que todos los elementos estén listos
                const chatItems = await Promise.all(itemPromises);

                // Reemplazar contenido de forma atómica para evitar duplicados
                chatList.innerHTML = '';
                const frag = document.createDocumentFragment();
                chatItems.forEach(item => {
                    if (item) frag.appendChild(item);
                });
                chatList.appendChild(frag);

                console.log(`Renderizados ${chatItems.length} chats`);
            } catch (err) {
                console.error('Error procesando snapshot de chats:', err);
            }
        }, error => {
            console.error('Error al cargar chats:', error);
        });
}

// ========================================
// FUNCIÓN: RENDERIZAR ITEM DE CHAT
// ========================================
/*
   renderChatItem(chatId, chatData)
   
   Crea y añade un elemento visual en la barra lateral
   representando un chat específico.
*/
/**
 * renderChatItem(chatId, chatData)
 * Devuelve el elemento DOM correspondiente al chat. NO lo añade directamente
 * al DOM: quien llama se encarga de insertarlo en el orden correcto. Esto
 * evita duplicados y condiciones de carrera cuando hay operaciones async.
 */
async function renderChatItem(chatId, chatData) {
    // Si este chat fue ocultado optimísticamente por el usuario, no lo renderizamos
    if (typeof locallyHiddenChats !== 'undefined' && locallyHiddenChats.has(chatId)) {
        return null;
    }
    // Determinar el ID del otro usuario
    const otherUserId = chatData.participants.find(id => id !== currentUserId);

    // Si yo bloqueé al otro usuario, no mostrar este chat
    try {
        if (currentUserId) {
            const meDoc = await db.collection('users').doc(currentUserId).get();
            if (meDoc.exists) {
                const meData = meDoc.data() || {};
                if (Array.isArray(meData.blockedUsers) && meData.blockedUsers.includes(otherUserId)) {
                    return null;
                }
            }
        }
    } catch (e) {
        console.warn('renderChatItem: no se pudo comprobar blockedUsers del currentUser:', e);
    }

    // Comprobar si el usuario actual ocultó este chat y cuándo
    const hiddenAtMap = chatData && chatData.hiddenAt ? chatData.hiddenAt : null;
    const hiddenAtForMe = hiddenAtMap && hiddenAtMap[currentUserId] ? hiddenAtMap[currentUserId] : null;

    // Si el chat todavía está marcado como oculto para mí (hiddenFor incluye mi id)
    // y no hay mensajes posteriores a mi marca temporal, no mostrar el chat.
    // Sin embargo, si el chat ya no está en hiddenFor para mí (p. ej. porque se me desbloqueó),
    // lo mostraremos aunque no haya mensajes posteriores: al abrir el chat la carga de mensajes
    // respetará la marca hiddenAt y solo mostrará mensajes posteriores.
    try {
        const hiddenForArray = Array.isArray(chatData.hiddenFor) ? chatData.hiddenFor : [];
        const amIHidingIt = hiddenForArray.includes(currentUserId);
        if (amIHidingIt) {
            // Si hay marca hiddenAt para mí (eliminación previa), ocultar si no hay mensajes posteriores.
            if (hiddenAtForMe) {
                if (!chatData.lastMessageTime || (chatData.lastMessageTime && chatData.lastMessageTime.toMillis() <= hiddenAtForMe.toMillis())) {
                    return null;
                }
            } else {
                // No hay hiddenAt: normalmente esto significa que el chat fue ocultado por bloqueo.
                // En ese caso ocultamos el chat hasta que se quite hiddenFor (p.ej. al desbloquear).
                return null;
            }
        }
    } catch (e) {
        // si hay error, no bloqueamos el render por seguridad
    }

    // Obtener el nombre real del otro usuario
    let otherUserName = otherUserId;
    try {
        const otherUserDoc = await db.collection('users').doc(otherUserId).get();
        if (otherUserDoc.exists) {
            otherUserName = otherUserDoc.data().userName;
        } else {
            // Si no existe el documento del otro usuario, asumir cuenta eliminada.
            // Borrar/eliminar este chat de la vista del usuario actual.
            console.log('[renderChatItem] Usuario participante no encontrado, eliminando chat para el usuario actual:', otherUserId, chatId);
            try {
                // Ocultarlo para este usuario (marca permanente con hiddenAt)
                await deleteChatForMe(chatId, true);
            } catch (e) {
                console.warn('[renderChatItem] Error ocultando chat con usuario borrado:', e);
            }
            return null;
        }
    } catch (error) {
        console.error('Error al obtener nombre de usuario:', error);
    }

    // Contar mensajes no leídos
    let unreadCount = 0;
    try {
        // Construir query de mensajes: si ocultó el chat, sólo contar mensajes posteriores al hiddenAt
        let messagesQuery = db.collection('chats').doc(chatId).collection('messages').where('senderId', '!=', currentUserId);
        if (hiddenAtForMe) {
            messagesQuery = messagesQuery.where('timestamp', '>', hiddenAtForMe);
        }
        const messagesSnapshot = await messagesQuery.get();

        messagesSnapshot.forEach(doc => {
            const msg = doc.data();
            // Contar si no tiene campo readBy o si currentUserId no está en readBy
            if (!msg.readBy || !msg.readBy.includes(currentUserId)) {
                unreadCount++;
            }
        });
    } catch (error) {
        console.error('Error al contar mensajes no leídos:', error);
    }

    // Crear elemento del chat
    const chatItem = document.createElement('div');
    chatItem.className = 'chat-item';
    chatItem.dataset.chatId = chatId;
    chatItem.dataset.partnerId = otherUserId;

    // Marcar como activo si es el chat actual
    if (chatId === currentChatId) {
        chatItem.classList.add('active');
    }

    // Contenido: nombre del otro usuario y contador de mensajes sin leer
    const unreadBadge = unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : '';
    chatItem.innerHTML = `
        <div class="chat-item-name">${otherUserName}</div>
        ${unreadBadge}
    `;

    // Evento: abrir chat al hacer clic
    chatItem.addEventListener('click', () => {
        openChat(chatId, otherUserId, otherUserName);
    });

    // Botón de menú (tres puntos verticales)
    try {
        const menuBtn = document.createElement('button');
        menuBtn.className = 'chat-item-menu-btn';
        menuBtn.title = 'Opciones';
        menuBtn.innerHTML = '&#8942;'; // ⋮ vertical ellipsis
        menuBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            // Toggle del menú simple
            let existing = chatItem.querySelector('.chat-item-menu');
            if (existing) {
                existing.remove();
                return;
            }

            const menu = document.createElement('div');
            menu.className = 'chat-item-menu';
            const del = document.createElement('div');
            del.className = 'chat-item-menu-option';
            del.textContent = 'Eliminar chat';
            del.addEventListener('click', async (e) => {
                e.stopPropagation();
                const ok = confirm('Eliminar chat solo para ti: los mensajes anteriores dejarán de ser visibles para ti. El otro usuario seguirá viendo el historial. ¿Continuar?');
                if (!ok) return;
                await deleteChatForMe(chatId);
            });
            menu.appendChild(del);

            // Opción adicional: Bloquear usuario (por ahora no funcional)
            const blockOpt = document.createElement('div');
            blockOpt.className = 'chat-item-menu-option chat-item-menu-option-block';
            blockOpt.textContent = 'Bloquear usuario';
            blockOpt.addEventListener('click', async (e) => {
                e.stopPropagation();
                const ok = confirm('¿Quieres bloquear a "' + otherUserName + '"? No podrá enviarte mensajes y dejarás de ver su chat.');
                if (!ok) {
                    const existing = chatItem.querySelector('.chat-item-menu');
                    if (existing) existing.remove();
                    return;
                }
                try {
                    await blockUser(otherUserId, chatId);
                    alert('Usuario bloqueado correctamente');
                } catch (err) {
                    console.error('Error bloqueando usuario:', err);
                    alert('No se pudo bloquear al usuario: ' + (err && err.message ? err.message : String(err)));
                }
                // Cerrar el menú
                const existing = chatItem.querySelector('.chat-item-menu');
                if (existing) existing.remove();
            });
            menu.appendChild(blockOpt);
            chatItem.appendChild(menu);
        });

        // Insertar el botón al final del contenido
        const btnContainer = document.createElement('div');
        btnContainer.className = 'chat-item-menu-container';
        btnContainer.appendChild(menuBtn);
        chatItem.appendChild(btnContainer);
    } catch (e) {
        console.warn('No se pudo añadir el botón de menú al chat item:', e);
    }

    return chatItem;
}

// ========================================
// FUNCIÓN: AÑADIR NUEVO CHAT
// ========================================
/*
   addNewChat()
   
   Permite al usuario iniciar una nueva conversación buscando
   usuarios registrados por nombre.
*/
async function addNewChat() {
    const searchTerm = prompt('Introduce el nombre del usuario con el que quieres chatear:');
    
    if (!searchTerm || searchTerm.trim() === '') {
        return; // Usuario canceló
    }
    
    try {
        // Buscar usuario por nombre
        const usersSnapshot = await db.collection('users')
            .where('userName', '==', searchTerm.trim())
            .get();
        
        if (usersSnapshot.empty) {
            alert('No se encontró ningún usuario con ese nombre.');
            return;
        }
        
        const partnerDoc = usersSnapshot.docs[0];
        const partnerId = partnerDoc.id;
        const partnerData = partnerDoc.data();
        
        // No permitir chatear consigo mismo
        if (partnerId === currentUserId) {
            alert('No puedes chatear contigo mismo.');
            return;
        }
        
        // Generar ID del chat
        const chatId = generateChatId(currentUserId, partnerId);
        
        // Abrir el chat (se creará en Firebase al enviar el primer mensaje si no existe)
        openChat(chatId, partnerId, partnerData.userName);
        
    } catch (error) {
        console.error('Error al buscar usuario:', error);
        alert('Error al buscar usuario: ' + error.message);
    }
}

/* VERSIÓN CON BÚSQUEDA POR EMAIL (COMENTADA)
async function addNewChat() {
    const searchTerm = prompt('Introduce el nombre o email del usuario con el que quieres chatear:');
    
    if (!searchTerm || searchTerm.trim() === '') {
        return; // Usuario canceló
    }
    
    try {
        // Buscar usuario por nombre
        const usersSnapshot = await db.collection('users')
            .where('userName', '==', searchTerm.trim())
            .get();
        
        // Si no se encuentra por nombre, buscar por email
        let partnerDoc = null;
        if (usersSnapshot.empty) {
            const emailSnapshot = await db.collection('users')
                .where('email', '==', searchTerm.trim().toLowerCase())
                .get();
            
            if (!emailSnapshot.empty) {
                partnerDoc = emailSnapshot.docs[0];
            }
        } else {
            partnerDoc = usersSnapshot.docs[0];
        }
        
        if (!partnerDoc) {
            alert('No se encontró ningún usuario con ese nombre o email.');
            return;
        }
        
        const partnerId = partnerDoc.id;
        const partnerData = partnerDoc.data();
        
        // No permitir chatear consigo mismo
        if (partnerId === currentUserId) {
            alert('No puedes chatear contigo mismo.');
            return;
        }
        
        // Generar ID del chat
        const chatId = generateChatId(currentUserId, partnerId);
        
        // Abrir el chat (se creará en Firebase al enviar el primer mensaje si no existe)
        openChat(chatId, partnerId, partnerData.userName);
        
    } catch (error) {
        console.error('Error al buscar usuario:', error);
        alert('Error al buscar usuario: ' + error.message);
    }
}
*/

// ========================================
// FUNCIÓN: ABRIR CHAT
// ========================================
/*
   openChat(chatId, partnerId, partnerName)
   
   Abre una conversación específica en la ventana de mensajes.
*/
async function openChat(chatId, partnerId, partnerName) {
    console.log('\n🟢 ═══════════════════════════════════════════');
    console.log('   ABRIENDO CHAT');
    console.log('   chatId:', chatId);
    console.log('   partnerId:', partnerId);
    console.log('   currentUserId:', currentUserId);
    console.log('   currentChatId global:', currentChatId);
    console.log('═══════════════════════════════════════════\n');
    
    // Cerrar listener de mensajes si cambia de chat
    if (activeChatListener && currentChatId !== chatId) {
        activeChatListener();
        activeChatListener = null;
    }
    
    currentChatId = chatId;
    currentChatPartner = partnerId;

    // Nota: No desocultamos automáticamente el chat al abrirlo. El historial permanece oculto
    // si lo eliminaste previamente; nuevos mensajes aparecerán según la lógica de `loadMessages`.
    
    const chatTitle = document.getElementById('chat-title');
    chatTitle.textContent = partnerName || partnerId;
    
    updateChatAvatar(partnerId);
    // Comprobar si el partner nos ha bloqueado
    partnerHasBlockedMe = false;
    window.partnerHasBlockedMe = false;
    try {
        const partnerDoc = await db.collection('users').doc(partnerId).get();
        if (partnerDoc.exists) {
            const pData = partnerDoc.data() || {};
            if (Array.isArray(pData.blockedUsers) && pData.blockedUsers.includes(currentUserId)) {
                partnerHasBlockedMe = true;
                window.partnerHasBlockedMe = true;
                // Mostrar mensaje de bloqueo y permitir borrar el chat
                const messagesDiv = document.getElementById('messages');
                messagesDiv.classList.remove('empty-state');
                messagesDiv.innerHTML = '';

                const banner = document.createElement('div');
                banner.className = 'blocked-banner';
                banner.innerHTML = '<div class="blocked-text">Este usuario te ha bloqueado.</div>';

                const delBtn = document.createElement('button');
                delBtn.textContent = 'Ocultar chat';
                // Aplicar estilo consistente con la web
                delBtn.className = 'btn-primary';
                delBtn.addEventListener('click', async () => {
                    const ok = confirm('Ocultar chat solo para ti hasta que el usuario te desbloquee. Al desbloquear se restaurará el historial anterior al bloqueo. ¿Continuar?');
                    if (!ok) return;
                    try { await deleteChatForMe(chatId, false); } catch (e) { console.warn('Error ocultando chat desde banner:', e); }
                });

                banner.appendChild(delBtn);
                messagesDiv.appendChild(banner);

                // Deshabilitar envío
                const messageInput = document.getElementById('message-input');
                const sendBtn = document.getElementById('send-btn');
                if (messageInput) {
                    messageInput.disabled = true;
                    messageInput.placeholder = 'No puedes enviar mensajes a este usuario.';
                }
                if (sendBtn) sendBtn.disabled = true;
                if (gamesBtn) gamesBtn.disabled = true;
                const dvBtn = document.getElementById('open-dosverdades-btn');
                if (dvBtn) dvBtn.disabled = true;
            }
        }
    } catch (err) {
        console.warn('openChat: no se pudo comprobar si el partner bloqueó:', err);
    }
    // Si el partner nos ha bloqueado, no habilitamos el input ni cargamos mensajes
    if (partnerHasBlockedMe) {
        updateChatListSelection(chatId);
        return;
    }
    
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const gamesBtn = document.getElementById('open-games-menu-btn');
    const dvBtn = document.getElementById('open-dosverdades-btn');
    messageInput.disabled = false;
    messageInput.placeholder = 'Escribe tu mensaje aquí...';
    sendBtn.disabled = false;
    if (gamesBtn) gamesBtn.disabled = false;
    if (dvBtn) dvBtn.disabled = false;
    
    const messagesDiv = document.getElementById('messages');
    messagesDiv.classList.remove('empty-state');
    messagesDiv.innerHTML = '';
    
    loadMessages(chatId);
    updateChatListSelection(chatId);

    if (typeof window.cleanupPartnerInfoDropdown === 'function') {
        window.cleanupPartnerInfoDropdown();
    }
    
    if (typeof window.loadGameForChat === 'function') {
        window.loadGameForChat(chatId);
    }
}

/**
 * Actualiza el avatar del usuario en el header del chat
 */
async function updateChatAvatar(userId) {
    const avatarContainer = document.getElementById('chat-avatar');
    if (!avatarContainer) return;
    
    // Limpiar contenido previo
    avatarContainer.innerHTML = '';
    
    // SVG por defecto mientras carga
    const defaultSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="#999"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.6 0-10.8 1.8-10.8 5.4V22h21.6v-2.2c0-3.6-7.2-5.4-10.8-5.4z"/></svg>';
    avatarContainer.innerHTML = defaultSvg;
    
    // Intentar cargar la foto del usuario desde Firestore
    try {
        if (userId && typeof db !== 'undefined' && db) {
            const doc = await db.collection('users').doc(userId).get();
            if (doc.exists) {
                const data = doc.data();
                if (data.photoURL || data.photo) {
                    const img = document.createElement('img');
                    img.src = data.photoURL || data.photo;
                    img.alt = 'Avatar';
                    img.loading = 'lazy';
                    avatarContainer.innerHTML = '';
                    avatarContainer.appendChild(img);
                }
            }
        }
    } catch (err) {
        console.warn('No se pudo cargar el avatar del chat:', err);
    }
}

// ========================================
// FUNCIÓN: CERRAR CHAT ACTUAL
// ========================================
/*
   closeCurrentChat()
   
   Cierra el chat actualmente abierto y limpia el estado.
   
   ¿Qué hace?
   1. Desuscribe el listener de mensajes
   2. Limpia las variables globales
   3. Restaura el estado vacío de la ventana
*/
function closeCurrentChat() {
    // Desuscribir listener de mensajes
    if (activeChatListener) {
        activeChatListener();
        activeChatListener = null;
    }
    
    currentChatId = null;
    currentChatPartner = null;
    
    console.log('Chat cerrado');
    const dvBtn = document.getElementById('open-dosverdades-btn');
    if (dvBtn) dvBtn.disabled = true;
    const gamesBtn = document.getElementById('open-games-menu-btn');
    if (gamesBtn) gamesBtn.disabled = true;
}

// ========================================
// FUNCIÓN: ACTUALIZAR SELECCIÓN EN LISTA
// ========================================
/*
   updateChatListSelection(chatId)
   
   Marca visualmente el chat activo en la barra lateral
   y desmarca los demás.
*/
function updateChatListSelection(chatId) {
    // Remover clase 'active' de todos los items
    const allChatItems = document.querySelectorAll('.chat-item');
    allChatItems.forEach(item => {
        item.classList.remove('active');
    });
    
    // Añadir clase 'active' al chat actual
    const activeChatItem = document.querySelector(`[data-chat-id="${chatId}"]`);
    if (activeChatItem) {
        activeChatItem.classList.add('active');
    }
}

// ========================================
// FUNCIÓN: ENVIAR MENSAJE
// ========================================
/*
   sendMessage()
   
   Envía un mensaje al chat actualmente abierto.
   
   ¿Qué hace?
   1. Valida que haya un chat abierto
   2. Valida que el mensaje no esté vacío
   3. Si el chat NO existe en Firebase: lo crea
   4. Añade el mensaje a la subcolección de mensajes
   5. Actualiza el timestamp del último mensaje
*/
async function sendMessage() {
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    
    if (!currentChatId) {
        alert('Selecciona un chat primero');
        return;
    }
    
    if (message === '') {
        alert('Escribe algo antes de enviar');
        return;
    }

    // Verificar en tiempo real si el partner nos ha bloqueado
    if (partnerHasBlockedMe) {
        alert('No puedes enviar mensajes: este usuario te ha bloqueado.');
        return;
    }
    try {
        // Comprobar en servidor por si cambió el estado
        if (currentChatPartner) {
            const partnerDoc = await db.collection('users').doc(currentChatPartner).get();
            if (partnerDoc.exists) {
                const pData = partnerDoc.data() || {};
                if (Array.isArray(pData.blockedUsers) && pData.blockedUsers.includes(currentUserId)) {
                    partnerHasBlockedMe = true;
                    alert('No puedes enviar mensajes: este usuario te ha bloqueado.');
                    return;
                }
            }
        }
    } catch (err) {
        console.warn('sendMessage: error comprobando bloqueo del partner:', err);
    }
    
    try {
        const chatRef = db.collection('chats').doc(currentChatId);
        const chatDoc = await chatRef.get();
        
        // Si el chat no existe, crearlo
        if (!chatDoc.exists) {
            console.log('Creando nuevo chat en Firebase...');
            await chatRef.set({
                participants: [currentUserId, currentChatPartner].sort(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastMessage: message,
                lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
                couplePoints: 0
            });
            console.log('[OK] Chat creado');
        }
        
        // Añadir mensaje a la subcolección
        await chatRef.collection('messages').add({
            senderId: currentUserId,
            senderName: currentUserName,
            text: message,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Actualizar último mensaje del chat
        await chatRef.update({
            lastMessage: message,
            lastMessageTime: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Limpiar input
        input.value = '';
        console.log('Mensaje enviado correctamente');
        
    } catch (error) {
        console.error('Error al enviar mensaje:', error);
        alert('Error al enviar mensaje: ' + error.message);
    }
}

// ========================================
// FUNCIÓN: CARGAR MENSAJES EN TIEMPO REAL
// ========================================
function loadMessages(chatId) {
    const messagesDiv = document.getElementById('messages');
    
    // Desuscribir listener anterior si existe
    if (activeChatListener) {
        activeChatListener();
    }
    
    // Suscribirse a mensajes en tiempo real
    (async function startListener() {
        try {
            const chatRef = db.collection('chats').doc(chatId);
            const chatDoc = await chatRef.get();
            const chatData = chatDoc.exists ? chatDoc.data() : {};
            const hiddenAtMap = chatData && chatData.hiddenAt ? chatData.hiddenAt : null;
            const hiddenAtForMe = hiddenAtMap && hiddenAtMap[currentUserId] ? hiddenAtMap[currentUserId] : null;

            let query = chatRef.collection('messages').orderBy('timestamp', 'asc');
            if (hiddenAtForMe) {
                query = chatRef.collection('messages').where('timestamp', '>', hiddenAtForMe).orderBy('timestamp', 'asc');
            }

            activeChatListener = query.onSnapshot(snapshot => {
            messagesDiv.innerHTML = '';
            
            snapshot.forEach(doc => {
                const msg = doc.data();
                const messageDocId = doc.id; // ✅ AÑADIDO: Obtener ID del documento
                
                // Marcar mensaje como leído si no es del usuario actual
                if (msg.senderId !== currentUserId) {
                    const readBy = msg.readBy || [];
                    if (!readBy.includes(currentUserId)) {
                        // Actualizar el mensaje para añadir currentUserId a readBy
                        db.collection('chats')
                            .doc(chatId)
                            .collection('messages')
                            .doc(messageDocId)
                            .update({
                                readBy: firebase.firestore.FieldValue.arrayUnion(currentUserId)
                            })
                            .catch(err => console.warn('Error marcando mensaje como leído:', err));
                    }
                }
                
                // Verificar si es mensaje de sistema con visibilidad específica
                if (msg.messageType === 'game-system' && msg.visibleTo && msg.visibleTo !== currentUserId) {
                    return;
                }
                
                const messageElement = document.createElement('div');
                messageElement.className = 'message';
                
                if (msg.messageType === 'game-invitation') {
                    messageElement.classList.add('game-invitation-message');
                    
                    if (msg.senderId === currentUserId) {
                        messageElement.classList.add('my-message');
                    }
                    
                    // ✅ CORREGIDO: Pasar messageDocId como tercer parámetro
                    if (typeof window.renderGameInvitationFromMessage === 'function') {
                        window.renderGameInvitationFromMessage(messageElement, msg, messageDocId);
                    }

                } else if (msg.messageType === 'dosverdades') {
                    messageElement.classList.add('dosverdades-message');

                    if (msg.senderId === currentUserId) {
                        messageElement.classList.add('my-message');
                    }

                    if (typeof window.renderDosVerdadesFromMessage === 'function') {
                        window.renderDosVerdadesFromMessage(messageElement, msg, messageDocId);
                    }

                } else if (msg.messageType === 'game-system') {
                    messageElement.classList.add('game-system-message');
                    messageElement.textContent = msg.text;
                    
                } else {
                    if (msg.senderId === currentUserId) {
                        messageElement.classList.add('my-message');
                    }
                    
                    messageElement.innerHTML = `
                        <div class="message-header">
                            <strong>${msg.senderName}</strong>
                            <span class="timestamp">${formatTime(msg.timestamp)}</span>
                        </div>
                        <div class="message-text">${msg.text}</div>
                    `;
                }
                
                messagesDiv.appendChild(messageElement);
            });
            
            const clearDiv = document.createElement('div');
            clearDiv.style.clear = 'both';
            messagesDiv.appendChild(clearDiv);
            
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
            
            console.log(`Cargados ${snapshot.size} mensajes`);
            }, error => {
                console.error('Error al cargar mensajes:', error);
            });
        } catch (err) {
            console.error('[loadMessages] Error iniciando listener de mensajes:', err);
        }
    })();
}

// ========================================
// FUNCIÓN: FORMATEAR HORA
// ========================================
function formatTime(timestamp) {
    if (!timestamp) return '';
    
    const date = timestamp.toDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${hours}:${minutes}`;
}

// ========================================
// FUNCIÓN: MOSTRAR ESTADO VACÍO
// ========================================
/*
   showEmptyState()
   
   Muestra el mensaje "Elije a alguien para hablar"
   cuando no hay ningún chat seleccionado.
   
   Esta función se puede llamar al inicio o después
   de cerrar un chat.
*/
function showEmptyState() {
    const messagesDiv = document.getElementById('messages');
    const chatTitle = document.getElementById('chat-title');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    
    // Actualizar UI
    messagesDiv.classList.add('empty-state');
    messagesDiv.innerHTML = '<div>Elije a alguien para hablar</div>';
    chatTitle.textContent = '';
    
    // Deshabilitar input
    messageInput.disabled = true;
    messageInput.placeholder = 'Selecciona un chat para empezar';
    sendBtn.disabled = true;

    const gamesBtn = document.getElementById('open-games-menu-btn');
    if (gamesBtn) gamesBtn.disabled = true;
}

// ========================================
// FUNCIÓN: CONTROL DE VISIBILIDAD DEL BOTÓN DE PERFIL
// ========================================
/**
 * Muestra u oculta el botón de perfil según el contexto
 * - En pantallas de login/registro: OCULTO
 * - Después del login: VISIBLE con funcionalidad completa
 */
function updateProfileButtonVisibility() {
    const profileBtn = document.getElementById('profileBtn');
    if (!profileBtn) return;

    const loginScreen = document.getElementById('login-screen');
    const registerScreen = document.getElementById('register-screen');

    // Verificar si estamos en pantallas de login o registro
    const inLoginScreen = loginScreen && loginScreen.style.display !== 'none';
    const inRegisterScreen = registerScreen && registerScreen.style.display !== 'none';

    if (inLoginScreen || inRegisterScreen) {
        // Ocultar botón en pantallas de inicio/registro
        profileBtn.style.display = 'none';
        console.log('[Profile Button] Oculto en pantalla de login/registro');
    } else if (currentUserId) {
        // Mostrar botón cuando hay usuario logueado
        profileBtn.style.display = 'flex';
        console.log('[Profile Button] Visible para usuario logueado');
    } else {
        // En cualquier otro caso sin usuario, ocultar
        profileBtn.style.display = 'none';
    }
}

    // ========================================
// FUNCIONES TOGGLE PARA BOTONES DE NAVEGACIÓN
// ========================================
/*
   Estas funciones manejan la apertura/cierre de la ventana de chat
   y del panel de lista de usuarios desde los botones de la barra de navegación.
   
   Comportamiento:
   - Toggle: al hacer clic, si está abierto se cierra, si está cerrado se abre
   - Exclusividad: al abrir uno, se cierra automáticamente el otro
*/

/**
 * toggleChatInterface()
 * 
 * Alterna la visualización de la ventana de chat (#chat-screen).
 * Si el panel de usuarios está abierto, lo cierra automáticamente.
 * 
 * Esta función reemplaza la funcionalidad del antiguo botón flotante #openChatBtn
 */
function toggleChatInterface() {
    const chatScreen = document.getElementById('chat-screen');
    const usersPanel = document.getElementById('users-panel');
    
    if (!chatScreen) {
        console.error('No se encontró #chat-screen');
        return;
    }
    
    // Verificar estado actual
    const isVisible = chatScreen.style.display === 'flex';
    
    if (isVisible) {
        // Si está visible, ocultarlo
        chatScreen.style.display = 'none';
        console.log('[Toggle] Chat cerrado');
    } else {
        // Si está oculto, mostrarlo y cerrar panel de usuarios si está abierto
        chatScreen.style.display = 'flex';
        console.log('[Toggle] Chat abierto');
        
        // ✅ CORRECCIÓN: Cerrar panel de usuarios usando clase 'hidden'
        if (usersPanel && !usersPanel.classList.contains('hidden')) {
            usersPanel.classList.add('hidden');
            console.log('[Toggle] Panel de usuarios cerrado automáticamente');
        }
    }
}

/**
 * toggleUserList()
 * 
 * Alterna la visualización del panel de lista de usuarios (#users-panel).
 * Si el chat está abierto, lo cierra automáticamente.
 * Carga la lista de usuarios si el panel se está abriendo.
 * 
 * Esta función reemplaza la funcionalidad del antiguo botón flotante de listausuarios.js
 */
async function toggleUserList() {
    const usersPanel = document.getElementById('users-panel');
    const chatScreen = document.getElementById('chat-screen');
    
    if (!usersPanel) {
        console.error('No se encontró #users-panel. Asegúrate de que listausuarios.js se haya cargado correctamente.');
        return;
    }
    
    // ✅ CORRECCIÓN: Verificar estado usando clase 'hidden'
    const isHidden = usersPanel.classList.contains('hidden');
    
    if (isHidden) {
        // Si está oculto, mostrarlo (quitar clase hidden)
        usersPanel.classList.remove('hidden');
        console.log('[Toggle] Panel de usuarios abierto');
        
        // Cargar usuarios (la función está definida en listausuarios.js)
        // Llamamos a la función global si existe
        if (typeof window.loadAndRenderUsersFromApp === 'function') {
            await window.loadAndRenderUsersFromApp();
        } else {
            console.warn('[Toggle] No se encontró la función loadAndRenderUsersFromApp. Verifica listausuarios.js');
        }
        
        // Cerrar chat si está abierto
        if (chatScreen && chatScreen.style.display === 'flex') {
            chatScreen.style.display = 'none';
            console.log('[Toggle] Chat cerrado automáticamente');
        }
    } else {
        // Si está visible, ocultarlo (añadir clase hidden)
        usersPanel.classList.add('hidden');
        console.log('[Toggle] Panel de usuarios cerrado');
    }
}

// ========================================
// FUNCIÓN AUXILIAR: CERRAR TODOS LOS PANELES
// ========================================
/**
 * closeAllPanels()
 * 
 * Cierra tanto el chat como el panel de usuarios.
 * Útil para usar en logout o al cambiar de pantalla.
 */
function closeAllPanels() {
    console.log('\n🔴 CERRANDO TODOS LOS PANELES');
    
    const chatScreen = document.getElementById('chat-screen');
    const usersPanel = document.getElementById('users-panel');
    
    // Ocultar widget de puntos
    const widget = document.getElementById('couple-points-widget');
    if (widget) {
        widget.style.display = 'none';
    }
    
    if (chatScreen) chatScreen.style.display = 'none';
    if (usersPanel) usersPanel.classList.add('hidden');
    
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
        gameContainer.style.display = 'none';
    }
    
    console.log('✅ Paneles cerrados\n');
}

// ========================================
// ✅ FUNCIÓN RESTAURADA: showChatInterface()
// ========================================
/*
   Mantenemos showChatInterface() para compatibilidad con el código existente
   (login, registro, etc.)
   
   CAMBIO: Ahora también actualiza la visibilidad del botón de perfil
*/
function showChatInterface() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('register-screen').style.display = 'none';
    // Mostrar la barra de navegación
    document.getElementById('nav-bar').style.display = 'block';
    
    // Cerrar panel de usuarios
    const usersPanel = document.getElementById('users-panel');
    if (usersPanel) usersPanel.classList.add('hidden');
    
    // Mostrar ventana de chat por defecto
    const chatScreen = document.getElementById('chat-screen');
    if (chatScreen) {
        chatScreen.style.display = 'flex';
        console.log('[showChatInterface] Chat mostrado por defecto después del registro/login');
    }
    
    // ✅ AÑADIDO: Actualizar visibilidad del botón de perfil
    updateProfileButtonVisibility();
    try { updateProfileButton(); } catch(e) { console.warn('updateProfileButton fallo inicial:', e); }
    setTimeout(() => { try { updateProfileButton(); } catch(_) {} }, 300);
    setTimeout(() => { try { updateProfileButton(); } catch(_) {} }, 1000);
    
    console.log('[showChatInterface] Interfaz de navegación mostrada');
}

//Exportar funciones para pruebas unitarias
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        generateChatId
    };
}

// ========================================
// FUNCIÓN: BORRAR CHAT SOLO PARA EL USUARIO
// ========================================
async function deleteChatForMe(chatId, setHiddenAt = true) {
    try {
        // Añadir a la caché local para evitar que el listener re-renderice el chat
        try { locallyHiddenChats.add(chatId); } catch(e) { console.warn('No se pudo marcar localmente el chat:', e); }
        if (typeof db === 'undefined' || !db) throw new Error('Firestore no disponible');
        const chatRef = db.collection('chats').doc(chatId);

        // Optimistic UI: eliminar el elemento de la lista lateral y cerrar el chat inmediatamente
        const chatEl = document.querySelector(`[data-chat-id="${chatId}"]`);
        if (chatEl && chatEl.parentNode) chatEl.parentNode.removeChild(chatEl);
        if (currentChatId === chatId) {
            closeCurrentChat();
            showEmptyState();
        }

        // Añadir el usuario actual al array hiddenFor (ocultar solo para él)
        // Si `setHiddenAt` está activado, registrar la marca temporal hiddenAt.<userId>
        // para que los mensajes previos no se muestren (caso: eliminación por el propio usuario).
        // Si se llama desde el flujo de bloqueo, se llama con setHiddenAt = false para no perder
        // el historial en caso de que el usuario no lo hubiera eliminado previamente.
        const updateObj = {
            hiddenFor: firebase.firestore.FieldValue.arrayUnion(currentUserId)
        };
        if (setHiddenAt) {
            updateObj['hiddenAt.' + currentUserId] = firebase.firestore.FieldValue.serverTimestamp();
        }

        try {
            await chatRef.update(updateObj);
            console.log('[deleteChatForMe] Chat marcado como oculto para', currentUserId);
        } catch (errUpdate) {
            console.error('[deleteChatForMe] Error actualizando Firestore:', errUpdate);
            alert('No se pudo completar la eliminación del chat en el servidor. Se recargará la lista de chats.');
            // Revertir la marca local si la actualización falla
            try { locallyHiddenChats.delete(chatId); } catch(e) { /* ignore */ }
            // Intentar recargar la lista de chats para sincronizar el estado
            if (typeof loadUserChats === 'function') {
                try { loadUserChats(); } catch(e){ console.warn('Error recargando chats:', e); }
            }
            return;
        }
    } catch (err) {
        console.error('[deleteChatForMe] Error al ocultar chat:', err);
        alert('No se pudo eliminar el chat: ' + (err && err.message ? err.message : String(err)));
    }
}

// ========================================
// FUNCIÓN: BLOQUEAR USUARIO
// ========================================
async function blockUser(blockedUserId, chatId) {
    if (!currentUserId) throw new Error('Usuario no autenticado');
    if (!blockedUserId) throw new Error('ID de usuario a bloquear inválido');

    try {
        // Añadir a la lista blockedUsers del usuario actual y registrar marca temporal
        await db.collection('users').doc(currentUserId).update({
            blockedUsers: firebase.firestore.FieldValue.arrayUnion(blockedUserId),
            ['blockedAt.' + blockedUserId]: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Ocultar el chat para el bloqueador (optimistic).
        // IMPORTANTE: Al bloquear NO establecemos hiddenAt para que, al desbloquear,
        // el chat pueda restaurarse con todo el historial salvo el que cada usuario
        // haya borrado manualmente antes del bloqueo.
        try { await deleteChatForMe(chatId, false); } catch(e) { console.warn('deleteChatForMe falló tras block:', e); }
    } catch (err) {
        console.error('[blockUser] Error al bloquear usuario:', err);
        throw err;
    }
}

// Cerrar menú de opciones (⋮) si el usuario hace click fuera del menú o del botón
document.addEventListener('click', (ev) => {
    try {
        // Si el click fue dentro de un menú o en un botón de menú, no cerrar
        if (ev.target && ev.target.closest && (ev.target.closest('.chat-item-menu') || ev.target.closest('.chat-item-menu-btn'))) {
            return;
        }

        // Cerrar todos los menús abiertos
        document.querySelectorAll('.chat-item-menu').forEach(m => m.remove());
    } catch (err) {
        console.warn('[app.js] Error cerrando menús al click fuera:', err);
    }
});

// ========================================
// DESPLEGABLE DE INFORMACIÓN DEL PARTNER
// ========================================
/**
 * Sistema que muestra altura y peso del otro usuario según los puntos acumulados:
 * - Más de 5 puntos: se desbloquea la altura
 * - Más de 10 puntos: se desbloquea el peso
 * 
 * El desplegable se muestra automáticamente al pasar el ratón por encima del widget
 * de puntos, o al hacer clic en él.
 */

(function() {
    'use strict';

    let dropdownVisible = false;
    let currentPartnerData = null;
    
    /**
     * Inicializa el sistema del desplegable
     */
    function initPartnerInfoDropdown() {
        const widget = document.getElementById('couple-points-widget');
        const dropdown = document.getElementById('partner-info-dropdown');
        
        if (!widget || !dropdown) {
            console.warn('[Partner Info] Elementos no encontrados');
            return;
        }
        
        // Hacer el widget y el dropdown interactivos
        
        // HOVER: Mostrar al pasar el ratón
        widget.addEventListener('mouseenter', () => {
            showPartnerInfoDropdown();
        });
        
        // HOVER: Ocultar al salir del widget Y del dropdown
        widget.addEventListener('mouseleave', (e) => {
            // Solo ocultar si no estamos entrando al dropdown
            const relatedTarget = e.relatedTarget;
            if (!relatedTarget || !dropdown.contains(relatedTarget)) {
                hidePartnerInfoDropdown();
            }
        });
        
        dropdown.addEventListener('mouseleave', (e) => {
            // Solo ocultar si no estamos volviendo al widget
            const relatedTarget = e.relatedTarget;
            if (!relatedTarget || !widget.contains(relatedTarget)) {
                hidePartnerInfoDropdown();
            }
        });
        
        // CLICK: Toggle al hacer clic en el widget
        widget.addEventListener('click', (e) => {
            e.stopPropagation(); // Evitar que el click cierre inmediatamente
            togglePartnerInfoDropdown();
        });
        
        // Cerrar al hacer clic fuera
        document.addEventListener('click', (e) => {
            if (dropdownVisible && 
                !widget.contains(e.target) && 
                !dropdown.contains(e.target)) {
                hidePartnerInfoDropdown();
            }
        });
        
        console.log('[Partner Info] Sistema inicializado correctamente');
    }
    
    /**
     * Muestra el desplegable y carga los datos
     */
    function showPartnerInfoDropdown() {
        const dropdown = document.getElementById('partner-info-dropdown');
        if (!dropdown || !currentChatId || !currentChatPartner) {
            return;
        }
        
        dropdown.style.display = 'block';
        // Forzar reflow para que la animación funcione
        dropdown.offsetHeight;
        dropdown.classList.add('show');
        dropdownVisible = true;
        
        // Cargar datos del partner
        loadPartnerData();
    }
    
    /**
     * Oculta el desplegable
     */
    function hidePartnerInfoDropdown() {
        const dropdown = document.getElementById('partner-info-dropdown');
        if (!dropdown) return;
        
        dropdown.classList.remove('show');
        dropdownVisible = false;
        
        // Ocultar el elemento después de la animación
        setTimeout(() => {
            if (!dropdownVisible) {
                dropdown.style.display = 'none';
            }
        }, 200);
    }
    
    /**
     * Alterna la visibilidad del desplegable
     */
    function togglePartnerInfoDropdown() {
        if (dropdownVisible) {
            hidePartnerInfoDropdown();
        } else {
            showPartnerInfoDropdown();
        }
    }
    
    /**
     * Carga los datos del partner desde Firestore
     */
    async function loadPartnerData() {
        if (!currentChatPartner) {
            console.warn('[Partner Info] No hay partner activo');
            return;
        }
        
        try {
            // Obtener los puntos actuales del chat
            const chatRef = db.collection('chats').doc(currentChatId);
            const chatDoc = await chatRef.get();
            
            if (!chatDoc.exists) {
                console.warn('[Partner Info] Chat no encontrado');
                return;
            }
            
            const chatData = chatDoc.data();
            const points = chatData.couplePoints || 0;
            
            // Obtener los datos del partner
            const partnerDoc = await db.collection('users').doc(currentChatPartner).get();
            
            if (!partnerDoc.exists) {
                console.warn('[Partner Info] Usuario partner no encontrado');
                return;
            }
            
            const partnerData = partnerDoc.data();
            currentPartnerData = partnerData;
            
            // Actualizar la UI según los puntos
            updatePartnerInfoUI(partnerData, points);
            
        } catch (error) {
            console.error('[Partner Info] Error al cargar datos:', error);
        }
    }
    
    /**
 * Actualiza la interfaz con los datos del partner según los puntos
 */
function updatePartnerInfoUI(partnerData, points) {
    const alturaElement = document.getElementById('partner-altura-value');
    const pesoElement = document.getElementById('partner-peso-value');
    const fotoElement = document.getElementById('partner-foto-value');
    
    if (!alturaElement || !pesoElement || !fotoElement) return;
    
    // ALTURA: Se desbloquea con más de 5 puntos
    if (points > 5) {
        const altura = partnerData.altura || '-';
        alturaElement.textContent = altura !== '-' ? `${altura} cm` : '-';
        alturaElement.classList.remove('locked');
    } else {
        alturaElement.textContent = '-';
        alturaElement.classList.add('locked');
    }
    
    // PESO: Se desbloquea con 10 puntos o más
    if (points >= 10) {
        const peso = partnerData.peso || '-';
        pesoElement.textContent = peso !== '-' ? `${peso} kg` : '-';
        pesoElement.classList.remove('locked');
    } else {
        pesoElement.textContent = '-';
        pesoElement.classList.add('locked');
    }
    
    // ✅ FOTO: Se desbloquea con 12 puntos o más
    if (points >= 12) {
        const foto2 = partnerData.photoURL2 || null;
    
        if (foto2) {
            // Crear imagen en lugar de enlace
            fotoElement.innerHTML = '';
            const img = document.createElement('img');
            img.src = foto2;
            img.alt = 'Segunda foto';
            img.style.maxWidth = '100%';
            img.style.maxHeight = '150px';
            img.style.borderRadius = '8px';
            img.style.marginTop = '8px';
            img.style.display = 'block';
            img.onerror = function() {
                fotoElement.textContent = 'Error al cargar';
            };
            fotoElement.appendChild(img);
            fotoElement.classList.remove('locked');
        } else {
            fotoElement.textContent = 'No disponible';
            fotoElement.classList.remove('locked');
        }
    } else {
        fotoElement.textContent = '-';
        fotoElement.classList.add('locked');
    }
    
    console.log(`[Partner Info] UI actualizada - Puntos: ${points}, Altura: ${alturaElement.textContent}, Peso: ${pesoElement.textContent}, Foto: ${fotoElement.textContent || fotoElement.innerHTML}`);
}
    
    /**
     * Limpia los datos cuando se cambia de chat
     */
    function cleanupPartnerInfo() {
        currentPartnerData = null;
        hidePartnerInfoDropdown();
    
        // Resetear valores
        const alturaElement = document.getElementById('partner-altura-value');
        const pesoElement = document.getElementById('partner-peso-value');
        const fotoElement = document.getElementById('partner-foto-value');
    
        if (alturaElement) {
            alturaElement.textContent = '-';
            alturaElement.classList.add('locked');
        }
        if (pesoElement) {
            pesoElement.textContent = '-';
            pesoElement.classList.add('locked');
        }
        // ✅ NUEVO: Resetear foto
        if (fotoElement) {
            fotoElement.textContent = '-';
            fotoElement.classList.add('locked');
        }
    }
    
    // Inicializar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPartnerInfoDropdown);
    } else {
        initPartnerInfoDropdown();
    }
    
    // Exponer función de limpieza para usar en cambios de chat
    window.cleanupPartnerInfoDropdown = cleanupPartnerInfo;
    
    // Actualizar datos cuando cambien los puntos (se puede llamar desde cuatroEnRayaScript.js)
    window.updatePartnerInfoDropdown = function() {
        if (dropdownVisible) {
            loadPartnerData();
        }
    };
    
})();
