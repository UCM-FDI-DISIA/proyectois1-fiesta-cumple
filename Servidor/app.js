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
// VERSIÓN CON AUTENTICACIÓN (COMENTADA)
// const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
// let currentUser = null;
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
        profilePhotoInput.addEventListener('change', previewProfilePhoto);
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
});

// Alterna la apertura del modal de login/registro cuando se pulsa el botón de perfil
function toggleAuthMenu() {
    // Si no hay usuario logueado, mostramos/ocultamos el login
    if (!currentUserId) {
        const login = document.getElementById('login-screen');
        if (!login) return;
        login.style.display = (login.style.display === 'block') ? 'none' : 'block';
        // Asegurarse de ocultar el register si estaba abierto
        const reg = document.getElementById('register-screen');
        if (reg) reg.style.display = 'none';
    } else {
        // Si el usuario está logueado, mostrar/ocultar el menú de perfil
        toggleProfileMenu();
    }
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
            <button id="logoutMenuBtn">Cerrar sesión</button>
        </div>
    `;
    document.body.appendChild(menu);
    // Listeners
    menu.querySelector('#viewProfileBtn').addEventListener('click', () => {
        hideProfileMenu();
        viewProfile();
    });
    menu.querySelector('#logoutMenuBtn').addEventListener('click', () => {
        hideProfileMenu();
        logout();
    });
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
                        <!-- La foto se inserta aquí -->
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
                </div>
            </div>
            
            <!-- Formulario de edición -->
            <div id="editProfileContent" style="display:none">
                <form class="edit-profile-form" onsubmit="return false;">
                    <div class="profile-photo-section">
                        <div class="profile-photo-container" id="profilePhotoEdit">
                            <!-- La foto se inserta aquí -->
                        </div>
                        <input type="file" id="newProfilePhoto" accept="image/*" style="display:none">
                        <button type="button" onclick="document.getElementById('newProfilePhoto').click()">
                            Cambiar foto
                        </button>
                    </div>
                    
                    <label>
                        Nombre de usuario
                        <input type="text" id="editProfileName">
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
                    
                    <label>
                        Gustos e intereses
                        <textarea id="editProfileInterests" rows="4"></textarea>
                    </label>
                    
                    <button type="button" onclick="saveProfileChanges()">Guardar cambios</button>
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
        photoInput.addEventListener('change', handleProfilePhotoChange);
    }
}

function showProfileModal() {
    const modal = document.getElementById('profileModal');
    const backdrop = document.querySelector('.profile-modal-backdrop');
    if (modal && backdrop) {
        modal.style.display = 'block';
        backdrop.style.display = 'block';
    }
}

function hideProfileModal() {
    const modal = document.getElementById('profileModal');
    const backdrop = document.querySelector('.profile-modal-backdrop');
    if (modal && backdrop) {
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
        document.getElementById('profileInterestsView').textContent = data.interests || 'No especificado';
        
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
        
        // Actualizar foto
        const photoContainer = document.getElementById('profilePhotoView');
        if (data.photoURL) {
            photoContainer.innerHTML = `<img src="${data.photoURL}" alt="Foto de perfil">`;
        } else {
            photoContainer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="50" height="50" fill="#999"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.6 0-10.8 1.8-10.8 5.4V22h21.6v-2.2c0-3.6-7.2-5.4-10.8-5.4z"/></svg>';
        }
        
    } catch (err) {
        console.error('Error cargando perfil:', err);
        alert('Error al cargar el perfil');
    }
}

async function populateEditForm() {
    try {
        const doc = await db.collection('users').doc(currentUserId).get();
        if (!doc.exists) return;
        
        const data = doc.data();
        
        // Rellenar campos
        document.getElementById('editProfileName').value = data.userName || '';
        document.getElementById('editProfileInterests').value = data.interests || '';
        
        // Marcar hábitos
        const checkboxes = document.querySelectorAll('input[name="editHabit"]');
        checkboxes.forEach(cb => {
            cb.checked = data.habits ? data.habits.includes(cb.value) : false;
        });
        
        // Mostrar foto actual
        const photoContainer = document.getElementById('profilePhotoEdit');
        if (data.photoURL) {
            photoContainer.innerHTML = `<img src="${data.photoURL}" alt="Foto de perfil">`;
        } else {
            photoContainer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="50" height="50" fill="#999"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.6 0-10.8 1.8-10.8 5.4V22h21.6v-2.2c0-3.6-7.2-5.4-10.8-5.4z"/></svg>';
        }
        
    } catch (err) {
        console.error('Error poblando formulario:', err);
        alert('Error al cargar datos para edición');
    }
}

async function handleProfilePhotoChange(event) {
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
        
        // Mostrar preview
        const reader = new FileReader();
        reader.onload = function(e) {
            const photoContainer = document.getElementById('profilePhotoEdit');
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
        const newInterests = document.getElementById('editProfileInterests').value.trim();
        const selectedHabits = Array.from(document.querySelectorAll('input[name="editHabit"]:checked'))
            .map(cb => cb.value);

        // Validación básica
        if (!newName) {
            alert('El nombre es obligatorio');
            return;
        }

        // 2. Obtener datos actuales del usuario
        console.log('Obteniendo datos actuales...');
        const userDoc = await db.collection('users').doc(currentUserId).get();
        if (!userDoc.exists) {
            alert('Error: Perfil no encontrado');
            return;
        }
        const currentData = userDoc.data();

        // 3. Procesar foto si hay nueva
        console.log('Procesando foto...');
        const photoInput = document.getElementById('newProfilePhoto');
        let photoURL = currentData.photoURL || ''; // Mantener la URL actual por defecto

        // ✅ NUEVA LÓGICA: Subir a ImgBB en vez de Firebase Storage
        if (photoInput && photoInput.files && photoInput.files.length > 0) {
            const file = photoInput.files[0];
            console.log('Subiendo nueva foto a ImgBB...');

            try {
                // Validar tamaño (ImgBB permite hasta 32MB, pero limitamos a 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    alert('La imagen es demasiado grande. Máximo 5MB.');
                    photoURL = currentData.photoURL || '';
                } else {
                    // ✅ Crear FormData para enviar la imagen
                    const formData = new FormData();
                    formData.append('image', file);

                    // ✅ IMPORTANTE: Reemplaza 'TU_API_KEY' con tu clave real de ImgBB
                    const API_KEY = 'c44651d43039727932eaf6daf0918e74'; // ← CAMBIAR ESTO

                    // ✅ Subir imagen a ImgBB
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
                        photoURL = data.data.url; // URL pública de la imagen
                        console.log('✅ Foto subida exitosamente a ImgBB:', photoURL);
                    } else {
                        throw new Error('ImgBB devolvió error');
                    }
                }

            } catch (photoErr) {
                console.error('❌ Error subiendo foto:', photoErr);
                alert(`Error al subir la foto: ${photoErr.message}`);

                // Mantener la foto actual si falla
                photoURL = currentData.photoURL || '';
                console.log('Se mantendrá la foto actual debido al error');
            }
        }

        // 4. Preparar datos para actualizar
        console.log('Preparando datos para actualizar...');
        const updateData = {
            userId: currentUserId,
            userName: newName,
            interests: newInterests || '',
            habits: selectedHabits || [],
            photoURL: photoURL,
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

        // 7. Limpiar formulario de foto
        if (photoInput) photoInput.value = '';

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

    // Si no hay usuario, mostrar SVG por defecto
    if (!currentUserId) {
        // Asegurarse de que el SVG esté presente
        const svg = document.getElementById('profileSvg');
        if (!svg) {
            btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.6 0-10.8 1.8-10.8 5.4V22h21.6v-2.2c0-3.6-7.2-5.4-10.8-5.4z"/></svg>';
        }
        btn.title = 'Iniciar sesión / Crear cuenta';
        return;
    }

    // Si hay usuario, intentar cargar foto desde Firestore
    try {
        const doc = await db.collection('users').doc(currentUserId).get();
        if (doc.exists) {
            const data = doc.data() || {};
            const photoURL = data.photoURL;
            if (photoURL) {
                btn.innerHTML = '';
                const img = document.createElement('img');
                img.src = photoURL;
                img.alt = 'Foto de perfil';
                btn.appendChild(img);
                btn.title = data.userName ? (data.userName + '') : 'Mi perfil';
                return;
            }
        }
    } catch (err) {
        console.warn('No se pudo cargar la foto de perfil:', err);
    }

    // Fallback: silueta
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.6 0-10.8 1.8-10.8 5.4V22h21.6v-2.2c0-3.6-7.2-5.4-10.8-5.4z"/></svg>';
    btn.title = 'Mi perfil';
}

// ========================================
// VERSIÓN SIMPLIFICADA: INICIAR DIRECTAMENTE EN REGISTRO
// ========================================
// VERSIÓN CON AUTENTICACIÓN (COMENTADA)
/*
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        currentUserId = user.uid;
        loadUserProfile();
        loadUserChats();
        showChatInterface();
    } else {
        showLogin();
    }
});
*/

// Para versión de prueba, mostramos directamente el formulario de registro
// El usuario se "auto-autentica" al crear su perfil

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
}

// Volver al login
function showLoginForm() {
    document.getElementById('login-screen').style.display = 'block';
    document.getElementById('register-screen').style.display = 'none';
    // Limpiar errores
    document.getElementById('register-error').textContent = '';
}

// Iniciar sesión solo con nombre de usuario
async function login() {
    const username = document.getElementById('login-username').value;
    const errorElement = document.getElementById('login-error');
    
    if (!username || username.trim() === '') {
        errorElement.textContent = 'Por favor ingresa tu nombre de usuario';
        return;
    }
    
    try {
        errorElement.textContent = 'Buscando usuario...';
        
        // Buscar usuario por nombre exacto
        const usersSnapshot = await db.collection('users')
            .where('userName', '==', username.trim())
            .get();
        
        if (usersSnapshot.empty) {
            errorElement.textContent = 'Usuario no encontrado. ¿Quieres crear una cuenta nueva?';
            return;
        }
        
        // Si hay múltiples usuarios con el mismo nombre, tomar el primero
        const userDoc = usersSnapshot.docs[0];
        const userData = userDoc.data();
        
        // Establecer usuario actual
        currentUserId = userDoc.id;
        currentUserName = userData.userName;
        
        errorElement.style.color = 'green';
        errorElement.textContent = '¡Bienvenido de nuevo, ' + currentUserName + '!';
        
        // Actualizar UI
        document.getElementById('user-info').textContent = 'Conectado como: ' + currentUserName;
        
        // Cargar chats y mostrar interfaz
        loadUserChats();
    // Actualizar el botón de perfil para mostrar foto/usuario
    try { updateProfileButton(); } catch(e) { /* no crítico */ }
        
        
        setTimeout(() => {
            showChatInterface();
            errorElement.textContent = '';
            errorElement.style.color = 'red';
        }, 1000);
        
    } catch (error) {
        errorElement.textContent = 'Error al iniciar sesión: ' + error.message;
        console.error('Error al iniciar sesión:', error);
    }

    if (typeof window.showGameButton === 'function') window.showGameButton();
}

// Preview de foto de perfil
function previewProfilePhoto(event) {
    const file = event.target.files[0];
    const preview = document.getElementById('photo-preview');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
        };
        reader.readAsDataURL(file);
    }
}

// Completar registro con encuesta
async function completeRegistration() {
    const name = document.getElementById('register-name').value;
    const photoFile = document.getElementById('profile-photo').files[0];
    const interests = document.getElementById('interests').value;
    const age = document.getElementById('age').value;
    const errorElement = document.getElementById('register-error');

    // Obtener hábitos seleccionados
    const habitsCheckboxes = document.querySelectorAll('input[name="habit"]:checked');
    const habits = Array.from(habitsCheckboxes).map(cb => cb.value);

    // Validaciones
    if (!name || name.trim() === '') {
        errorElement.textContent = 'Por favor ingresa tu nombre de usuario';
        return;
    }

    if (!age || age < 18) {
        errorElement.textContent = 'Debes ser mayor de 18 años';
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

        errorElement.textContent = 'Creando perfil...';

        // Generar ID basado en el nombre de usuario (minúsculas y guiones bajos)
        const userId = name.trim().toLowerCase().replace(/\s+/g, '_');
        currentUserId = userId;
        currentUserName = name.trim();

        // ✅ NUEVA LÓGICA: Subir foto a ImgBB en vez de Firebase Storage
        let photoURL = '';
        if (photoFile) {
            errorElement.textContent = 'Subiendo foto de perfil...';
            try {
                // Validar tamaño
                if (photoFile.size > 5 * 1024 * 1024) {
                    errorElement.textContent = 'La imagen es demasiado grande. El perfil se creará sin foto.';
                    photoURL = '';
                } else {
                    // ✅ Crear FormData
                    const formData = new FormData();
                    formData.append('image', photoFile);

                    // ✅ IMPORTANTE: Reemplaza 'TU_API_KEY' con tu clave real
                    const API_KEY = 'c44651d43039727932eaf6daf0918e74'; // ← CAMBIAR ESTO

                    // ✅ Subir a ImgBB
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
                        console.log('✅ Foto subida a ImgBB:', photoURL);
                    } else {
                        throw new Error('ImgBB devolvió error');
                    }
                }
            } catch (upErr) {
                console.error('Error subiendo foto durante registro:', upErr);
                errorElement.textContent = 'Error subiendo la foto. El perfil se creará sin foto.';
                photoURL = '';
            }
        }

        // Guardar perfil completo en Firestore usando el ID formateado
        errorElement.textContent = 'Guardando perfil...';
        await db.collection('users').doc(userId).set({
            userId: userId,
            userName: name.trim(),
            photoURL: photoURL,
            habits: habits,
            interests: interests,
            age: parseInt(age),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        errorElement.style.color = 'green';
        errorElement.textContent = '¡Perfil creado con éxito! Redirigiendo...';

        // Actualizar UI
        document.getElementById('user-info').textContent = 'Conectado como: ' + currentUserName;

        // Cargar chats y mostrar interfaz
        loadUserChats();

        if (typeof window.showGameButton === 'function') window.showGameButton();

        setTimeout(() => {
            showChatInterface();
            // Limpiar formulario
            document.getElementById('register-name').value = '';
            document.getElementById('profile-photo').value = '';
            document.getElementById('photo-preview').innerHTML = '';
            document.getElementById('interests').value = '';
            document.getElementById('age').value = '';
            document.querySelectorAll('input[name="habit"]:checked').forEach(cb => cb.checked = false);
            errorElement.textContent = '';
            errorElement.style.color = 'red';
        }, 1000);

    } catch (error) {
        errorElement.style.color = 'red';
        errorElement.textContent = 'Error: ' + error.message;
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
    
    // Limpiar variables
    currentUserId = '';
    currentUserName = '';
    
    // Volver a la pantalla de login
    document.getElementById('login-screen').style.display = 'block';
    document.getElementById('register-screen').style.display = 'none';
    document.getElementById('chat-screen').style.display = 'none';
    document.getElementById('nav-bar').style.display = 'none';
    
    // Limpiar campo de login
    document.getElementById('login-username').value = '';
    document.getElementById('login-error').textContent = '';
    
    console.log('Sesión cerrada correctamente');
    // Actualizar botón de perfil a estado por defecto
    try { updateProfileButton(); } catch (e) { }

    if (typeof window.hideGameButton === 'function') window.hideGameButton();

    if (typeof window.cleanupGameListeners === 'function') {
        window.cleanupGameListeners();
    }

    // Cerrar todos los paneles
    closeAllPanels();
}

/* VERSIÓN CON AUTENTICACIÓN (COMENTADA)
function logout() {
    // Cerrar chat activo si lo hay
    if (currentChatId) {
        closeCurrentChat();
    }

    // Limpiar la ventana de chat
    showEmptyState();
    
    // Cerrar sesión en Firebase Auth
    auth.signOut()
        .then(() => {
            console.log('Sesión cerrada correctamente');
        })
        .catch((error) => {
            console.error('Error al cerrar sesión:', error);
        });
}
*/

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
    // Determinar el ID del otro usuario
    const otherUserId = chatData.participants.find(id => id !== currentUserId);

    // Obtener el nombre real del otro usuario
    let otherUserName = otherUserId;
    try {
        const otherUserDoc = await db.collection('users').doc(otherUserId).get();
        if (otherUserDoc.exists) {
            otherUserName = otherUserDoc.data().userName;
        }
    } catch (error) {
        console.error('Error al obtener nombre de usuario:', error);
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

    // Contenido: nombre del otro usuario
    chatItem.innerHTML = `
        <div class="chat-item-name">${otherUserName}</div>
    `;

    // Evento: abrir chat al hacer clic
    chatItem.addEventListener('click', () => {
        openChat(chatId, otherUserId, otherUserName);
    });

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
function openChat(chatId, partnerId, partnerName) {
    console.log(`Abriendo chat: ${chatId} con usuario: ${partnerId}`);
    
    // Cerrar chat anterior si lo hay
    if (currentChatId) {
        closeCurrentChat();
    }
    
    // Actualizar variables globales
    currentChatId = chatId;
    currentChatPartner = partnerId;
    
    // Actualizar header con el nombre real del usuario
    const chatTitle = document.getElementById('chat-title');
    chatTitle.textContent = partnerName || partnerId;
    
    // Habilitar input y botón
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const playBtn = document.getElementById('open-game-btn');
    messageInput.disabled = false;
    messageInput.placeholder = 'Escribe tu mensaje aquí...';
    sendBtn.disabled = false;
    playBtn.disabled = false;
    
    // Remover estado vacío del área de mensajes
    const messagesDiv = document.getElementById('messages');
    messagesDiv.classList.remove('empty-state');
    messagesDiv.innerHTML = ''; // Limpiar contenido anterior
    
    // Cargar mensajes
    loadMessages(chatId);
    
    // Actualizar UI de la barra lateral
    updateChatListSelection(chatId);

    if (typeof window.loadGameForChat === 'function') {
        window.loadGameForChat(chatId);
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
    
    // Limpiar variables globales
    currentChatId = null;
    currentChatPartner = null;
    
    console.log('Chat cerrado');
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
                lastMessageTime: firebase.firestore.FieldValue.serverTimestamp()
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
    activeChatListener = db.collection('chats')
        .doc(chatId)
        .collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
            messagesDiv.innerHTML = '';
            
            snapshot.forEach(doc => {
                const msg = doc.data();
                const messageDocId = doc.id; // ✅ AÑADIDO: Obtener ID del documento
                
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

    const playBtn = document.getElementById('open-game-btn');
    playBtn.disabled = true;
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
    const chatScreen = document.getElementById('chat-screen');
    const usersPanel = document.getElementById('users-panel');
    
    if (chatScreen) chatScreen.style.display = 'none';
    if (usersPanel) usersPanel.classList.add('hidden');

    // Ocultar tablero de juego si está visible
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
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
    
    console.log('[Close All] Todos los paneles cerrados');
}

// ========================================
// ACTUALIZAR FUNCIÓN showChatInterface()
// ========================================
/*
   Mantenemos showChatInterface() para compatibilidad con el código existente
   (login, registro, etc.), pero ahora SOLO muestra la barra de navegación
   y NO abre el chat automáticamente.
*/
function showChatInterface() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('register-screen').style.display = 'none';
    // NO mostramos el chat automáticamente, solo la barra de navegación
    document.getElementById('nav-bar').style.display = 'block';
    
    // Asegurar que todo esté cerrado inicialmente
    closeAllPanels();
    
    console.log('[showChatInterface] Interfaz de navegación mostrada (chat y panel cerrados)');
}

//Exportar funciones para pruebas unitarias
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        generateChatId
    };
}