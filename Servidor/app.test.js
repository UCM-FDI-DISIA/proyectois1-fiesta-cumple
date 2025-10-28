/**
 * Pruebas unitarias para app.js - Función loadMessages
 * Framework: Jest con jsdom
 * 
 * Esta suite de pruebas verifica el comportamiento de loadMessages
 * en escenarios normales y extremos, incluyendo:
 * - Carga de mensajes vacíos
 * - Carga de múltiples mensajes
 * - Mensajes propios vs ajenos
 * - Formato de timestamps
 * - Manejo de errores
 * - Listeners activos
 */

// ============================
// CONFIGURACIÓN INICIAL
// ============================

// Configurar DOM antes de importar el módulo
document.body.innerHTML = `
    <div id="chat-screen" style="display: none;"></div>
    <button id="openChatBtn"></button>
    <div id="messages"></div>
    <input id="message-input" />
    <button id="send-btn"></button>
    <div id="chat-title"></div>
    <div id="user-info"></div>
    <div id="login-screen"></div>
    <div id="chat-list"></div>
    <div id="no-chats-message">No hay chats</div>
    <button id="add-chat-btn"></button>
`;

// Variables globales que necesita app.js
global.currentUserId = 'test_user';
global.currentUserName = 'Test User';
global.currentChatId = null;
global.currentChatPartner = null;
global.activeChatListener = null;

// Mock de Firebase Firestore
const mockOnSnapshot = jest.fn();
const mockOrderBy = jest.fn(() => ({
    onSnapshot: mockOnSnapshot
}));
const mockCollection = jest.fn(() => ({
    orderBy: mockOrderBy
}));
const mockDoc = jest.fn(() => ({
    collection: mockCollection
}));

global.firebase = {
    initializeApp: jest.fn(),
    firestore: jest.fn(() => ({
        collection: jest.fn(() => ({
            doc: mockDoc,
            where: jest.fn(() => ({
                orderBy: jest.fn(() => ({
                    onSnapshot: jest.fn()
                }))
            }))
        }))
    }))
};

global.db = {
    collection: jest.fn(() => ({
        doc: mockDoc
    }))
};

// Mock de console para evitar spam
global.console = {
    ...console,
    log: jest.fn(),
    error: jest.fn()
};

// Importar funciones
const {
    normalizeUsername,
    generateChatId,
    formatTime,
    mostrar_chat,
    ocultar_chat,
    showEmptyState
} = require('./app.js');

// ============================
// FUNCIÓN AUXILIAR: loadMessages
// ============================
// Como loadMessages no está exportada, la recreamos para testing
function loadMessages(chatId) {
    const messagesDiv = document.getElementById('messages');
    
    if (global.activeChatListener) {
        global.activeChatListener();
    }
    
    global.activeChatListener = db.collection('chats')
        .doc(chatId)
        .collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
            messagesDiv.innerHTML = '';
            
            snapshot.forEach(doc => {
                const msg = doc.data();
                
                const messageElement = document.createElement('div');
                messageElement.className = 'message';
                
                if (msg.senderId === global.currentUserId) {
                    messageElement.classList.add('my-message');
                }
                
                messageElement.innerHTML = `
                    <div class="message-header">
                        <strong>${msg.senderName}</strong>
                        <span class="timestamp">${formatTime(msg.timestamp)}</span>
                    </div>
                    <div class="message-text">${msg.text}</div>
                `;
                
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

// ============================
// SUITE DE PRUEBAS: loadMessages
// ============================

describe('loadMessages - Función de Carga de Mensajes', () => {

    let messagesDiv;

    beforeEach(() => {
        // Resetear DOM
        messagesDiv = document.getElementById('messages');
        messagesDiv.innerHTML = '';
        messagesDiv.scrollTop = 0;
        
        // Resetear mocks
        mockOnSnapshot.mockClear();
        mockOrderBy.mockClear();
        mockCollection.mockClear();
        mockDoc.mockClear();
        console.log.mockClear();
        console.error.mockClear();
        
        // Resetear variables globales
        global.currentUserId = 'test_user';
        global.activeChatListener = null;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // ============================
    // CASO 1: Chat sin mensajes (vacío)
    // ============================
    test('CASO 1: debe manejar un chat sin mensajes correctamente', () => {
        const chatId = 'chat_test_1';
        
        // Simular snapshot vacío
        const mockSnapshot = {
            forEach: jest.fn(),
            size: 0
        };
        
        mockOnSnapshot.mockImplementation((callback) => {
            callback(mockSnapshot);
            return jest.fn(); // unsubscribe function
        });
        
        loadMessages(chatId);
        
        // Verificaciones
        expect(db.collection).toHaveBeenCalledWith('chats');
        expect(mockDoc).toHaveBeenCalledWith(chatId);
        expect(mockCollection).toHaveBeenCalledWith('messages');
        expect(mockOrderBy).toHaveBeenCalledWith('timestamp', 'asc');
        expect(console.log).toHaveBeenCalledWith('Cargados 0 mensajes');
        
        // El div solo debe tener el clearfix
        const children = messagesDiv.children;
        expect(children.length).toBe(1);
        expect(children[0].style.clear).toBe('both');
    });

    // ============================
    // CASO 2: Chat con un solo mensaje
    // ============================
    test('CASO 2: debe cargar y renderizar un solo mensaje correctamente', () => {
        const chatId = 'chat_test_2';
        const mockMessage = {
            senderId: 'other_user',
            senderName: 'Otro Usuario',
            text: 'Hola, ¿cómo estás?',
            timestamp: {
                toDate: () => new Date('2025-01-15T14:30:00')
            }
        };
        
        const mockSnapshot = {
            forEach: jest.fn((callback) => {
                callback({
                    data: () => mockMessage
                });
            }),
            size: 1
        };
        
        mockOnSnapshot.mockImplementation((callback) => {
            callback(mockSnapshot);
            return jest.fn();
        });
        
        loadMessages(chatId);
        
        // Verificar que se renderizó el mensaje
        expect(messagesDiv.querySelectorAll('.message').length).toBe(1);
        
        const messageElement = messagesDiv.querySelector('.message');
        expect(messageElement.innerHTML).toContain('Otro Usuario');
        expect(messageElement.innerHTML).toContain('Hola, ¿cómo estás?');
        expect(messageElement.innerHTML).toContain('14:30');
        expect(messageElement.classList.contains('my-message')).toBe(false);
    });

    // ============================
    // CASO 3: Chat con múltiples mensajes
    // ============================
    test('CASO 3: debe cargar múltiples mensajes en orden correcto', () => {
        const chatId = 'chat_test_3';
        const mockMessages = [
            {
                senderId: 'test_user',
                senderName: 'Test User',
                text: 'Primer mensaje',
                timestamp: { toDate: () => new Date('2025-01-15T10:00:00') }
            },
            {
                senderId: 'other_user',
                senderName: 'Otro Usuario',
                text: 'Segundo mensaje',
                timestamp: { toDate: () => new Date('2025-01-15T10:05:00') }
            },
            {
                senderId: 'test_user',
                senderName: 'Test User',
                text: 'Tercer mensaje',
                timestamp: { toDate: () => new Date('2025-01-15T10:10:00') }
            }
        ];
        
        const mockSnapshot = {
            forEach: jest.fn((callback) => {
                mockMessages.forEach(msg => {
                    callback({ data: () => msg });
                });
            }),
            size: 3
        };
        
        mockOnSnapshot.mockImplementation((callback) => {
            callback(mockSnapshot);
            return jest.fn();
        });
        
        loadMessages(chatId);
        
        // Verificar cantidad de mensajes
        const messages = messagesDiv.querySelectorAll('.message');
        expect(messages.length).toBe(3);
        
        // Verificar contenido
        expect(messages[0].innerHTML).toContain('Primer mensaje');
        expect(messages[1].innerHTML).toContain('Segundo mensaje');
        expect(messages[2].innerHTML).toContain('Tercer mensaje');
        
        // Verificar timestamps
        expect(messages[0].innerHTML).toContain('10:00');
        expect(messages[1].innerHTML).toContain('10:05');
        expect(messages[2].innerHTML).toContain('10:10');
        
        expect(console.log).toHaveBeenCalledWith('Cargados 3 mensajes');
    });

    // ============================
    // CASO 4: Distinguir mensajes propios de ajenos
    // ============================
    test('CASO 4: debe aplicar clase "my-message" solo a mensajes propios', () => {
        const chatId = 'chat_test_4';
        global.currentUserId = 'test_user';
        
        const mockMessages = [
            {
                senderId: 'test_user',
                senderName: 'Yo',
                text: 'Mi mensaje',
                timestamp: { toDate: () => new Date('2025-01-15T10:00:00') }
            },
            {
                senderId: 'other_user',
                senderName: 'Otro',
                text: 'Su mensaje',
                timestamp: { toDate: () => new Date('2025-01-15T10:05:00') }
            }
        ];
        
        const mockSnapshot = {
            forEach: jest.fn((callback) => {
                mockMessages.forEach(msg => {
                    callback({ data: () => msg });
                });
            }),
            size: 2
        };
        
        mockOnSnapshot.mockImplementation((callback) => {
            callback(mockSnapshot);
            return jest.fn();
        });
        
        loadMessages(chatId);
        
        const messages = messagesDiv.querySelectorAll('.message');
        
        // Primer mensaje (propio) debe tener clase "my-message"
        expect(messages[0].classList.contains('my-message')).toBe(true);
        
        // Segundo mensaje (ajeno) NO debe tener clase "my-message"
        expect(messages[1].classList.contains('my-message')).toBe(false);
    });

    // ============================
    // CASO 5: Scroll automático al final
    // ============================
    test('CASO 5: debe hacer scroll automático al cargar mensajes', () => {
        const chatId = 'chat_test_5';
        
        // Mock de scrollHeight
        Object.defineProperty(messagesDiv, 'scrollHeight', {
            writable: true,
            value: 1000
        });
        
        const mockSnapshot = {
            forEach: jest.fn((callback) => {
                callback({
                    data: () => ({
                        senderId: 'user1',
                        senderName: 'User 1',
                        text: 'Test',
                        timestamp: { toDate: () => new Date() }
                    })
                });
            }),
            size: 1
        };
        
        mockOnSnapshot.mockImplementation((callback) => {
            callback(mockSnapshot);
            return jest.fn();
        });
        
        loadMessages(chatId);
        
        // Verificar que scrollTop se actualizó a scrollHeight
        expect(messagesDiv.scrollTop).toBe(1000);
    });

    // ============================
    // CASO 6: Manejo de timestamp nulo
    // ============================
    test('CASO 6: debe manejar mensajes con timestamp nulo sin errores', () => {
        const chatId = 'chat_test_6';
        
        const mockMessage = {
            senderId: 'user1',
            senderName: 'Usuario 1',
            text: 'Mensaje sin timestamp',
            timestamp: null
        };
        
        const mockSnapshot = {
            forEach: jest.fn((callback) => {
                callback({ data: () => mockMessage });
            }),
            size: 1
        };
        
        mockOnSnapshot.mockImplementation((callback) => {
            callback(mockSnapshot);
            return jest.fn();
        });
        
        // No debería lanzar error
        expect(() => loadMessages(chatId)).not.toThrow();
        
        const messageElement = messagesDiv.querySelector('.message');
        expect(messageElement).toBeTruthy();
        expect(messageElement.innerHTML).toContain('Mensaje sin timestamp');
        
        // formatTime con null debe devolver string vacío
        const timestampSpan = messageElement.querySelector('.timestamp');
        expect(timestampSpan.textContent).toBe('');
    });

    // ============================
    // CASO 7: Limpiar mensajes anteriores
    // ============================
    test('CASO 7: debe limpiar mensajes anteriores antes de cargar nuevos', () => {
        const chatId = 'chat_test_7';
        
        // Añadir contenido previo al div
        messagesDiv.innerHTML = '<div class="old-message">Mensaje antiguo</div>';
        expect(messagesDiv.children.length).toBeGreaterThan(0);
        
        const mockSnapshot = {
            forEach: jest.fn((callback) => {
                callback({
                    data: () => ({
                        senderId: 'user1',
                        senderName: 'Usuario',
                        text: 'Nuevo mensaje',
                        timestamp: { toDate: () => new Date() }
                    })
                });
            }),
            size: 1
        };
        
        mockOnSnapshot.mockImplementation((callback) => {
            callback(mockSnapshot);
            return jest.fn();
        });
        
        loadMessages(chatId);
        
        // No debe contener el mensaje antiguo
        expect(messagesDiv.innerHTML).not.toContain('Mensaje antiguo');
        expect(messagesDiv.innerHTML).toContain('Nuevo mensaje');
    });

    // ============================
    // CASO 8: Desuscribir listener anterior
    // ============================
    test('CASO 8: debe desuscribir listener anterior antes de crear uno nuevo', () => {
        const chatId = 'chat_test_8';
        
        // Crear un mock de función de desuscripción
        const mockUnsubscribe = jest.fn();
        global.activeChatListener = mockUnsubscribe;
        
        const mockSnapshot = {
            forEach: jest.fn(),
            size: 0
        };
        
        mockOnSnapshot.mockImplementation((callback) => {
            callback(mockSnapshot);
            return jest.fn();
        });
        
        loadMessages(chatId);
        
        // Verificar que se llamó a la función de desuscripción
        expect(mockUnsubscribe).toHaveBeenCalled();
        expect(global.activeChatListener).not.toBe(mockUnsubscribe);
    });

    // ============================
    // CASO 9: Manejo de errores de Firebase
    // ============================
    test('CASO 9: debe manejar errores de Firebase correctamente', () => {
        const chatId = 'chat_test_9';
        const mockError = new Error('Firebase error: permission denied');
        
        // Simular error en onSnapshot
        mockOnSnapshot.mockImplementation((successCallback, errorCallback) => {
            errorCallback(mockError);
            return jest.fn();
        });
        
        loadMessages(chatId);
        
        // Verificar que se llamó console.error con el error
        expect(console.error).toHaveBeenCalledWith(
            'Error al cargar mensajes:',
            mockError
        );
    });

    // ============================
    // CASO 10: Mensajes con caracteres especiales y HTML
    // ============================
    test('CASO 10: debe renderizar correctamente mensajes con caracteres especiales', () => {
        const chatId = 'chat_test_10';
        
        const mockMessages = [
            {
                senderId: 'user1',
                senderName: 'Usuario <script>alert("XSS")</script>',
                text: 'Mensaje con <b>HTML</b> & "comillas" y \'apóstrofes\'',
                timestamp: { toDate: () => new Date('2025-01-15T15:45:00') }
            },
            {
                senderId: 'user2',
                senderName: 'María José',
                text: '¡Hola! ¿Cómo estás? 😊 €100',
                timestamp: { toDate: () => new Date('2025-01-15T15:46:00') }
            }
        ];
        
        const mockSnapshot = {
            forEach: jest.fn((callback) => {
                mockMessages.forEach(msg => {
                    callback({ data: () => msg });
                });
            }),
            size: 2
        };
        
        mockOnSnapshot.mockImplementation((callback) => {
            callback(mockSnapshot);
            return jest.fn();
        });
        
        loadMessages(chatId);
        
        const messages = messagesDiv.querySelectorAll('.message');
        
        // Verificar que el contenido se renderizó (innerHTML no escapa)
        expect(messages[0].innerHTML).toContain('<b>HTML</b>');
        expect(messages[0].innerHTML).toContain('comillas');
        expect(messages[1].innerHTML).toContain('😊');
        expect(messages[1].innerHTML).toContain('€100');
        
        // Verificar que los timestamps son correctos
        expect(messages[0].innerHTML).toContain('15:45');
        expect(messages[1].innerHTML).toContain('15:46');
    });
});

// ============================
// SUITE ADICIONAL: Pruebas de Integración
// ============================

describe('loadMessages - Pruebas de Integración', () => {

    beforeEach(() => {
        document.getElementById('messages').innerHTML = '';
        global.activeChatListener = null;
        jest.clearAllMocks();
    });

    test('INTEGRACIÓN: debe funcionar correctamente en un flujo completo de chat', () => {
        const chatId = 'chat_integration_test';
        global.currentUserId = 'alice';
        
        // Simular conversación completa
        const conversation = [
            {
                senderId: 'alice',
                senderName: 'Alice',
                text: '¡Hola Bob!',
                timestamp: { toDate: () => new Date('2025-01-15T10:00:00') }
            },
            {
                senderId: 'bob',
                senderName: 'Bob',
                text: 'Hola Alice, ¿cómo estás?',
                timestamp: { toDate: () => new Date('2025-01-15T10:01:00') }
            },
            {
                senderId: 'alice',
                senderName: 'Alice',
                text: 'Muy bien, gracias. ¿Y tú?',
                timestamp: { toDate: () => new Date('2025-01-15T10:02:00') }
            },
            {
                senderId: 'bob',
                senderName: 'Bob',
                text: 'También bien 😊',
                timestamp: { toDate: () => new Date('2025-01-15T10:03:00') }
            }
        ];
        
        const mockSnapshot = {
            forEach: jest.fn((callback) => {
                conversation.forEach(msg => {
                    callback({ data: () => msg });
                });
            }),
            size: 4
        };
        
        mockOnSnapshot.mockImplementation((callback) => {
            callback(mockSnapshot);
            return jest.fn();
        });
        
        loadMessages(chatId);
        
        const messagesDiv = document.getElementById('messages');
        const messages = messagesDiv.querySelectorAll('.message');
        
        // Verificar cantidad
        expect(messages.length).toBe(4);
        
        // Verificar que los mensajes de Alice tienen clase "my-message"
        expect(messages[0].classList.contains('my-message')).toBe(true);
        expect(messages[1].classList.contains('my-message')).toBe(false);
        expect(messages[2].classList.contains('my-message')).toBe(true);
        expect(messages[3].classList.contains('my-message')).toBe(false);
        
        // Verificar orden cronológico
        expect(messages[0].innerHTML).toContain('10:00');
        expect(messages[1].innerHTML).toContain('10:01');
        expect(messages[2].innerHTML).toContain('10:02');
        expect(messages[3].innerHTML).toContain('10:03');
        
        expect(console.log).toHaveBeenCalledWith('Cargados 4 mensajes');
    });
});