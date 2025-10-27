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
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
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
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
});

// DETECTAR SI HAY USUARIO LOGUEADO
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        // NO mostramos automáticamente, el usuario debe hacer clic en el botón
        loadMessages();
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
   El contenedor del chat usa flexbox para organizar verticalmente
   el header, el área de mensajes y el área de entrada.
   
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
// VERSIÓN ACTUAL: PEDIR NOMBRE SIN LOGIN
// ========================================
function askForUsername() {
    currentUserName = prompt('¿Cuál es tu nombre?', 'Usuario Anónimo');
    
    if (!currentUserName || currentUserName.trim() === '') {
        currentUserName = 'Usuario Anónimo';
    }
    
    // MODIFICACIÓN: Ya no mostramos automáticamente el chat
    // El usuario debe hacer clic en el botón flotante
    document.getElementById('login-screen').style.display = 'none';
    // Removemos esta línea: document.getElementById('chat-screen').style.display = 'flex';
    
    document.getElementById('user-info').textContent = 'Conectado como: ' + currentUserName;
    
    loadMessages();
    
    console.log('Usuario configurado: ' + currentUserName);
    console.log('Para ver el chat, haz clic en el botón flotante "Chat"');
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
                errorElement.textContent = 'Error: ' + error.message';
            }
        });
}
*/

// ========================================
// FUNCIÓN: CERRAR SESIÓN / CAMBIAR NOMBRE
// ========================================
function logout() {
    // VERSIÓN ACTUAL: Cambiar nombre
    askForUsername();
    
    /* VERSIÓN CON AUTENTICACIÓN (comentada):
    auth.signOut()
        .then(() => {
            alert('Sesión cerrada. ¡Hasta pronto!');
        });
    */
}

// ========================================
// FUNCIÓN: ENVIAR MENSAJE
// ========================================
function sendMessage() {
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    
    if (message === '') {
        alert('Escribe algo antes de enviar');
        return;
    }
    
    // VERSIÓN ACTUAL: Sin autenticación
    db.collection('messages').add({
        text: message,
        userName: currentUserName,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    })
    
    /* VERSIÓN CON AUTENTICACIÓN (comentada):
    Reemplaza el bloque db.collection de arriba con este:
    
    db.collection('messages').add({
        text: message,
        userId: currentUser.uid,
        userEmail: currentUser.email,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    })
    */
    
    .then(() => {
        input.value = '';
    })
    .catch(error => {
        alert('Error al enviar mensaje: ' + error.message);
    });
}

// ========================================
// FUNCIÓN: CARGAR MENSAJES EN TIEMPO REAL
// ========================================
function loadMessages() {
    db.collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
            const messagesDiv = document.getElementById('messages');
            messagesDiv.innerHTML = '';
            
            snapshot.forEach(doc => {
                const msg = doc.data();
                
                const messageElement = document.createElement('div');
                messageElement.className = 'message';
                
                // VERSIÓN ACTUAL: Comparar por nombre
                if (msg.userName === currentUserName) {
                    messageElement.classList.add('my-message');
                }
                
                /* VERSIÓN CON AUTENTICACIÓN (comentada):
                Reemplaza la línea de arriba con:
                
                if (msg.userId === currentUser.uid) {
                    messageElement.classList.add('my-message');
                }
                */
                
                messageElement.innerHTML = `
                    <div class="message-header">
                        <strong>${msg.userName || msg.userEmail}</strong>
                        <span class="timestamp">${formatTime(msg.timestamp)}</span>
                    </div>
                    <div class="message-text">${msg.text}</div>
                `;
                
                /* VERSIÓN CON AUTENTICACIÓN (comentada):
                Reemplaza el innerHTML de arriba con:
                
                messageElement.innerHTML = `
                    <div class="message-header">
                        <strong>${msg.userEmail}</strong>
                        <span class="timestamp">${formatTime(msg.timestamp)}</span>
                    </div>
                    <div class="message-text">${msg.text}</div>
                `;
                */
                
                messagesDiv.appendChild(messageElement);
            });
            
            // CLEARFIX para float
            const clearDiv = document.createElement('div');
            clearDiv.style.clear = 'both';
            messagesDiv.appendChild(clearDiv);
            
            // Scroll automático al final
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
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
// FUNCIÓN: MOSTRAR PANTALLA DE CHAT
// ========================================
function showChat() {
    document.getElementById('login-screen').style.display = 'none';
    // MODIFICACIÓN: Ya no mostramos automáticamente
    // document.getElementById('chat-screen').style.display = 'flex';
    
    document.getElementById('user-info').textContent = 'Conectado como: ' + currentUserName;
    
    /* VERSIÓN CON AUTENTICACIÓN (comentada):
    Reemplaza la línea de arriba con:
    
    document.getElementById('user-info').textContent = 'Conectado como: ' + currentUser.email;
    */
}