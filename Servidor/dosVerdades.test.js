/*
TESTS PARA dosVerdades.js
*/

//Importamos las funciones necesarias
const {sendDosVerdades, renderDosVerdadesFromMessage, submitGuess} = require('./dosVerdades.js');

//Constantes copiadas desde cuatroEnRayaScript.js
const ROWS = 6;
const COLS = 7;
const EMPTY = 0;
const PLAYER_RED = 1;
const PLAYER_YELLOW = 2;

//sendDosVerdades
describe('sendDosVerdades - Validaciones y envío de Dos Verdades', () => {
    test('Valida que las tres frases estén rellenas', async () => {
        document.body.innerHTML = `
            <div id="chat-screen"></div>
            <div id="messages"></div>
            <div id="input-area">
                <button id="open-dosverdades-btn">🤥</button>
            </div>
        `;

        global.currentChatId = 'chat_test';
        global.currentUserId = 'usuarioA';
        global.currentUserName = 'Usuario A';
        global.alert = jest.fn();

        require('./dosVerdades.js');
        document.dispatchEvent(new Event('DOMContentLoaded'));
        
        document.getElementById('open-dosverdades-btn').click();
        document.getElementById('dv-send-btn').click();

        const err = document.getElementById('dv-error');
        
        expect(err.textContent).toBe('Por favor rellena las tres frases.');
    });

    test('Valida que se marque la mentira', async () => {
        document.body.innerHTML = `
            <div id="chat-screen"></div>
            <div id="messages"></div>
            <div id="input-area">
                <button id="open-dosverdades-btn">🤥</button>
            </div>
        `;

        global.currentChatId = 'chat_test';
        global.currentUserId = 'usuarioA';
        global.currentUserName = 'Usuario A';
        global.alert = jest.fn();

        require('./dosVerdades.js');
        document.dispatchEvent(new Event('DOMContentLoaded'));
        document.getElementById('open-dosverdades-btn').click();

        document.getElementById('dv-phrase-0').value = 'Frase uno';
        document.getElementById('dv-phrase-1').value = 'Frase dos';
        document.getElementById('dv-phrase-2').value = 'Frase tres';

        document.getElementById('dv-send-btn').click();

        const err = document.getElementById('dv-error');
        
        expect(err.textContent).toBe('Marca cuál de las frases es la mentira.');
    });

    test('Envío correcto llama a Firestore y cierra modal', async () => {
        document.body.innerHTML = `
            <div id="chat-screen"></div>
            <div id="messages"></div>
            <div id="input-area">
                <button id="open-dosverdades-btn">🤥</button>
            </div>
        `;

        global.currentChatId = 'chat_test';
        global.currentUserId = 'usuarioA';
        global.currentUserName = 'Usuario A';
        global.alert = jest.fn();

        const spyAdd = jest.fn().mockResolvedValue({});
        global.db.collection = jest.fn(() => ({
            doc: jest.fn(() => ({
                collection: jest.fn(() => ({
                    add: spyAdd
                }))
            }))
        }));

        require('./dosVerdades.js');
        document.dispatchEvent(new Event('DOMContentLoaded'));
        document.getElementById('open-dosverdades-btn').click();

        document.getElementById('dv-phrase-0').value = 'Soy alérgico al polen';
        document.getElementById('dv-phrase-1').value = 'He saltado en paracaídas';
        document.getElementById('dv-phrase-2').value = 'Nunca he comido chocolate';

        const radios = document.querySelectorAll('input[name="dv-lie"]');
        radios[1].checked = true;

        document.getElementById('dv-send-btn').click();

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(spyAdd).toHaveBeenCalled();
        
        const llamadoCon = spyAdd.mock.calls[0][0];
        
        expect(llamadoCon.phrases).toEqual([
            'Soy alérgico al polen',
            'He saltado en paracaídas',
            'Nunca he comido chocolate'
        ]);
        expect(llamadoCon.lieIndex).toBe(1);

        const modal = document.getElementById('dosverdades-modal');
        
        expect(modal.style.display).toBe('none');
    });
});

//renderDosVerdadesFromMessage
describe('renderDosVerdadesFromMessage - Renderizado de mensajes', () => {
    test('Mensaje procesado muestra resumen con highlights', () => {
        document.body.innerHTML = `<div id="messages"></div>`;

        global.currentUserId = 'usuarioA';
        global.currentUserName = 'Usuario A';

        require('./dosVerdades.js');

        const el = document.createElement('div');
        const mensajeProcesado = {
            senderId: 'usuarioB',
            senderName: 'Usuario B',
            processed: true,
            phrases: ['A <b>peligro</b>', 'B & prueba', 'C ok'],
            lieIndex: 2,
            guessIndex: 1,
            correct: false,
            guesserName: 'Usuario A'
        };

        window.renderDosVerdadesFromMessage(el, mensajeProcesado, 'msg123');

        expect(el.innerHTML).toContain('Dos Verdades y Una Mentira · Resultado');
        expect(el.innerHTML).toContain('dv-correct');
        expect(el.innerHTML).toContain('dv-wrong');
    });

    test('Receptor recibe botones interactivos', () => {
        document.body.innerHTML = `<div id="messages"></div>`;

        global.currentUserId = 'usuarioA';
        global.currentUserName = 'Usuario A';

        require('./dosVerdades.js');

        const elemento = document.createElement('div');
        const mensaje = {
            senderId: 'usuarioB',
            senderName: 'Usuario B',
            processed: false,
            phrases: ['Primera', 'Segunda', 'Tercera'],
            lieIndex: 1
        };

        window.renderDosVerdadesFromMessage(elemento, mensaje, 'msgid-1');

        const botones = elemento.querySelectorAll('.dv-choose');
        
        expect(botones.length).toBe(3);
    });
});

//submitGuess
describe('submitGuess - Responder al juego', () => {
    test('Llama a runTransaction y añade mensaje sistema', async () => {
        document.body.innerHTML = `<div id="messages"></div>`;

        global.currentUserId = 'usuarioA';
        global.currentUserName = 'Usuario A';
        global.currentChatId = 'chat_test';
        global.alert = jest.fn();

        const spySystemAdd = jest.fn().mockResolvedValue({});
        const runTransactionImpl = async (fn) => {
            await fn({
                get: async () => ({ exists: true, data: () => ({ lieIndex: 1, processed: false }) }),
                update: jest.fn()
            });
        };

        const mockMsgRef = {
            get: jest.fn()
                .mockResolvedValueOnce({ exists: true, data: () => ({ lieIndex: 1, processed: false }) })
                .mockResolvedValueOnce({ data: () => ({ correct: true, lieIndex: 1, guessIndex: 1 }) }),
            update: jest.fn()
        };

        global.db.collection = jest.fn(() => ({
            doc: jest.fn(() => ({
                collection: jest.fn(() => ({
                    add: spySystemAdd,
                    doc: jest.fn(() => mockMsgRef)
                })),
                update: jest.fn()
            }))
        }));
        global.db.runTransaction = jest.fn(runTransactionImpl);

        require('./dosVerdades.js');

        const mensaje = {
            senderId: 'usuarioB',
            senderName: 'Usuario B',
            processed: false,
            phrases: ['Primera', 'Segunda', 'Tercera'],
            lieIndex: 1
        };

        const elemento = document.createElement('div');
        document.body.appendChild(elemento);

        window.renderDosVerdadesFromMessage(elemento, mensaje, 'msgid-1');

        const botones = elemento.querySelectorAll('.dv-choose');
        botones[1].click();

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(global.db.runTransaction).toHaveBeenCalled();
        expect(spySystemAdd).toHaveBeenCalled();
    });
});