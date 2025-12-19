/* ================================================================
   chat.js
   
   Sistema de chat modal independiente para la aplicacion web.
   Este modulo gestiona:
   - Apertura y cierre del modal de chat
   - Posicionamiento debajo del header
   - Interaccion con los botones de control
   
   Disenado para ser modular e independiente del resto del codigo,
   facilitando futuras expansiones y mantenimiento.
   ================================================================ */

/* ============================
   VARIABLES GLOBALES
   ============================ */

// Declaramos las variables globales (se inicializaran cuando el DOM este listo)
let chatContainer;
let openChatBtn;
let closeChatBtn;


/* ============================
   FUNCIONES DE CONTROL DEL MODAL
   ============================ */

/**
 * abrirChat()
 * 
 * Funcion que muestra el contenedor de chat en pantalla.
 * 
 * Que hace?
 * - Cambia el estilo display del contenedor de 'none' a 'flex'
 * - 'flex' permite organizar correctamente los elementos internos
 * - Hace visible el chat para que el usuario pueda interactuar con el
 */
function abrirChat() {
    chatContainer.style.display = 'flex';
    console.log('Chat abierto');
}

/**
 * cerrarChat()
 * 
 * Funcion que oculta el contenedor de chat de la pantalla.
 * 
 * Que hace?
 * - Cambia el estilo display del contenedor a 'none'
 * - Esto hace que el chat desaparezca completamente de la vista
 * - Libera el espacio en pantalla para el contenido normal
 */
function cerrarChat() {
    chatContainer.style.display = 'none';
    console.log('Chat cerrado');
}


/* ============================
   INICIALIZACION
   ============================ */

/**
 * Codigo que se ejecuta cuando la pagina se carga completamente
 * 
 * DOMContentLoaded = evento que se dispara cuando el HTML esta listo
 * IMPORTANTE: Aqui obtenemos las referencias a los elementos Y configuramos los eventos
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('Inicializando sistema de chat...');
    
    // ===== PASO 1: Obtener referencias a los elementos del DOM =====
    const header = document.querySelector('header');           // El header de la pagina
    chatContainer = document.getElementById('chatContainer');  // El contenedor del chat
    openChatBtn = document.getElementById('openChatBtn');      // Boton de texto "Chat" para abrir
    closeChatBtn = document.getElementById('closeChatBtn');    // Boton de flecha para cerrar
    
    // ===== PASO 2: Verificar que los elementos existen =====
    if (!header) {
        console.error('ERROR: No se encontro el elemento header');
        return;
    }
    if (!chatContainer) {
        console.error('ERROR: No se encontro el elemento #chatContainer');
        return;
    }
    if (!openChatBtn) {
        console.error('ERROR: No se encontro el elemento #openChatBtn');
        return;
    }
    if (!closeChatBtn) {
        console.error('ERROR: No se encontro el elemento #closeChatBtn');
        return;
    }
    
    // ===== PASO 3: Calcular y establecer la posicion del chat UNA SOLA VEZ =====
    // getBoundingClientRect() devuelve las dimensiones y posicion del elemento
    const headerHeight = header.getBoundingClientRect().height;
    
    // Establecemos el top del chat igual a la altura del header
    chatContainer.style.top = headerHeight + 'px';
    
    console.log('Posicion del chat configurada: top = ' + headerHeight + 'px');
    
    // ===== PASO 4: Asegurar que el chat empiece cerrado =====
    chatContainer.style.display = 'none';
    
    // ===== PASO 5: Configurar eventos de los botones =====
    
    // Cuando el usuario hace clic en el boton "Chat", abrir el contenedor
    openChatBtn.addEventListener('click', function() {
        console.log('Click en boton abrir chat');
        abrirChat();
    });
    
    // Cuando el usuario hace clic en el boton de flecha, cerrar el contenedor
    closeChatBtn.addEventListener('click', function() {
        console.log('Click en boton cerrar chat');
        cerrarChat();
    });
    
    // ===== PASO 6: Cerrar con tecla ESC =====
    /**
     * Funcionalidad adicional: cerrar el chat cuando el usuario
     * presiona la tecla "Escape" (ESC)
     */
    document.addEventListener('keydown', function(evento) {
        // Verificamos si el chat esta abierto Y se presiono ESC
        if (chatContainer.style.display === 'flex' && evento.key === 'Escape') {
            console.log('Tecla ESC presionada, cerrando chat...');
            cerrarChat();
        }
    });
    
    console.log('[OK] Sistema de chat inicializado correctamente');
});


/* ============================
   NOTAS PARA FUTURAS EXPANSIONES
   ============================ */

/*
 * Ideas para ampliar este modulo:
 * 
 * 1. MENSAJES:
 *    - Funcion para enviar mensajes
 *    - Funcion para recibir mensajes
 *    - Almacenamiento en localStorage o base de datos
 * 
 * 2. USUARIOS:
 *    - Lista de contactos
 *    - Estado online/offline
 *    - Avatares de usuario
 * 
 * 3. NOTIFICACIONES:
 *    - Contador de mensajes no leidos
 *    - Sonidos de notificacion
 *    - Badges visuales
 * 
 * 4. DISENO:
 *    - Animaciones de entrada/salida
 *    - Diferentes temas de color
 *    - Emojis y stickers
 * 
 * 5. FUNCIONALIDAD AVANZADA:
 *    - Busqueda en conversaciones
 *    - Envio de archivos/imagenes
 *    - Videollamadas
 */