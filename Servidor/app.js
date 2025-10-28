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
let openChatBtn;     // Botón flotante para abrir el chat (#openChatBtn)
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
    
    // Obtener referencias a los elementos del DOM
    chatScreen = document.getElementById('chat-screen');
    openChatBtn = document.getElementById('openChatBtn');
    
    // Verificar que los elementos existen
    if (!chatScreen) {
        console.error('ERROR: No se encontró el elemento #chat-screen');
        return;
    }
    if (!openChatBtn) {
        console.error('ERROR: No se encontró el elemento #openChatBtn');
        return;
    }
    
    // Asegurar que el chat empiece oculto
    chatScreen.style.display = 'none';
    chatIsVisible = false;
    
    // ===== CONFIGURAR EVENTO DEL BOTÓN FLOTANTE =====
    openChatBtn.addEventListener('click', function() {
        if (chatIsVisible) {
            ocultar_chat();
        } else {
            mostrar_chat();
        }
    });
    
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
});

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

// Mostrar pantalla de login
function showLogin() {
    document.getElementById('login-screen').style.display = 'block';
    document.getElementById('register-screen').style.display = 'none';
    document.getElementById('chat-screen').style.display = 'none';
    document.getElementById('openChatBtn').style.display = 'none';
}

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

// Mostrar interfaz de chat
function showChatInterface() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('register-screen').style.display = 'none';
    document.getElementById('chat-screen').style.display = 'none';
    document.getElementById('openChatBtn').style.display = 'block';
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
        
        // Mostrar botones flotantes después de iniciar sesión
        document.getElementById('openChatBtn').style.display = 'block';
        const usersBtn = document.getElementById('openUsersBtn');
        if (usersBtn) {
            usersBtn.style.display = 'block';
        }
        
        setTimeout(() => {
            showChatInterface();
            errorElement.textContent = '';
            errorElement.style.color = 'red';
        }, 1000);
        
    } catch (error) {
        errorElement.textContent = 'Error al iniciar sesión: ' + error.message;
        console.error('Error al iniciar sesión:', error);
    }
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
        
        // Generar ID único basado en timestamp
        const userId = 'user_' + Date.now();
        currentUserId = userId;
        currentUserName = name.trim();
        
        // Subir foto de perfil si existe
        let photoURL = '';
        if (photoFile) {
            errorElement.textContent = 'Subiendo foto de perfil...';
            const storageRef = storage.ref(`profile-photos/${userId}`);
            await storageRef.put(photoFile);
            photoURL = await storageRef.getDownloadURL();
        }
        
        // Guardar perfil completo en Firestore
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
        
        // Mostrar botones flotantes después de crear cuenta
        document.getElementById('openChatBtn').style.display = 'block';
        const usersBtn = document.getElementById('openUsersBtn');
        if (usersBtn) {
            usersBtn.style.display = 'block';
        }
        
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
        await db.collection('users').doc(user.uid).set({
            userId: user.uid,
            userName: name,
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
    document.getElementById('openChatBtn').style.display = 'none';
    
    // Ocultar botón de lista de usuarios
    const usersBtn = document.getElementById('openUsersBtn');
    if (usersBtn) {
        usersBtn.style.display = 'none';
    }
    
    // Limpiar campo de login
    document.getElementById('login-username').value = '';
    document.getElementById('login-error').textContent = '';
    
    console.log('Sesión cerrada correctamente');
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
    messageInput.disabled = false;
    messageInput.placeholder = 'Escribe tu mensaje aquí...';
    sendBtn.disabled = false;
    
    // Remover estado vacío del área de mensajes
    const messagesDiv = document.getElementById('messages');
    messagesDiv.classList.remove('empty-state');
    messagesDiv.innerHTML = ''; // Limpiar contenido anterior
    
    // Cargar mensajes
    loadMessages(chatId);
    
    // Actualizar UI de la barra lateral
    updateChatListSelection(chatId);
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
/*
   loadMessages(chatId)
   
   Carga y muestra los mensajes de un chat específico.
   
   ¿Cómo funciona?
   1. Consulta la subcolección 'messages' del chat
   2. Ordena por timestamp ascendente (más antiguos primero)
   3. Escucha cambios en tiempo real
   4. Renderiza cada mensaje
   5. Hace scroll automático al final
   
   Importante: Guarda el listener para poder desuscribirse
   cuando se cierre el chat.
*/
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
                
                const messageElement = document.createElement('div');
                messageElement.className = 'message';
                
                // VERSIÓN ACTUAL: Comparar por ID de usuario
                if (msg.senderId === currentUserId) {
                    messageElement.classList.add('my-message');
                }
                
                /* VERSIÓN CON AUTENTICACIÓN (comentada):
                Reemplaza la línea de arriba con:
                
                if (msg.senderId === currentUser.uid) {
                    messageElement.classList.add('my-message');
                }
                */
                
                messageElement.innerHTML = `
                    <div class="message-header">
                        <strong>${msg.senderName}</strong>
                        <span class="timestamp">${formatTime(msg.timestamp)}</span>
                    </div>
                    <div class="message-text">${msg.text}</div>
                `;
                
                messagesDiv.appendChild(messageElement);
            });
            
            // CLEARFIX para float
            const clearDiv = document.createElement('div');
            clearDiv.style.clear = 'both';
            messagesDiv.appendChild(clearDiv);
            
            // Scroll automático al final
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
// FUNCIÓN: MOSTRAR PANTALLA DE LOGIN
// ========================================
function showLogin() {
    document.getElementById('login-screen').style.display = 'block';
    document.getElementById('chat-screen').style.display = 'none';
    chatIsVisible = false; // Actualizar estado
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
}

// ========================================
// EXPORTS PARA TESTING
// ========================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        normalizeUsername,
        generateChatId,
        formatTime,
        mostrar_chat,
        ocultar_chat,
        showEmptyState
    };
}

/* ========================================
   NOTAS PARA FUTURAS EXPANSIONES
   ======================================== */

/*
 * MEJORAS IMPLEMENTADAS:
 * ✅ Sistema de autenticación completa con Firebase Auth
 * ✅ Registro de usuarios con encuesta de perfil
 * ✅ Foto de perfil subida a Firebase Storage
 * ✅ Almacenamiento de hábitos y gustos
 * ✅ Validación de edad (18+)
 * ✅ Sistema de chats privados entre usuarios
 * ✅ Mensajes en tiempo real con Firebase
 * ✅ Barra lateral con lista de chats
 * ✅ Búsqueda de usuarios por nombre o email
 * ✅ Mostrar nombres reales en lista de chats
 * 
 * MEJORAS FUTURAS SUGERIDAS:
 * 
 * 1. PERFILES DE USUARIO:
 *    - Ver perfil completo de otros usuarios (foto, hábitos, gustos)
 *    - Editar propio perfil
 *    - Cambiar foto de perfil
 * 
 * 2. MATCHING/COMPATIBILIDAD:
 *    - Algoritmo de compatibilidad basado en hábitos y gustos
 *    - Sugerencias de usuarios compatibles
 *    - Sistema de "me gusta" mutuo
 * 
 * 3. INFORMACIÓN ADICIONAL EN CHATS:
 *    - Mostrar último mensaje enviado
 *    - Mostrar hora del último mensaje
 *    - Contador de mensajes no leídos
 *    - Foto de perfil en lista de chats
 * 
 * 4. NOTIFICACIONES:
 *    - Badge con número de mensajes nuevos
 *    - Sonido al recibir mensaje
 *    - Notificaciones del navegador
 * 
 * 5. BÚSQUEDA Y FILTROS:
 *    - Buscar chats por nombre
 *    - Filtrar chats activos/archivados
 *    - Búsqueda avanzada de usuarios (por edad, hábitos, etc.)
 * 
 * 6. GESTIÓN DE CHATS:
 *    - Botón para eliminar/archivar chat
 *    - Marcar como no leído
 *    - Silenciar notificaciones
 * 
 * 7. MEJORAS DE UX:
 *    - Animaciones al abrir/cerrar
 *    - Indicador de "escribiendo..."
 *    - Confirmación de lectura (doble check)
 *    - Envío de imágenes en el chat
 *    - Emojis y reacciones
 * 
 * 8. SEGURIDAD Y PRIVACIDAD:
 *    - Bloquear usuarios
 *    - Reportar usuarios
 *    - Configuración de privacidad
 *    - Recuperación de contraseña
 */