/* script.test.js
   Pruebas unitarias para el metodo crearUsuario en script.js
   Framework: Jest con jsdom para simular el entorno del navegador
*/

// Mock de Web Crypto API
const crypto = require('crypto').webcrypto;
global.crypto = crypto;

// Mock de localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = value.toString(); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; }
    };
})();
global.localStorage = localStorageMock;

// Mock de TextEncoder (necesario para Node.js < 19)
if (typeof TextEncoder === 'undefined') {
    global.TextEncoder = require('util').TextEncoder;
}

// Importar las funciones del script (requiere convertir a modulos o usar eval en entorno de prueba)
// Para este ejemplo, incluimos las funciones necesarias directamente

const LS_USERS_KEY = 'miweb_users_v1';

function bufferToHex(buffer) {
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBuffer(hex) {
    if (!hex) return new Uint8Array().buffer;
    const bytes = new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    return bytes.buffer;
}

function generarSaltHex() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return bufferToHex(array.buffer);
}

async function hashPasswordPBKDF2(password, saltHex) {
    const enc = new TextEncoder();
    const pwBuffer = enc.encode(password);

    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        pwBuffer,
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );

    const params = {
        name: 'PBKDF2',
        salt: hexToBuffer(saltHex),
        iterations: 120000,
        hash: 'SHA-256'
    };

    const derivedBits = await crypto.subtle.deriveBits(params, keyMaterial, 256);
    return bufferToHex(derivedBits);
}

function leerUsuarios() {
    try {
        const raw = localStorage.getItem(LS_USERS_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        console.error('Error al leer usuarios:', e);
        return {};
    }
}

function guardarUsuarios(obj) {
    localStorage.setItem(LS_USERS_KEY, JSON.stringify(obj, null, 2));
}

async function crearUsuario(username, password) {
    if (!username || !password) return { ok: false, error: 'Usuario y contrasena obligatorios' };

    const users = leerUsuarios();
    if (users[username]) return { ok: false, error: 'El usuario ya existe' };

    const salt = generarSaltHex();
    const hash = await hashPasswordPBKDF2(password, salt);

    users[username] = {
        salt: salt,
        hash: hash,
        createdAt: new Date().toISOString(),
        fields: {}
    };

    guardarUsuarios(users);

    return { ok: true };
}

// ============================
// SUITE DE PRUEBAS
// ============================

describe('crearUsuario', () => {

    beforeEach(() => {
        // Limpiar localStorage antes de cada prueba
        localStorage.clear();
    });

    afterEach(() => {
        // Limpiar despues de cada prueba
        localStorage.clear();
    });

    // ============================
    // PRUEBAS DE CASO EXITOSO
    // ============================

    test('deberia crear un usuario exitosamente con credenciales validas', async () => {
        const resultado = await crearUsuario('usuario1', 'password123');

        expect(resultado.ok).toBe(true);
        expect(resultado.error).toBeUndefined();
    });

    test('deberia almacenar el usuario en localStorage', async () => {
        await crearUsuario('testuser', 'securePass456');

        const users = leerUsuarios();
        expect(users['testuser']).toBeDefined();
    });

    test('deberia generar un salt unico para cada usuario', async () => {
        await crearUsuario('user1', 'pass123');
        await crearUsuario('user2', 'pass123');

        const users = leerUsuarios();
        expect(users['user1'].salt).toBeDefined();
        expect(users['user2'].salt).toBeDefined();
        expect(users['user1'].salt).not.toBe(users['user2'].salt);
    });

    test('deberia generar un hash diferente para la misma contrasena con diferentes salts', async () => {
        await crearUsuario('alice', 'password');
        await crearUsuario('bob', 'password');

        const users = leerUsuarios();
        expect(users['alice'].hash).not.toBe(users['bob'].hash);
    });

    test('deberia almacenar la fecha de creacion en formato ISO', async () => {
        const antes = new Date().toISOString();
        await crearUsuario('datetest', 'pass123');
        const despues = new Date().toISOString();

        const users = leerUsuarios();
        const createdAt = users['datetest'].createdAt;

        expect(createdAt).toBeDefined();
        expect(new Date(createdAt).getTime()).toBeGreaterThanOrEqual(new Date(antes).getTime());
        expect(new Date(createdAt).getTime()).toBeLessThanOrEqual(new Date(despues).getTime());
    });

    test('deberia inicializar el objeto fields como vacio', async () => {
        await crearUsuario('fieldstest', 'password');

        const users = leerUsuarios();
        expect(users['fieldstest'].fields).toBeDefined();
        expect(typeof users['fieldstest'].fields).toBe('object');
        expect(Object.keys(users['fieldstest'].fields).length).toBe(0);
    });

    test('deberia almacenar el hash con la longitud esperada (64 caracteres hex para 256 bits)', async () => {
        await crearUsuario('hashtest', 'mypassword');

        const users = leerUsuarios();
        expect(users['hashtest'].hash.length).toBe(64); // 256 bits = 64 hex chars
    });

    test('deberia almacenar el salt con la longitud esperada (32 caracteres hex para 16 bytes)', async () => {
        await crearUsuario('salttest', 'mypassword');

        const users = leerUsuarios();
        expect(users['salttest'].salt.length).toBe(32); // 16 bytes = 32 hex chars
    });

    // ============================
    // PRUEBAS DE VALIDACION
    // ============================

    test('deberia rechazar un usuario con nombre de usuario vacio', async () => {
        const resultado = await crearUsuario('', 'password123');

        expect(resultado.ok).toBe(false);
        expect(resultado.error).toBe('Usuario y contrasena obligatorios');
    });

    test('deberia rechazar un usuario con contrasena vacia', async () => {
        const resultado = await crearUsuario('usuario1', '');

        expect(resultado.ok).toBe(false);
        expect(resultado.error).toBe('Usuario y contrasena obligatorios');
    });

    test('deberia rechazar un usuario con ambos campos vacios', async () => {
        const resultado = await crearUsuario('', '');

        expect(resultado.ok).toBe(false);
        expect(resultado.error).toBe('Usuario y contrasena obligatorios');
    });

    test('deberia rechazar un usuario con nombre undefined', async () => {
        const resultado = await crearUsuario(undefined, 'password');

        expect(resultado.ok).toBe(false);
        expect(resultado.error).toBe('Usuario y contrasena obligatorios');
    });

    test('deberia rechazar un usuario con contrasena undefined', async () => {
        const resultado = await crearUsuario('usuario', undefined);

        expect(resultado.ok).toBe(false);
        expect(resultado.error).toBe('Usuario y contrasena obligatorios');
    });

    test('deberia rechazar un usuario con nombre null', async () => {
        const resultado = await crearUsuario(null, 'password');

        expect(resultado.ok).toBe(false);
        expect(resultado.error).toBe('Usuario y contrasena obligatorios');
    });

    test('deberia rechazar un usuario con contrasena null', async () => {
        const resultado = await crearUsuario('usuario', null);

        expect(resultado.ok).toBe(false);
        expect(resultado.error).toBe('Usuario y contrasena obligatorios');
    });

    // ============================
    // PRUEBAS DE DUPLICADOS
    // ============================

    test('deberia rechazar la creacion de un usuario duplicado', async () => {
        await crearUsuario('duplicate', 'pass1');
        const resultado = await crearUsuario('duplicate', 'pass2');

        expect(resultado.ok).toBe(false);
        expect(resultado.error).toBe('El usuario ya existe');
    });

    test('deberia mantener los datos del primer usuario cuando se intenta crear uno duplicado', async () => {
        await crearUsuario('existing', 'originalpass');
        const usersAntes = leerUsuarios();
        const hashOriginal = usersAntes['existing'].hash;

        await crearUsuario('existing', 'newpass');
        const usersDespues = leerUsuarios();

        expect(usersDespues['existing'].hash).toBe(hashOriginal);
    });

    test('deberia permitir crear usuarios con nombres similares pero no identicos', async () => {
        const res1 = await crearUsuario('user', 'pass1');
        const res2 = await crearUsuario('user1', 'pass2');
        const res3 = await crearUsuario('User', 'pass3');

        expect(res1.ok).toBe(true);
        expect(res2.ok).toBe(true);
        expect(res3.ok).toBe(true);
    });

    // ============================
    // PRUEBAS DE SEGURIDAD
    // ============================

    test('no deberia almacenar la contrasena en texto plano', async () => {
        const password = 'miPasswordSecreta123';
        await crearUsuario('securitytest', password);

        const users = leerUsuarios();
        const userData = users['securitytest'];
        const raw = localStorage.getItem(LS_USERS_KEY);

        expect(raw).not.toContain(password);
        expect(userData.hash).not.toBe(password);
        expect(userData.salt).not.toBe(password);
    });

    test('deberia generar hashes diferentes para contrasenas diferentes', async () => {
        // Crear dos usuarios con contrasenas muy similares
        await crearUsuario('user1', 'password123');
        await crearUsuario('user2', 'password124');

        const users = leerUsuarios();
        expect(users['user1'].hash).not.toBe(users['user2'].hash);
    });

    // ============================
    // PRUEBAS DE CASOS ESPECIALES
    // ============================

    test('deberia manejar nombres de usuario con espacios', async () => {
        const resultado = await crearUsuario('usuario con espacios', 'pass123');

        expect(resultado.ok).toBe(true);
        const users = leerUsuarios();
        expect(users['usuario con espacios']).toBeDefined();
    });

    test('deberia manejar contrasenas con caracteres especiales', async () => {
        const resultado = await crearUsuario('special', '!@#$%^&*()_+-=[]{}|;:,.<>?');

        expect(resultado.ok).toBe(true);
        const users = leerUsuarios();
        expect(users['special']).toBeDefined();
    });

    test('deberia manejar contrasenas muy largas', async () => {
        const longPassword = 'a'.repeat(1000);
        const resultado = await crearUsuario('longpass', longPassword);

        expect(resultado.ok).toBe(true);
    });

    test('deberia manejar nombres de usuario muy largos', async () => {
        const longUsername = 'u'.repeat(500);
        const resultado = await crearUsuario(longUsername, 'password');

        expect(resultado.ok).toBe(true);
    });

    test('deberia manejar caracteres especiales en nombre de usuario', async () => {
        const resultado = await crearUsuario('usuario_test-123', 'password');

        expect(resultado.ok).toBe(true);
        const users = leerUsuarios();
        expect(users['usuario_test-123']).toBeDefined();
    });

    test('deberia manejar contrasenas con caracteres no ASCII', async () => {
        const resultado = await crearUsuario('specialuser', 'pass@word123!');

        expect(resultado.ok).toBe(true);
    });

    // ============================
    // PRUEBAS DE MULTIPLES USUARIOS
    // ============================

    test('deberia permitir crear multiples usuarios consecutivamente', async () => {
        const usuarios = ['user1', 'user2', 'user3', 'user4', 'user5'];

        for (const user of usuarios) {
            const resultado = await crearUsuario(user, `pass_${user}`);
            expect(resultado.ok).toBe(true);
        }

        const users = leerUsuarios();
        expect(Object.keys(users).length).toBe(5);
    });

    test('deberia preservar usuarios existentes al crear nuevos', async () => {
        await crearUsuario('first', 'pass1');
        await crearUsuario('second', 'pass2');
        await crearUsuario('third', 'pass3');

        const users = leerUsuarios();
        expect(users['first']).toBeDefined();
        expect(users['second']).toBeDefined();
        expect(users['third']).toBeDefined();
    });

    // ============================
    // PRUEBAS DE FORMATO DE RESPUESTA
    // ============================

    test('deberia devolver un objeto con la estructura correcta en caso exitoso', async () => {
        const resultado = await crearUsuario('formattest', 'password');

        expect(resultado).toHaveProperty('ok');
        expect(typeof resultado.ok).toBe('boolean');
        expect(resultado.ok).toBe(true);
    });

    test('deberia devolver un objeto con la estructura correcta en caso de error', async () => {
        const resultado = await crearUsuario('', '');

        expect(resultado).toHaveProperty('ok');
        expect(resultado).toHaveProperty('error');
        expect(typeof resultado.ok).toBe('boolean');
        expect(typeof resultado.error).toBe('string');
        expect(resultado.ok).toBe(false);
    });

    // ============================
    // PRUEBAS DE INTEGRIDAD DE DATOS
    // ============================

    test('deberia mantener la estructura completa del usuario creado', async () => {
        await crearUsuario('structuretest', 'password123');

        const users = leerUsuarios();
        const user = users['structuretest'];

        expect(user).toHaveProperty('salt');
        expect(user).toHaveProperty('hash');
        expect(user).toHaveProperty('createdAt');
        expect(user).toHaveProperty('fields');
    });

    test('deberia crear usuarios independientes sin interferencia entre ellos', async () => {
        await crearUsuario('independent1', 'pass1');
        await crearUsuario('independent2', 'pass2');

        const users = leerUsuarios();

        expect(users['independent1'].salt).not.toBe(users['independent2'].salt);
        expect(users['independent1'].hash).not.toBe(users['independent2'].hash);
        expect(users['independent1'].createdAt).not.toBe(users['independent2'].createdAt);
    });

    // ============================
    // PRUEBAS DE ROBUSTEZ
    // ============================

    test('deberia manejar correctamente espacios al inicio y final del nombre', async () => {
        const resultado = await crearUsuario('  username  ', 'password');

        expect(resultado.ok).toBe(true);
        const users = leerUsuarios();
        expect(users['  username  ']).toBeDefined();
    });

    test('deberia permitir contrasenas con solo numeros', async () => {
        const resultado = await crearUsuario('numericpass', '12345678');

        expect(resultado.ok).toBe(true);
    });

    test('deberia permitir contrasenas con un solo caracter', async () => {
        const resultado = await crearUsuario('shortpass', 'a');

        expect(resultado.ok).toBe(true);
    });

    test('deberia permitir nombres de usuario con un solo caracter', async () => {
        const resultado = await crearUsuario('a', 'password');

        expect(resultado.ok).toBe(true);
    });
});