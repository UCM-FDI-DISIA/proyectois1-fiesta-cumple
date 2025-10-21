/* script.js
   Sistema local de registro e inicio de sesión, diseñado para funcionar solo en el cliente
   (sin servidor). Guarda usuarios en localStorage, pero **no** guarda contraseñas en
   texto plano: usa PBKDF2 (Web Crypto) con salt para almacenar sólo hashes.
   Comentarios detallados en cada parte para que lo entiendas aunque seas nuevo.
*/

/* ============================
   UTILIDADES CRIPTOGRÁFICAS
   ============================ */

/* Convierte un ArrayBuffer a cadena hex (para almacenar hash/salt legible). */
function bufferToHex(buffer) {
    // new Uint8Array(buffer) crea una vista de bytes del buffer
    const bytes = new Uint8Array(buffer);
    // transformamos cada byte en dos caracteres hex y los juntamos
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* Convierte una cadena hex a ArrayBuffer (necesario para usar como salt). */
function hexToBuffer(hex) {
    if (!hex) return new Uint8Array().buffer;
    const bytes = new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    return bytes.buffer;
}

/* Genera una salt aleatoria de 16 bytes y la devuelve en hex. */
function generarSaltHex() {
    const array = new Uint8Array(16);             // 16 bytes de salt
    window.crypto.getRandomValues(array);         // rellena con aleatoriedad segura
    return bufferToHex(array.buffer);             // devuelve como hex
}

/* 
  Hashea una contraseña con PBKDF2 usando la salt (hex) y devuelve el hash en hex.
  - password: string plano que ha escrito el usuario
  - saltHex: salt en forma hex (si no existe, generarSaltHex() se usa al crear usuario)
  Retorna un string hex del hash derivado.
*/
async function hashPasswordPBKDF2(password, saltHex) {
    // convertimos password a ArrayBuffer con TextEncoder
    const enc = new TextEncoder();
    const pwBuffer = enc.encode(password);

    // importamos la "clave base" (la contraseña) para derivar
    const keyMaterial = await window.crypto.subtle.importKey(
        'raw',                // material en crudo (la contraseña)
        pwBuffer,             // datos de la contraseña
        { name: 'PBKDF2' },   // algoritmo usado para derivar
        false,                // no es exportable (no necesitamos reexportar)
        ['deriveBits']        // solo usaremos deriveBits
    );

    // parámetros PBKDF2: salt, iteraciones y hash (SHA-256)
    const params = {
        name: 'PBKDF2',
        salt: hexToBuffer(saltHex),
        iterations: 120000,   // número de iteraciones; 120k es razonable para clientes modernos
        hash: 'SHA-256'
    };

    // derivamos 256 bits (32 bytes)
    const derivedBits = await window.crypto.subtle.deriveBits(params, keyMaterial, 256);
    return bufferToHex(derivedBits);
}

/* ============================
   ALMACENAMIENTO (localStorage)
   ============================ */

/*
  Esquema de almacenamiento en localStorage:
  - Clave "miweb_users" contiene un JSON con la forma:
    {
      "usuario1": { salt: "<hex>", hash: "<hex>", createdAt: "...", fields: { ... } },
      "maria":    { ... }
    }

  - Clave "miweb_session" contiene el nombre del usuario actualmente logueado (string)
    o null si no hay sesión.
*/

/* Nombre de la clave en localStorage para los usuarios */
const LS_USERS_KEY = 'miweb_users_v1';

/* Nombre de la clave en localStorage para sesión */
const LS_SESSION_KEY = 'miweb_session_v1';

/* Leer todos los usuarios desde localStorage; si no existe devuelve {} */
function leerUsuarios() {
    try {
        const raw = localStorage.getItem(LS_USERS_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        console.error('Error al leer usuarios:', e);
        return {};
    }
}

/* Guardar objeto usuarios en localStorage (sobrescribe la clave completa) */
function guardarUsuarios(obj) {
    localStorage.setItem(LS_USERS_KEY, JSON.stringify(obj, null, 2));
}

/* Guardar sesión: username string o null para cerrar sesión */
function guardarSesion(usernameOrNull) {
    if (usernameOrNull) {
        sessionStorage.setItem(LS_SESSION_KEY, usernameOrNull); // sessionStorage para sesión temporal
    } else {
        sessionStorage.removeItem(LS_SESSION_KEY);
    }
}

/* Leer sesión actual (username o null) */
function leerSesion() {
    return sessionStorage.getItem(LS_SESSION_KEY);
}

/* ============================
   LÓGICA DE USUARIOS
   ============================ */

/* Comprueba si un nombre de usuario ya existe (true/false) */
function existeUsuario(username) {
    const users = leerUsuarios();
    return Object.prototype.hasOwnProperty.call(users, username);
}

/* Crear un usuario nuevo:
   - username: string
   - password: string (en texto plano, entrará aquí y se hasheará)
   Devuelve un objeto { ok: true } o { ok:false, error: '...' } */
async function crearUsuario(username, password) {
    // validaciones básicas
    if (!username || !password) return { ok: false, error: 'Usuario y contraseña obligatorios' };

    const users = leerUsuarios();
    if (users[username]) return { ok: false, error: 'El usuario ya existe' };

    // generamos salt y hash
    const salt = generarSaltHex();
    const hash = await hashPasswordPBKDF2(password, salt);

    // guardamos la estructura: salt y hash, más metadata y espacio para futuros campos
    users[username] = {
        salt: salt,
        hash: hash,
        createdAt: new Date().toISOString(),
        // "fields" es un objeto extensible donde más tarde puedes añadir foto/descripcion etc.
        fields: {}
    };

    // persistimos en localStorage
    guardarUsuarios(users);

    return { ok: true };
}

/* Verificar credenciales:
   - username y password (texto)
   - devuelve { ok:true } si coinciden, o { ok:false, error: '...' } */
async function verificarCredenciales(username, password) {
    if (!username || !password) return { ok: false, error: 'Rellena ambos campos' };

    const users = leerUsuarios();
    const record = users[username];
    if (!record) return { ok: false, error: 'Usuario o contraseña incorrectos' };

    // recalculamos hash con la salt guardada
    const hash2 = await hashPasswordPBKDF2(password, record.salt);

    // comparamos hashes (const time compare no crítico aquí, pero suficiente)
    if (hash2 !== record.hash) return { ok: false, error: 'Usuario o contraseña incorrectos' };

    return { ok: true };
}

/* Obtener datos seguros del usuario (username y una representación enmascarada de la contraseña).
   NOTA: No es posible recuperar la contraseña original (por diseño), así que mostramos máscara. */
function obtenerDatosUsuarioParaMostrar(username) {
    const users = leerUsuarios();
    const record = users[username];
    if (!record) return null;

    // Para el campo contraseña mostramos una máscara de longitud indicativa (no la real)
    const masked = '•'.repeat(8); // 8 puntos; no es la contraseña real
    return {
        username,
        passwordMasked: masked,
        createdAt: record.createdAt,
        fields: record.fields // campos extra (foto, descripcion...) para ampliar en el futuro
    };
}

/* ============================
   UI: manejo de modales y botones
   ============================ */

/* Obtenemos referencias a los elementos del DOM que usaremos */
const userButton = document.getElementById('userButton');
const userButtonContent = document.getElementById('userButtonContent');

const authModal = document.getElementById('authModal');
const openRegisterBtn = document.getElementById('openRegister');
const openLoginBtn = document.getElementById('openLogin');
const closeAuthModal = document.getElementById('closeAuthModal');

const registerModal = document.getElementById('registerModal');
const closeRegisterModal = document.getElementById('closeRegisterModal');
const formRegister = document.getElementById('formRegister');
const regUsername = document.getElementById('regUsername');
const regPassword = document.getElementById('regPassword');
const regMessage = document.getElementById('regMessage');
const cancelRegister = document.getElementById('cancelRegister');

const loginModal = document.getElementById('loginModal');
const closeLoginModal = document.getElementById('closeLoginModal');
const formLogin = document.getElementById('formLogin');
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const loginMessage = document.getElementById('loginMessage');
const cancelLogin = document.getElementById('cancelLogin');

const sessionPanel = document.getElementById('sessionPanel');
const spUsername = document.getElementById('spUsername');
const spPasswordMasked = document.getElementById('spPasswordMasked');
const logoutBtn = document.getElementById('logoutBtn');

const welcomeArea = document.getElementById('welcomeArea');

// Referencias a elementos de la encuesta
const surveyModal = document.getElementById('surveyModal');
const closeSurveyModal = document.getElementById('closeSurveyModal');
const formSurvey = document.getElementById('formSurvey');
const surveyName = document.getElementById('surveyName');
const surveyMessage = document.getElementById('surveyMessage');

/* Funciones para mostrar/ocultar modales (manejamos aria-hidden y display) */
function abrirModal(modalEl) {
    modalEl.style.display = 'flex';      // mostramos (flex centra en CSS)
    modalEl.setAttribute('aria-hidden', 'false');
}
function cerrarModal(modalEl) {
    modalEl.style.display = 'none';
    modalEl.setAttribute('aria-hidden', 'true');
}

/* Mostrar panel de sesión (cuando hay usuario conectado) - MODIFICADO */
function mostrarSessionPanel(username) {
    const datos = obtenerDatosUsuarioParaMostrar(username);
    if (!datos) return;
    spUsername.textContent = datos.username;
    spPasswordMasked.textContent = datos.passwordMasked;
    
    // Mostrar panel
    sessionPanel.style.display = 'block';
    sessionPanel.setAttribute('aria-hidden', 'false');

    // Actualizar el botón circular con la inicial del usuario
    // Si tiene nombre guardado, usar la inicial del nombre, sino del username
    const nombreGuardado = obtenerNombreUsuario(username);
    const inicial = nombreGuardado 
        ? nombreGuardado.charAt(0).toUpperCase() 
        : username.charAt(0).toUpperCase();
    userButtonContent.textContent = inicial;
}

/* Ocultar panel de sesión (y restablecer icono) */
function ocultarSessionPanel() {
    sessionPanel.style.display = 'none';
    sessionPanel.setAttribute('aria-hidden', 'true');

    // restauramos icono por defecto
    userButtonContent.textContent = '👤';
}

/* Actualiza la UI de bienvenida dependiendo si hay sesión o no */
function actualizarUIPorSesion() {
    const current = leerSesion();
    if (current) {
        // Si hay sesión, indicamos bienvenida
        welcomeArea.innerHTML = `<strong>Bienvenido, ${current}.</strong>`;
        mostrarSessionPanel(current);
    } else {
        // Si no hay sesión
        welcomeArea.innerHTML = `<em>No hay sesión iniciada.</em>`;
        ocultarSessionPanel();
    }
}

/* ============================
   EVENTOS: interacción del usuario
   ============================ */

/* Click en el botón circular:
   - Si hay sesión: mostrar/ocultar panel de sesión
   - Si no hay sesión: abrir modal de auth (opciones) */
userButton.addEventListener('click', () => {
    const current = leerSesion();
    if (current) {
        // alternamos el panel de sesión
        const menu = document.getElementById('userMenu');
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    } else {
        abrirModal(authModal);
    }
});


document.getElementById('verPanelBtn').addEventListener('click', () => {
    document.getElementById('userMenu').style.display = 'none';
    const username = leerSesion();
    const users = leerUsuarios();
    const user = users[username];

    if (!user || !user.fields || !user.fields.encuestaCompletada) return;

    document.getElementById('panelName').textContent = user.fields.nombre;
    document.getElementById('panelPhoto').src = user.fields.foto || 'default.jpg';
    renderTags('panelHabits', user.fields.habitos || []);
    renderTags('panelInterests', user.fields.intereses || []);
    document.getElementById('profilePanel').style.display = 'block';
    document.getElementById('closeProfilePanel').addEventListener('click', () => {
        document.getElementById('profilePanel').style.display = 'none';
    });

});

document.getElementById('verPaginaBtn').addEventListener('click', () => {
    document.getElementById('userMenu').style.display = 'none';
    window.location.href = 'perfil.html';
});

/* Botones para abrir registro o login desde modal de opciones */
openRegisterBtn.addEventListener('click', () => {
    cerrarModal(authModal);        // cerramos modal de opciones
    abrirModal(registerModal);    // abrimos modal de registro
});
openLoginBtn.addEventListener('click', () => {
    cerrarModal(authModal);       // cerramos modal de opciones
    abrirModal(loginModal);       // abrimos modal de login
});

/* Cerrar modales con sus botones 'X' o cancel */
closeAuthModal.addEventListener('click', () => cerrarModal(authModal));
closeRegisterModal.addEventListener('click', () => cerrarModal(registerModal));
closeLoginModal.addEventListener('click', () => cerrarModal(loginModal));
cancelRegister.addEventListener('click', () => cerrarModal(registerModal));
cancelLogin.addEventListener('click', () => cerrarModal(loginModal));

/* Envío del formulario de registro - MODIFICADO */
formRegister.addEventListener('submit', async (ev) => {
    ev.preventDefault();  // evitamos recarga de la página
    regMessage.textContent = ''; // limpiamos mensajes

    const username = regUsername.value.trim();
    const password = regPassword.value;

    // Llamamos a crearUsuario (que hace hashing y guarda)
    const resultado = await crearUsuario(username, password);
    if (!resultado.ok) {
        // mostramos el error en el área correspondiente
        regMessage.textContent = resultado.error;
        return;
    }

    // si todo ok, cerramos modal y limpiamos formulario
    cerrarModal(registerModal);
    formRegister.reset();

    // ABRIR ENCUESTA en lugar de mostrar alert
    abrirEncuesta(username);
});

/* Envío del formulario de login */
formLogin.addEventListener('submit', async (ev) => {
    ev.preventDefault(); // evitamos recarga
    loginMessage.textContent = '';

    const username = loginUsername.value.trim();
    const password = loginPassword.value;

    const result = await verificarCredenciales(username, password);
    if (!result.ok) {
        // mostramos mensaje de error (especificaste "Usuario o contraseña incorrectos")
        loginMessage.textContent = 'Usuario o contraseña incorrectos';
        return;
    }

    // Si correcto: guardamos sesión (en sessionStorage) y actualizamos UI
    guardarSesion(username);

    // cerramos modal, limpiamos formulario
    cerrarModal(loginModal);
    formLogin.reset();

    actualizarUIPorSesion();
});

/* Cerrar sesión */
logoutBtn.addEventListener('click', () => {
    guardarSesion(null); // borramos sesión
    actualizarUIPorSesion();
});

/* Inicializamos UI al cargar la página */
window.addEventListener('DOMContentLoaded', () => {
    actualizarUIPorSesion();
});

// ============================
// ENCUESTA - Guardar nombre del usuario 
// ============================

/* Función para guardar el nombre en el perfil del usuario */
function guardarNombreUsuario(username, nombreCompleto) {
    const users = leerUsuarios();
    if (users[username]) {
        // Guardamos el nombre en el campo "fields" que ya existe en la estructura
        users[username].fields = users[username].fields || {};
        users[username].fields.nombre = nombreCompleto;
        users[username].fields.encuestaCompletada = true;
        guardarUsuarios(users);
        return true;
    }
    return false;
}

/* Función para abrir la encuesta después del registro exitoso */
function abrirEncuesta(username) {
    // Limpiar el formulario
    formSurvey.reset();
    surveyMessage.textContent = '';
    
    // Guardar el username en un data attribute para usarlo después
    formSurvey.setAttribute('data-username', username);
    
    // Abrir el modal de encuesta
    abrirModal(surveyModal);
}

/* Función para obtener el nombre del usuario si existe */
function obtenerNombreUsuario(username) {
    const users = leerUsuarios();
    if (users[username] && users[username].fields && users[username].fields.nombre) {
        return users[username].fields.nombre;
    }
    return null;
}

// ============================
// EVENTOS NUEVOS 
// ============================

/* Envío del formulario de encuesta - NUEVO */
formSurvey.addEventListener('submit', (ev) => {
    ev.preventDefault();
    surveyMessage.textContent = '';

    const nombreCompleto = surveyName.value.trim();
    const username = formSurvey.getAttribute('data-username');

    if (!nombreCompleto) {
        surveyMessage.textContent = 'Por favor, introduce tu nombre';
        return;
    }

    if (!username) {
        surveyMessage.textContent = 'Error: no se pudo identificar el usuario';
        return;
    }

    // Guardar el nombre en el perfil del usuario
    const exito = guardarNombreUsuario(username, nombreCompleto);
    
    if (exito) {
        // Cerrar modal de encuesta
        cerrarModal(surveyModal);
        formSurvey.removeAttribute('data-username');
        
        // Mostrar mensaje de éxito
        alert(`¡Perfecto, ${nombreCompleto}! Tu perfil se ha completado correctamente. Ahora puedes iniciar sesión.`);
    } else {
        surveyMessage.textContent = 'Error al guardar tu información';
    }
});

// Cerrar modal de encuesta
closeSurveyModal.addEventListener('click', () => {
    const username = formSurvey.getAttribute('data-username');
    cerrarModal(surveyModal);
    formSurvey.removeAttribute('data-username');
    
    // Si cierran la encuesta sin completarla, mostrar mensaje normal
    if (username) {
        alert('Usuario creado correctamente. Puedes completar tu perfil más tarde.');
    }
});


function renderTags(containerId, tags) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    tags.forEach(tag => {
        const span = document.createElement('span');
        span.className = 'tag';
        span.textContent = tag;
        container.appendChild(span);
    });
}

