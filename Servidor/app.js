/*
Para cuando queramos introducir el inicio de sesión: 
1. Descomenta las secciones marcadas como "VERSIÓN CON AUTENTICACIÓN (COMENTADA)".
2. Comenta o elimina las secciones marcadas como "VERSIÓN ACTUAL".
3. En el html, descomentar la línea <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>
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
// VERSIÓN ACTUAL: SIN AUTENTICACIÓN
// ========================================
const db = firebase.firestore();
let currentUserName = '';
let currentUserId = ''; // ID normalizado del usuario actual

/* ========================================
   VERSIÓN CON AUTENTICACIÓN (COMENTADA)
   Para activar: elimina este bloque de comentarios
   ======================================== 
const auth = firebase.auth();
let currentUser = null;
*/

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

// ========================================
// VERSIÓN ACTUAL: INICIALIZACIÓN SIN LOGIN
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
    /*
       El botón flotante funciona como un toggle (interruptor):
       - Si el chat está oculto, lo muestra
       - Si el chat está visible, lo oculta
       
       Esto permite usar un único botón para ambas acciones,
       mejorando la experiencia de usuario.
    */
    openChatBtn.addEventListener('click', function() {
        if (chatIsVisible) {
            // El chat está visible -> ocultarlo
            ocultar_chat();
        } else {
            // El chat está oculto -> mostrarlo
            mostrar_chat();
        }
    });
    
    console.log('[OK] Sistema de botón de chat configurado correctamente');
    
    // ===== SOLICITAR NOMBRE DE USUARIO =====
    // Pedir el nombre antes de mostrar el chat por primera vez
    askForUsername();
    
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
});

/* ========================================
   VERSIÓN CON AUTENTICACIÓN (COMENTADA)
   Reemplaza el bloque DOMContentLoaded de arriba con este:
   ========================================
document.addEventListener('DOMContentLoaded', () => {
    // ===== INICIALIZACIÓN DEL SISTEMA DE CHAT =====
    console.log('Inicializando sistema de chat...');
    
    chatScreen = document.getElementById('chat-screen');
    openChatBtn = document.getElementById('openChatBtn');
    
    if (!chatScreen) {
        console.error('ERROR: No se encontró el elemento #chat-screen');
        return;
    }
    if (!openChatBtn) {
        console.error('ERROR: No se encontró el elemento #openChatBtn');
        return;
    }
    
    chatScreen.style.display = 'none';
    chatIsVisible = false;
    
    openChatBtn.addEventListener('click', function() {
        if (chatIsVisible) {
            ocultar_chat();
        } else {
            mostrar_chat();
        }
    });
    
    console.log('[OK] Sistema de botón de chat configurado correctamente');
    
    // Configurar tecla Enter
    const input = document.getElementById('message-input');
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !input.disabled) {
                sendMessage();
            }
        });
    }
    
    // Configurar botón añadir chat
    const addChatBtn = document.getElementById('add-chat-btn');
    if (addChatBtn) {
        addChatBtn.addEventListener('click', addNewChat);
    }
});

// DETECTAR SI HAY USUARIO LOGUEADO
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        currentUserId = user.uid;
        // NO mostramos automáticamente, el usuario debe hacer clic en el botón
        loadUserChats();
    } else {
        showLogin();
    }
});
*/

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
// FUNCIÓN: NORMALIZAR NOMBRE DE USUARIO
// ========================================
/*
   normalizeUsername(name)
   
   Convierte un nombre de usuario a su forma normalizada
   para usarlo como ID único en Firebase.
   
   Transformaciones aplicadas:
   1. Convierte a minúsculas
   2. Elimina espacios al inicio y final
   3. Reemplaza espacios internos por guiones bajos
   
   Ejemplos:
   - "Maria" -> "maria"
   - "JUAN" -> "juan"
   - "Ana Garcia" -> "ana_garcia"
   - "  Pedro  " -> "pedro"
*/
function normalizeUsername(name) {
    return name.trim().toLowerCase().replace(/\s+/g, '_');
}

// ========================================
// VERSIÓN ACTUAL: PEDIR NOMBRE SIN LOGIN
// ========================================
/*
   askForUsername()
   
   Solicita el nombre de usuario y lo registra/carga en Firebase.
   
   Flujo:
   1. Pide el nombre con prompt
   2. Normaliza el nombre para usarlo como ID
   3. Verifica si el usuario existe en Firebase
   4. Si NO existe: crea un nuevo registro
   5. Si SÍ existe: carga sus datos
   6. Carga la lista de chats del usuario
*/
async function askForUsername() {
    let userName = prompt('¿Cuál es tu nombre?', 'Usuario Anónimo');
    
    if (!userName || userName.trim() === '') {
        userName = 'Usuario Anónimo';
    }
    
    currentUserName = userName.trim();
    currentUserId = normalizeUsername(currentUserName);
    
    console.log('Usuario: ' + currentUserName);
    console.log('ID normalizado: ' + currentUserId);
    
    // ===== VERIFICAR/CREAR USUARIO EN FIREBASE =====
    try {
        const userRef = db.collection('users').doc(currentUserId);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
            // Usuario nuevo: crear registro
            await userRef.set({
                userId: currentUserId,
                userName: currentUserName,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('[OK] Nuevo usuario creado en Firebase');
        } else {
            console.log('[OK] Usuario existente cargado desde Firebase');
        }
        
        // Actualizar UI
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('user-info').textContent = 'Conectado como: ' + currentUserName;
        
        // Cargar chats del usuario
        loadUserChats();
        
        console.log('Para ver el chat, haz clic en el botón flotante "Chat"');
        
    } catch (error) {
        console.error('Error al verificar/crear usuario:', error);
        alert('Error al conectar con Firebase: ' + error.message);
    }
}

/* ========================================
   VERSIÓN CON AUTENTICACIÓN (COMENTADA)
   ========================================
function register() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorElement = document.getElementById('login-error');
    
    if (!email || !password) {
        errorElement.textContent = 'Por favor completa todos los campos';
        return;
    }
    
    auth.createUserWithEmailAndPassword(email, password)
        .then(() => {
            alert('¡Cuenta creada con éxito! Ya puedes chatear.');
            errorElement.textContent = '';
        })
        .catch(error => {
            if (error.code === 'auth/email-already-in-use') {
                errorElement.textContent = 'Este email ya está registrado. Usa "Iniciar Sesión"';
            } else if (error.code === 'auth/weak-password') {
                errorElement.textContent = 'La contraseña debe tener mínimo 6 caracteres';
            } else if (error.code === 'auth/invalid-email') {
                errorElement.textContent = 'El email no es válido';
            } else {
                errorElement.textContent = 'Error: ' + error.message;
            }
        });
}

function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorElement = document.getElementById('login-error');
    
    if (!email || !password) {
        errorElement.textContent = 'Por favor completa todos los campos';
        return;
    }
    
    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            errorElement.textContent = '';
        })
        .catch(error => {
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                errorElement.textContent = 'Email o contraseña incorrectos';
            } else if (error.code === 'auth/invalid-email') {
                errorElement.textContent = 'El email no es válido';
            } else {
                errorElement.textContent = 'Error: ' + error.message;
            }
        });
}
*/

// ========================================
// FUNCIÓN: CERRAR SESIÓN / CAMBIAR NOMBRE
// ========================================
function logout() {
    // VERSIÓN ACTUAL: Cambiar nombre
    
    // Cerrar chat activo si lo hay
    if (currentChatId) {
        closeCurrentChat();
    }

    //Al cambiar el usuario se limpia la ventana de chat
    showEmptyState();
    
    // Pedir nuevo nombre
    askForUsername();
    
    /* VERSIÓN CON AUTENTICACIÓN (comentada):
    auth.signOut()
        .then(() => {
            alert('Sesión cerrada. ¡Hasta pronto!');
        });
    */
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
    
    // Escuchar cambios en tiempo real
    db.collection('chats')
        .where('participants', 'array-contains', currentUserId)
        .orderBy('lastMessageTime', 'desc')
        .onSnapshot(snapshot => {
            // Limpiar lista actual
            chatList.innerHTML = '';
            
            if (snapshot.empty) {
                // No hay chats: mostrar mensaje
                chatList.appendChild(noChatsMessage);
                console.log('No hay chats para este usuario');
            } else {
                // Hay chats: renderizar cada uno
                snapshot.forEach(doc => {
                    const chatData = doc.data();
                    renderChatItem(doc.id, chatData);
                });
                console.log(`Cargados ${snapshot.size} chats`);
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
   
   Parámetros:
   - chatId: ID del chat en Firebase
   - chatData: Datos del chat (participants, lastMessage, etc.)
   
   El elemento creado:
   - Muestra el nombre del otro usuario
   - Es clickeable para abrir el chat
   - Se marca como "activo" si es el chat actual
*/
function renderChatItem(chatId, chatData) {
    const chatList = document.getElementById('chat-list');
    
    // Determinar el nombre del otro usuario
    const otherUserId = chatData.participants.find(id => id !== currentUserId);
    
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
    // NOTA: Por ahora solo mostramos el ID. En el futuro se puede
    // hacer una consulta adicional para obtener el nombre real.
    chatItem.innerHTML = `
        <div class="chat-item-name">${otherUserId}</div>
    `;
    
    // Evento: abrir chat al hacer clic
    chatItem.addEventListener('click', () => {
        openChat(chatId, otherUserId);
    });
    
    chatList.appendChild(chatItem);
}

// ========================================
// FUNCIÓN: AÑADIR NUEVO CHAT
// ========================================
/*
   addNewChat()
   
   Permite al usuario iniciar una nueva conversación.
   
   Flujo:
   1. Pide el nombre del otro usuario con prompt
   2. Normaliza el nombre a ID
   3. Verifica que el usuario existe en Firebase
   4. Si existe: abre la ventana de chat (sin crear el chat aún)
   5. Si no existe: muestra error
   6. El chat se creará en Firebase cuando se envíe el primer mensaje
*/
async function addNewChat() {
    const partnerName = prompt('Introduce el nombre del usuario con el que quieres chatear:');
    
    if (!partnerName || partnerName.trim() === '') {
        return; // Usuario canceló
    }
    
    const partnerId = normalizeUsername(partnerName.trim());
    
    // No permitir chatear consigo mismo
    if (partnerId === currentUserId) {
        alert('No puedes chatear contigo mismo.');
        return;
    }
    
    try {
        // Verificar que el usuario existe
        const partnerRef = db.collection('users').doc(partnerId);
        const partnerDoc = await partnerRef.get();
        
        if (!partnerDoc.exists) {
            alert(`El usuario "${partnerName}" no existe.`);
            return;
        }
        
        console.log(`Usuario "${partnerId}" encontrado`);
        
        // Generar ID del chat
        const chatId = generateChatId(currentUserId, partnerId);
        
        // Verificar si el chat ya existe
        const chatRef = db.collection('chats').doc(chatId);
        const chatDoc = await chatRef.get();
        
        if (chatDoc.exists) {
            // El chat ya existe: abrirlo directamente
            console.log('Chat existente encontrado');
            openChat(chatId, partnerId);
        } else {
            // El chat NO existe: abrir ventana vacía
            // El chat se creará cuando se envíe el primer mensaje
            console.log('Preparando nuevo chat (se creará al enviar el primer mensaje)');
            openChat(chatId, partnerId);
        }
        
    } catch (error) {
        console.error('Error al añadir chat:', error);
        alert('Error al buscar el usuario: ' + error.message);
    }
}

// ========================================
// FUNCIÓN: ABRIR CHAT
// ========================================
/*
   openChat(chatId, partnerId)
   
   Abre una conversación específica en la ventana de mensajes.
   
   ¿Qué hace?
   1. Cierra el chat anterior si lo hay
   2. Actualiza las variables globales
   3. Actualiza el header con el nombre del otro usuario
   4. Habilita el input y el botón de enviar
   5. Carga los mensajes del chat
   6. Marca el chat como activo en la barra lateral
*/
function openChat(chatId, partnerId) {
    console.log(`Abriendo chat: ${chatId} con usuario: ${partnerId}`);
    
    // Cerrar chat anterior si lo hay
    if (currentChatId) {
        closeCurrentChat();
    }
    
    // Actualizar variables globales
    currentChatId = chatId;
    currentChatPartner = partnerId;
    
    // Actualizar header
    const chatTitle = document.getElementById('chat-title');
    chatTitle.textContent = partnerId;
    
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
 * ✅ Sistema de chats privados entre usuarios
 * ✅ Identificación única basada en nombres normalizados
 * ✅ Mensajes en tiempo real con Firebase
 * ✅ Barra lateral con lista de chats
 * ✅ Creación de chats bajo demanda (al enviar primer mensaje)
 * ✅ Validación de usuarios existentes
 * 
 * MEJORAS FUTURAS SUGERIDAS:
 * 
 * 1. MOSTRAR NOMBRE REAL EN LISTA DE CHATS:
 *    - Hacer consulta adicional a 'users' para obtener userName
 *    - Cachear nombres para mejorar rendimiento
 * 
 * 2. INFORMACIÓN ADICIONAL EN CHATS:
 *    - Mostrar último mensaje enviado
 *    - Mostrar hora del último mensaje
 *    - Contador de mensajes no leídos
 * 
 * 3. NOTIFICACIONES:
 *    - Badge con número de mensajes nuevos
 *    - Sonido al recibir mensaje
 *    - Notificaciones del navegador
 * 
 * 4. BÚSQUEDA Y FILTROS:
 *    - Buscar chats por nombre
 *    - Filtrar chats activos/archivados
 * 
 * 5. GESTIÓN DE CHATS:
 *    - Botón para eliminar/archivar chat
 *    - Marcar como no leído
 *    - Silenciar notificaciones
 * 
 * 6. MEJORAS DE UX:
 *    - Animaciones al abrir/cerrar
 *    - Indicador de "escribiendo..."
 *    - Confirmación de lectura (doble check)
 * 
 * 7. MIGRACIÓN A AUTENTICACIÓN:
 *    - Cuando se active Firebase Auth, currentUserId será user.uid
 *    - Solo hay que descomentar las secciones marcadas
 *    - La estructura de Firebase ya está preparada
 */