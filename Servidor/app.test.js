/**
 * Pruebas unitarias para app.js - Función generateChatId
 * Framework: Jest con jsdom
 */

// ============================
// PASO 1: CONFIGURAR MOCKS ANTES DE IMPORTAR
// ============================

// Mock de Firebase (DEBE IR ANTES de require('./app.js'))
global.firebase = {
    initializeApp: jest.fn(),
    firestore: jest.fn(() => ({
        collection: jest.fn(() => ({
            doc: jest.fn(() => ({
                get: jest.fn(() => Promise.resolve({ exists: false })),
                set: jest.fn(() => Promise.resolve()),
                update: jest.fn(() => Promise.resolve()),
                collection: jest.fn()
            })),
            where: jest.fn(() => ({
                get: jest.fn(() => Promise.resolve({ empty: true, docs: [] })),
                orderBy: jest.fn(() => ({
                    onSnapshot: jest.fn()
                }))
            })),
            add: jest.fn()
        })),
        FieldValue: {
            serverTimestamp: jest.fn(() => 'MOCK_TIMESTAMP')
        }
    })),
    storage: jest.fn(() => ({
        ref: jest.fn(() => ({
            put: jest.fn(() => Promise.resolve()),
            getDownloadURL: jest.fn(() => Promise.resolve('https://mock.com/photo.jpg'))
        }))
    }))
};

// Variables globales que usa app.js
global.db = global.firebase.firestore();
global.storage = global.firebase.storage();

// Mock de console para evitar spam
global.console = {
    ...console,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
};

// Mock de DOM mínimo requerido
document.body.innerHTML = `
    <div id="chat-screen" style="display: none;"></div>
    <button id="openChatBtn"></button>
    <div id="messages"></div>
    <input id="message-input" />
    <button id="send-btn"></button>
    <div id="chat-title"></div>
    <div id="user-info"></div>
    <div id="login-screen"></div>
    <div id="register-screen"></div>
    <div id="chat-list"></div>
    <div id="no-chats-message"></div>
    <div id="login-error"></div>
    <div id="register-error"></div>
    <div id="register-name"></div>
    <div id="profile-photo"></div>
    <div id="photo-preview"></div>
    <div id="interests"></div>
    <div id="age"></div>
`;

// ============================
// PASO 2: IMPORTAR EL MÓDULO
// ============================

// Importar todas las funciones exportadas
const appModule = require('./app.js');

// Extraer la función que necesitamos
const { generateChatId } = appModule;

// ============================
// PASO 3: VERIFICAR QUE LA FUNCIÓN EXISTE
// ============================

if (typeof generateChatId !== 'function') {
    throw new Error('ERROR: generateChatId no se importó correctamente. Verifica las exportaciones en app.js');
}

// ============================
// SUITE DE PRUEBAS: generateChatId
// ============================

describe('generateChatId - Generación de ID único de chat', () => {

    // ============================
    // CASO 1: Orden consistente
    // ============================
    test('CASO 1: debe generar el mismo ID independientemente del orden de los usuarios', () => {
        const userId1 = 'maria';
        const userId2 = 'juan';

        // Generar ID en ambos órdenes
        const chatId1 = generateChatId(userId1, userId2);
        const chatId2 = generateChatId(userId2, userId1);

        // Verificaciones
        expect(chatId1).toBe(chatId2);
        expect(chatId1).toBe('juan_maria');
        expect(chatId2).toBe('juan_maria');
    });

    // ============================
    // CASO 2: Ordenamiento alfabético
    // ============================
    test('CASO 2: debe ordenar los IDs alfabéticamente y unirlos con guión bajo', () => {
        // IDs ya en orden alfabético
        expect(generateChatId('alice', 'bob')).toBe('alice_bob');

        // IDs en orden inverso
        expect(generateChatId('zara', 'ana')).toBe('ana_zara');

        // IDs con números
        expect(generateChatId('user2', 'user1')).toBe('user1_user2');

        // IDs con mayúsculas/minúsculas
        expect(generateChatId('Juan', 'Ana')).toBe('Ana_Juan');
    });

    // ============================
    // CASO 3: IDs idénticos
    // ============================
    test('CASO 3: debe manejar correctamente cuando ambos IDs son iguales', () => {
        const userId = 'usuario_test';

        const chatId = generateChatId(userId, userId);

        // Debe contener el ID dos veces
        expect(chatId).toBe('usuario_test_usuario_test');
        expect(chatId).toContain('_');

        // Verificar que contiene el ID original
        expect(chatId).toContain('usuario_test');
    });

    // ============================
    // CASOS ADICIONALES: Cobertura extra
    // ============================

    test('CASO EXTRA 1: debe manejar IDs con caracteres especiales', () => {
        expect(generateChatId('user-1', 'user-2')).toBe('user-1_user-2');
        expect(generateChatId('user_a', 'user_b')).toBe('user_a_user_b');
    });

    test('CASO EXTRA 2: debe manejar IDs vacíos', () => {
        const result = generateChatId('', 'user');
        expect(result).toBe('_user');
    });

    test('CASO EXTRA 3: debe ser una función pura (sin efectos secundarios)', () => {
        const id1 = 'alice';
        const id2 = 'bob';

        // Llamar múltiples veces debe dar el mismo resultado
        const result1 = generateChatId(id1, id2);
        const result2 = generateChatId(id1, id2);
        const result3 = generateChatId(id1, id2);

        expect(result1).toBe(result2);
        expect(result2).toBe(result3);
    });
});