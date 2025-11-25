// ============================================
// SISTEMA DE EASTER EGGS PARA VENERIS
// ============================================
// Este archivo gestiona los easter eggs ocultos en la aplicación
// Los easter eggs solo se activan en contextos específicos para evitar interferencias

// ============================================
// VARIABLES GLOBALES
// ============================================

// Easter Egg 1: Konami Code (↑↑↓↓←→←→BA)
let konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let konamiIndex = 0;

// Easter Egg 2: Triple click en el logo
let logoClickCount = 0;
let logoClickTimer = null;

// Easter Egg 3: Escribir palabras secretas ("cupido", "venus", "amor")
let secretWord = '';
let secretTimer = null;

// Easter Egg 4: Click en el título 5 veces
let titleClickCount = 0;

// Easter Egg 5: Mantener presionado Alt + V durante 3 segundos
let altVPressed = false;
let altVTimer = null;

// Easter Egg 6: Hora especial (14:14)
let loveTimeIntervalId = null;

// ============================================
// FUNCIONES AUXILIARES
// ============================================

/**
 * Verifica si el usuario está escribiendo en un campo de entrada
 * @param {Event} e - Evento de teclado
 * @returns {boolean} - true si el evento proviene de un input/textarea
 */
function isTypingInInputField(e) {
    // Obtenemos el elemento donde ocurrió el evento
    const target = e.target;
    
    // Verificamos si es un input, textarea o cualquier elemento editable
    return (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable
    );
}

/**
 * Verifica si el usuario está en la pantalla de login/inicio
 * @returns {boolean} - true si la pantalla de login está visible
 */
function isInLoginScreen() {
    const loginScreen = document.getElementById('login-screen');
    // Comprobamos que existe y que está visible (display no es 'none')
    return loginScreen && loginScreen.style.display !== 'none';
}

// ============================================
// EASTER EGG 1: KONAMI CODE
// ============================================
// Código: ↑↑↓↓←→←→BA
// Activa una lluvia de corazones cuando se completa la secuencia

document.addEventListener('keydown', function(e) {
    // Verificar si la tecla presionada coincide con la siguiente en la secuencia
    if (e.key === konamiCode[konamiIndex]) {
        konamiIndex++;
        
        // Si se completó toda la secuencia
        if (konamiIndex === konamiCode.length) {
            activateKonamiEasterEgg();
            konamiIndex = 0; // Resetear para permitir múltiples activaciones
        }
    } else {
        // Si se presiona una tecla incorrecta, reiniciar la secuencia
        konamiIndex = 0;
    }
});

/**
 * Activa el easter egg del Código Konami
 * Crea una lluvia de corazones cayendo por la pantalla
 */
function activateKonamiEasterEgg() {
    createHeartRain();
    showSecretMessage('🎮 ¡Código Konami activado! Las flechas de Cupido llueven sobre ti... 💘');
}

/**
 * Crea una animación de corazones cayendo desde arriba
 * Genera 30 corazones con posiciones y tamaños aleatorios
 */
function createHeartRain() {
    const hearts = ['💕', '💖', '💗', '💓', '💝', '💘'];
    
    // Crear 30 corazones con un pequeño delay entre cada uno
    for (let i = 0; i < 30; i++) {
        setTimeout(() => {
            // Crear elemento div para cada corazón
            const heart = document.createElement('div');
            heart.textContent = hearts[Math.floor(Math.random() * hearts.length)];
            
            // Estilos inline para el corazón
            heart.style.position = 'fixed';
            heart.style.left = Math.random() * 100 + 'vw'; // Posición horizontal aleatoria
            heart.style.top = '-50px'; // Empieza arriba de la pantalla
            heart.style.fontSize = (Math.random() * 30 + 20) + 'px'; // Tamaño aleatorio 20-50px
            heart.style.zIndex = '10000'; // Asegurar que esté por encima de todo
            heart.style.pointerEvents = 'none'; // No bloquear clicks
            heart.style.animation = 'fall ' + (Math.random() * 2 + 3) + 's linear'; // Duración aleatoria 3-5s
            
            document.body.appendChild(heart);
            
            // Eliminar el corazón después de 5 segundos para liberar memoria
            setTimeout(() => heart.remove(), 5000);
        }, i * 100); // 100ms de delay entre cada corazón
    }

    // Agregar la animación CSS solo si no existe previamente
    if (!document.getElementById('heart-rain-style')) {
        const style = document.createElement('style');
        style.id = 'heart-rain-style';
        style.textContent = `
            @keyframes fall {
                to { 
                    transform: translateY(100vh) rotate(360deg); 
                    opacity: 0; 
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// ============================================
// EASTER EGG 2: TRIPLE CLICK EN EL LOGO
// ============================================
// Hacer triple click en el logo de Veneris para activar

const logo = document.getElementById('veneris-logo');
if (logo) {
    logo.addEventListener('click', function() {
        logoClickCount++;
        clearTimeout(logoClickTimer);
        
        // Si se alcanzaron 3 clicks
        if (logoClickCount === 3) {
            // Animar el logo (rotación y escalado)
            logo.style.transform = 'rotate(360deg) scale(1.2)';
            logo.style.transition = 'transform 0.8s ease';
            
            // Después de la animación, resetear y mostrar mensaje
            setTimeout(() => {
                logo.style.transform = 'none';
                showSecretMessage('🌊 Como Venus nacida de la espuma del mar, el amor emerge en los lugares más inesperados...');
            }, 800);
            
            logoClickCount = 0;
        } else {
            // Si no se alcanzó el triple click en 500ms, resetear contador
            logoClickTimer = setTimeout(() => logoClickCount = 0, 500);
        }
    });
}

// ============================================
// EASTER EGG 3: PALABRAS SECRETAS
// ============================================
// Escribir "cupido", "venus" o "amor" en la pantalla de LOGIN/INICIO para activar
// CAMBIO IMPORTANTE: Ahora funciona en la pantalla de LOGIN (no en registro)
// Solo se activa cuando el usuario está en la pantalla de login
// y NO está escribiendo dentro del campo de nombre de usuario

document.addEventListener('keydown', function(e) {
    // VALIDACIÓN 1: Verificar que estamos en la pantalla de login/inicio
    if (!isInLoginScreen()) {
        return; // Si no estamos en login, salir
    }
    
    // VALIDACIÓN 2: Verificar que NO estamos escribiendo en un input
    if (isTypingInInputField(e)) {
        return; // Si estamos en un input (como el campo de username), salir
    }
    
    // VALIDACIÓN 3: Ignorar teclas especiales (flechas, ctrl, alt, etc.)
    // Solo queremos letras normales
    if (e.key.length > 1) {
        // Si la tecla tiene más de 1 carácter (ej: "Enter", "ArrowUp"), ignorar
        return;
    }
    
    // Limpiar el timer anterior
    clearTimeout(secretTimer);
    
    // Agregar la tecla presionada a la palabra secreta (en minúsculas)
    secretWord += e.key.toLowerCase();
    
    // DEBUG: Descomentar la siguiente línea para ver qué se está capturando
    // console.log('Palabra actual:', secretWord);
    
    // Verificar si se escribió alguna palabra clave
    if (secretWord.includes('cupido')) {
        showSecretMessage('🏹 ¡Has invocado a Cupido! Que sus flechas doradas guíen tu camino hacia el amor verdadero.');
        secretWord = '';
        // Efecto visual: pulso en el fondo
        document.body.style.animation = 'pulse-bg 2s ease-in-out';
        setTimeout(() => document.body.style.animation = '', 2000);
    } else if (secretWord.includes('venus')) {
        showSecretMessage('✨ Venus te sonríe. Según la leyenda, pronunciar su nombre tres veces trae buena fortuna en el amor.');
        secretWord = '';
    } else if (secretWord.includes('amor')) {
        showSecretMessage('💝 "Amor vincit omnia" - El amor todo lo vence. Palabras sabias de los antiguos romanos.');
        secretWord = '';
    }
    
    // Limitar la longitud de la palabra para evitar memoria excesiva
    if (secretWord.length > 20) {
        secretWord = secretWord.slice(-10); // Mantener solo los últimos 10 caracteres
    }
    
    // Resetear la palabra después de 2 segundos de inactividad
    secretTimer = setTimeout(() => secretWord = '', 2000);
});

// ============================================
// EASTER EGG 4: CLICK MÚLTIPLE EN EL TÍTULO
// ============================================
// Hacer click 5 veces en el título principal para mostrar mensajes de mitología

const title = document.getElementById('main-title');
if (title) {
    title.addEventListener('click', function() {
        titleClickCount++;
        
        // Si se alcanzaron 5 clicks
        if (titleClickCount === 5) {
            // Array de mensajes inspirados en mitología
            const messages = [
                '🌟 "El verdadero amor nunca se desvanece" - Sófocles',
                '💫 En la mitología, Venus y Marte fueron amantes eternos a pesar de sus diferencias',
                '🔮 Los romanos creían que Venus podía unir corazones a través de las estrellas',
                '⚡ Cupido, hijo de Venus, jamás reveló el secreto de sus flechas doradas'
            ];
            
            // Seleccionar un mensaje aleatorio
            const randomMessage = messages[Math.floor(Math.random() * messages.length)];
            showSecretMessage(randomMessage);
            
            // Efecto visual temporal: gradiente en el texto
            title.style.background = 'linear-gradient(135deg, #FF9F7A 0%, #FF7A5A 100%)';
            title.style.webkitBackgroundClip = 'text';
            title.style.webkitTextFillColor = 'transparent';
            
            // Resetear estilos después de 2 segundos
            setTimeout(() => {
                title.style.background = '';
                title.style.webkitBackgroundClip = '';
                title.style.webkitTextFillColor = '';
            }, 2000);
            
            titleClickCount = 0; // Resetear contador
        }
    });
}

// ============================================
// EASTER EGG 5: ALT + V (MANTENER 3 SEGUNDOS)
// ============================================
// Mantener presionadas Alt+V simultáneamente durante 3 segundos

document.addEventListener('keydown', function(e) {
    // Verificar si se presionan Alt+V y no se ha activado ya
    if (e.altKey && e.key.toLowerCase() === 'v' && !altVPressed) {
        altVPressed = true;
        
        // Iniciar temporizador de 3 segundos
        altVTimer = setTimeout(() => {
            showSecretMessage('🎭 Has descubierto el saludo secreto de Veneris. Los verdaderos devotos de Venus conocen este gesto.');
            createGoldenGlow();
            altVPressed = false; // Resetear para permitir futuras activaciones
        }, 3000);
    }
});

document.addEventListener('keyup', function(e) {
    // Si se suelta la V o se suelta Alt, cancelar el temporizador
    if (e.key.toLowerCase() === 'v' || !e.altKey) {
        clearTimeout(altVTimer);
        altVPressed = false;
    }
});

/**
 * Crea un efecto de resplandor dorado alrededor de la página
 * El efecto dura 3 segundos
 */
function createGoldenGlow() {
    document.body.style.boxShadow = 'inset 0 0 100px rgba(255, 215, 0, 0.3)';
    
    // Eliminar el efecto después de 3 segundos
    setTimeout(() => {
        document.body.style.boxShadow = '';
    }, 3000);
}

// ============================================
// FUNCIÓN PARA MOSTRAR MENSAJES SECRETOS
// ============================================
/**
 * Muestra un mensaje de notificación estilo "toast" en la parte superior
 * @param {string} message - El mensaje a mostrar
 */
function showSecretMessage(message) {
    // Eliminar mensaje anterior si existe (evitar duplicados)
    const existingMessage = document.getElementById('secret-toast');
    if (existingMessage) existingMessage.remove();

    // Crear nuevo elemento de notificación
    const toast = document.createElement('div');
    toast.id = 'secret-toast';
    toast.textContent = message;
    
    // Estilos inline para el toast
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #FF9F7A 0%, #FF7A5A 100%);
        color: white;
        padding: 20px 30px;
        border-radius: 30px;
        box-shadow: 0 10px 40px rgba(255, 122, 90, 0.5);
        z-index: 10000;
        font-size: 15px;
        font-weight: 600;
        max-width: 80%;
        text-align: center;
        animation: slideDown 0.5s ease-out, slideUp 0.5s ease-in 4.5s;
        font-family: Georgia, serif;
    `;
    
    document.body.appendChild(toast);

    // Agregar animaciones CSS solo si no existen
    if (!document.getElementById('toast-animations')) {
        const style = document.createElement('style');
        style.id = 'toast-animations';
        style.textContent = `
            @keyframes slideDown {
                from { transform: translateX(-50%) translateY(-100px); opacity: 0; }
                to { transform: translateX(-50%) translateY(0); opacity: 1; }
            }
            @keyframes slideUp {
                from { transform: translateX(-50%) translateY(0); opacity: 1; }
                to { transform: translateX(-50%) translateY(-100px); opacity: 0; }
            }
            @keyframes pulse-bg {
                0%, 100% { filter: brightness(1); }
                50% { filter: brightness(1.1); }
            }
        `;
        document.head.appendChild(style);
    }

    // Eliminar el toast después de 5 segundos
    setTimeout(() => toast.remove(), 5000);
}

// ============================================
// EASTER EGG 6: HORA DEL AMOR (14:14)
// ============================================
// Muestra un mensaje especial cuando el reloj marca las 14:14
// CORRECCIÓN: Ahora se ejecuta inmediatamente y se almacena el ID del intervalo

/**
 * Verifica si es la hora especial del amor (14:14)
 * Si es así, muestra un mensaje especial
 */
function checkLoveTime() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    // Si son las 14:14 exactamente
    if (hours === 14 && minutes === 14) {
        showSecretMessage('💞 ¡Son las 14:14! Hora del amor eterno. Venus te bendice en este momento mágico.');
    }
}

// CORRECCIÓN: Ejecutar inmediatamente al cargar la página
checkLoveTime();

// CORRECCIÓN: Guardar el ID del intervalo para poder cancelarlo si fuera necesario en el futuro
loveTimeIntervalId = setInterval(checkLoveTime, 60000); // Verificar cada minuto (60000ms)

// ============================================
// FUNCIÓN DE LIMPIEZA (PARA FUTURAS EXPANSIONES)
// ============================================
/**
 * Función para limpiar todos los timers e intervalos activos
 * Útil si en el futuro se necesita desactivar los easter eggs
 * o cuando el usuario cierra sesión
 */
function cleanupEasterEggs() {
    // Limpiar timers activos
    clearTimeout(logoClickTimer);
    clearTimeout(secretTimer);
    clearTimeout(altVTimer);
    
    // Limpiar intervalo de verificación de hora
    if (loveTimeIntervalId) {
        clearInterval(loveTimeIntervalId);
        loveTimeIntervalId = null;
    }
    
    // Resetear contadores
    konamiIndex = 0;
    logoClickCount = 0;
    secretWord = '';
    titleClickCount = 0;
    altVPressed = false;
}

// Exponer la función de limpieza globalmente por si se necesita en otros archivos
window.cleanupEasterEggs = cleanupEasterEggs;

// ============================================
// PISTAS EN CONSOLA
// ============================================
// Mostrar pistas para ayudar a los usuarios a descubrir los easter eggs

console.log('%c🏹 Pista de Cupido 🏹', 'color: #FF7A5A; font-size: 20px; font-weight: bold;');
console.log('%cLos secretos de Veneris esperan ser descubiertos...', 'color: #FF9F7A; font-size: 14px;');
console.log('%cIntenta: Código Konami, triple-click en el logo, escribe "cupido", "venus" o "amor" (en pantalla inicio), 5 clicks en el título, Alt+V durante 3s', 'color: #999; font-size: 12px; font-style: italic;');