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
// VERSIÓN ACTUAL: INICIALIZACIÓN SIN LOGIN
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    askForUsername();
    
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
        showChat();
        loadMessages();
    } else {
        showLogin();
    }
});
*/

// ========================================
// VERSIÓN ACTUAL: PEDIR NOMBRE SIN LOGIN
// ========================================
function askForUsername() {
    currentUserName = prompt('¿Cuál es tu nombre?', 'Usuario Anónimo');
    
    if (!currentUserName || currentUserName.trim() === '') {
        currentUserName = 'Usuario Anónimo';
    }
    
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('chat-screen').style.display = 'flex';
    document.getElementById('user-info').textContent = 'Conectado como: ' + currentUserName;
    
    loadMessages();
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
}

// ========================================
// FUNCIÓN: MOSTRAR PANTALLA DE CHAT
// ========================================
function showChat() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('chat-screen').style.display = 'flex';
    
    document.getElementById('user-info').textContent = 'Conectado como: ' + currentUserName;
    
    /* VERSIÓN CON AUTENTICACIÓN (comentada):
    Reemplaza la línea de arriba con:
    
    document.getElementById('user-info').textContent = 'Conectado como: ' + currentUser.email;
    */
}