/*
TESTS PARA cuatroEnRayaScript.js

Funciones testeadas:

*/

//Importamos las funciones necesarias
const { flatTo2D, board2DToFlat, checkWin, checkTie } = require('./cuatroEnRayaScript.js');

//Constantes copiadas desde cuatroEnRayaScript.js
const ROWS = 6;
const COLS = 7;
const EMPTY = 0;
const PLAYER_RED = 1;
const PLAYER_YELLOW = 2;

//flatoTo2D
describe('flatTo2D - Convierte array plano en matriz bidimensional', () => {
    test('Tablero vacio', () => {
        const tabla = new Array(ROWS * COLS).fill(EMPTY);

        const resultado = flatTo2D(tabla);

        expect(resultado).toHaveLength(ROWS); 
        expect(resultado[0]).toHaveLength(COLS); 
        for (let i = 0; i < ROWS; i++) {
            for (let j = 0; j < COLS; j++) {
                expect(resultado[i][j]).toBe(EMPTY);
            }
        }
    });

    test('Tablero con fichas rojas y amarillas aleatorias', () => {
        const tabla = new Array(ROWS * COLS).fill(EMPTY);
        tabla[0] = PLAYER_RED;
        tabla[9] = PLAYER_YELLOW;
        tabla[20] = PLAYER_RED;
        tabla[41] = PLAYER_YELLOW;

        const resultado = flatTo2D(tabla);

        expect(resultado[0][0]).toBe(PLAYER_RED); 
        expect(resultado[1][2]).toBe(PLAYER_YELLOW);
        expect(resultado[2][6]).toBe(PLAYER_RED);
        expect(resultado[5][6]).toBe(PLAYER_YELLOW);
    });

    test('Tablero lleno', () => {
        const tabla = new Array(ROWS * COLS).fill(PLAYER_RED);

        const resultado = flatTo2D(tabla);

        for (let i = 0; i < ROWS; i++) 
            for (let j = 0; j < COLS; j++) 
                expect(resultado[i][j]).toBe(PLAYER_RED);
    });
});

//board2DToFlat
describe('board2DToFlat - Convierte matriz bidimensional en array plano', () => {
    test('Tablero vacio', () => {
        const tabla = Array.from({ length: ROWS }, () => new Array(COLS).fill(EMPTY));

        const resultado = board2DToFlat(tabla);

        expect(resultado).toHaveLength(ROWS * COLS);
        for (let i = 0; i < ROWS * COLS; i++) {
            expect(resultado[i]).toBe(EMPTY);
        }
    });

    test('Tablero con fichas rojas y amarillas aleatorias', () => {
        const tabla = Array.from({ length: ROWS }, () => new Array(COLS).fill(EMPTY));
        tabla[0][0] = PLAYER_RED;
        tabla[1][2] = PLAYER_YELLOW;
        tabla[2][6] = PLAYER_RED;
        tabla[5][6] = PLAYER_YELLOW;

        const resultado = board2DToFlat(tabla);

        expect(resultado[0]).toBe(PLAYER_RED);
        expect(resultado[9]).toBe(PLAYER_YELLOW);
        expect(resultado[20]).toBe(PLAYER_RED);
        expect(resultado[41]).toBe(PLAYER_YELLOW);
    });

    test('Tablero lleno', () => {
        const tabla = Array.from({ length: ROWS }, () => new Array(COLS).fill(PLAYER_RED));

        const resultado = board2DToFlat(tabla);

        for (let i = 0; i < ROWS * COLS; i++)
                expect(resultado[i]).toBe(PLAYER_RED);
    });
});

//checkWin
describe('checkWin - Verifica si hay cuatro en línea', () => {
    test('Victoria horizontal con ficha en el extremo derecho', () => {
        const tabla = Array.from({ length: ROWS }, () => new Array(COLS).fill(EMPTY));
        tabla[5][0] = PLAYER_RED;
        tabla[5][1] = PLAYER_RED;
        tabla[5][2] = PLAYER_RED;
        tabla[5][3] = PLAYER_RED;

        const resultado = checkWin(tabla, 5, 3);

        expect(resultado).toBe(true);
    });

    test('Victoria horizontal con ficha en el medio', () => {
        const tabla = Array.from({ length: ROWS }, () => new Array(COLS).fill(EMPTY));
        tabla[5][2] = PLAYER_RED;
        tabla[5][3] = PLAYER_RED;
        tabla[5][4] = PLAYER_RED;
        tabla[5][5] = PLAYER_RED;

        const resultado = checkWin(tabla, 5, 3);

        expect(resultado).toBe(true);
    });

    test('Victoria horizontal con exactamente 4 fichas entre otras del rival', () => {
        const tabla = Array.from({ length: ROWS }, () => new Array(COLS).fill(EMPTY));
        tabla[5][0] = PLAYER_YELLOW;
        tabla[5][1] = PLAYER_RED;
        tabla[5][2] = PLAYER_RED;
        tabla[5][3] = PLAYER_RED;
        tabla[5][4] = PLAYER_RED;
        tabla[5][5] = PLAYER_YELLOW;

        const resultado = checkWin(tabla, 5, 2);

        expect(resultado).toBe(true);
    });

    test('Victoria vertical', () => {
        const tabla = Array.from({ length: ROWS }, () => new Array(COLS).fill(EMPTY));
        tabla[2][3] = PLAYER_RED;
        tabla[3][3] = PLAYER_RED;
        tabla[4][3] = PLAYER_RED;
        tabla[5][3] = PLAYER_RED;

        const resultado = checkWin(tabla, 3, 3);

        expect(resultado).toBe(true);
    });

    test('Victoria diagonal derecha con ficha en el extremo inferior', () => {
        const tabla = Array.from({ length: ROWS }, () => new Array(COLS).fill(EMPTY));
        tabla[2][0] = PLAYER_RED;
        tabla[3][1] = PLAYER_RED;
        tabla[4][2] = PLAYER_RED;
        tabla[5][3] = PLAYER_RED;

        const resultado = checkWin(tabla, 5, 3);

        expect(resultado).toBe(true);
    });

    test('Victoria diagonal derecha con ficha en el medio', () => {
        const tabla = Array.from({ length: ROWS }, () => new Array(COLS).fill(EMPTY));
        tabla[2][2] = PLAYER_RED;
        tabla[3][3] = PLAYER_RED;
        tabla[4][4] = PLAYER_RED;
        tabla[5][5] = PLAYER_RED;

        const resultado = checkWin(tabla, 3, 3);

        expect(resultado).toBe(true);
    });

    test('Victoria diagonal izquierda con ficha en el extremo inferior', () => {
        const tabla = Array.from({ length: ROWS }, () => new Array(COLS).fill(EMPTY));
        tabla[2][6] = PLAYER_RED;
        tabla[3][5] = PLAYER_RED;
        tabla[4][4] = PLAYER_RED;
        tabla[5][3] = PLAYER_RED;

        const resultado = checkWin(tabla, 5, 3);

        expect(resultado).toBe(true);
    });

    test('Victoria diagonal izquierda con ficha en el medio', () => {
        const tabla = Array.from({ length: ROWS }, () => new Array(COLS).fill(EMPTY));
        tabla[2][5] = PLAYER_RED;
        tabla[3][4] = PLAYER_RED;
        tabla[4][3] = PLAYER_RED;
        tabla[5][2] = PLAYER_RED;

        const resultado = checkWin(tabla, 3, 4);

        expect(resultado).toBe(true);
    });

    test('Victoria con horizontal y diagonal simultáneas', () => {
        const tabla = Array.from({ length: ROWS }, () => new Array(COLS).fill(EMPTY));
        tabla[5][1] = PLAYER_RED;
        tabla[5][2] = PLAYER_RED;
        tabla[5][3] = PLAYER_RED;
        tabla[5][4] = PLAYER_RED;
        tabla[2][0] = PLAYER_RED;
        tabla[3][1] = PLAYER_RED;
        tabla[4][2] = PLAYER_RED;

        const resultado = checkWin(tabla, 5, 3);

        expect(resultado).toBe(true);
    });

    test('Victoria con vertical y diagonal simultáneas', () => {
        const tabla = Array.from({ length: ROWS }, () => new Array(COLS).fill(EMPTY));
        tabla[2][3] = PLAYER_RED;
        tabla[3][3] = PLAYER_RED;
        tabla[4][3] = PLAYER_RED;
        tabla[5][3] = PLAYER_RED;
        tabla[2][0] = PLAYER_RED;
        tabla[3][1] = PLAYER_RED;
        tabla[4][2] = PLAYER_RED;

        const resultado = checkWin(tabla, 3, 3);

        expect(resultado).toBe(true);
    });

    test('Victoria con vertical y horizontal simultáneas', () => {
        const tabla = Array.from({ length: ROWS }, () => new Array(COLS).fill(EMPTY));
        tabla[2][3] = PLAYER_RED;
        tabla[3][3] = PLAYER_RED;
        tabla[4][3] = PLAYER_RED;
        tabla[5][3] = PLAYER_RED;
        tabla[5][2] = PLAYER_RED;
        tabla[5][4] = PLAYER_RED;
        tabla[5][5] = PLAYER_RED;

        const resultado = checkWin(tabla, 5, 3);

        expect(resultado).toBe(true);
    });

    test('No hay victoria con solo tres fichas horizontales', () => {
        const tabla = Array.from({ length: ROWS }, () => new Array(COLS).fill(EMPTY));
        tabla[5][0] = PLAYER_RED;
        tabla[5][1] = PLAYER_RED;
        tabla[5][2] = PLAYER_RED;

        const resultado = checkWin(tabla, 5, 2);

        expect(resultado).toBe(false);
    });

    test('No hay victoria con fichas interrumpidas por rival', () => {
        const tabla = Array.from({ length: ROWS }, () => new Array(COLS).fill(EMPTY));
        tabla[5][0] = PLAYER_RED;
        tabla[5][1] = PLAYER_RED;
        tabla[5][2] = PLAYER_YELLOW;
        tabla[5][3] = PLAYER_RED;
        tabla[5][4] = PLAYER_RED;

        const resultado = checkWin(tabla, 5, 4);

        expect(resultado).toBe(false);
    });

    test('No hay victoria en tablero vacío', () => {
        const tabla = Array.from({ length: ROWS }, () => new Array(COLS).fill(EMPTY));

        const resultado = checkWin(tabla, 3, 3);

        expect(resultado).toBe(false);
    });

    test('No hay victoria con cuatro fichas en forma de L', () => {
        const tabla = Array.from({ length: ROWS }, () => new Array(COLS).fill(EMPTY));
        tabla[5][0] = PLAYER_RED;
        tabla[5][1] = PLAYER_RED;
        tabla[5][2] = PLAYER_RED;
        tabla[4][2] = PLAYER_RED;

        const resultado = checkWin(tabla, 4, 2);

        expect(resultado).toBe(false);
    });
});

//checkTie
describe('checkTie - Verifica si hay empate', () => {
    test('Hay empate con tablero completamente lleno', () => {
        const tabla = Array.from({ length: ROWS }, () => new Array(COLS).fill(PLAYER_RED));

        const resultado = checkTie(tabla);

        expect(resultado).toBe(true);
    });

    test('Hay empate con tablero lleno alternando colores', () => {
        const tabla = Array.from({ length: ROWS }, (_, row) =>
            Array.from({ length: COLS }, (_, col) =>
                (row + col) % 2 === 0 ? PLAYER_RED : PLAYER_YELLOW
            )
        );

        const resultado = checkTie(tabla);

        expect(resultado).toBe(true);
    });

    test('No hay empate con tablero vacío', () => {
        const tabla = Array.from({ length: ROWS }, () => new Array(COLS).fill(EMPTY));

        const resultado = checkTie(tabla);

        expect(resultado).toBe(false);
    });

    test('No hay empate con tablero medio lleno', () => {
        const tabla = Array.from({ length: ROWS }, () => new Array(COLS).fill(EMPTY));
        tabla[5][0] = PLAYER_RED;
        tabla[5][1] = PLAYER_YELLOW;
        tabla[5][2] = PLAYER_RED;
        tabla[4][0] = PLAYER_YELLOW;
        tabla[4][1] = PLAYER_RED;

        const resultado = checkTie(tabla);

        expect(resultado).toBe(false);
    });

    test('No hay empate con tablero lleno excepto una celda', () => {
        const tabla = Array.from({ length: ROWS }, () => new Array(COLS).fill(PLAYER_RED));
        tabla[0][3] = EMPTY;

        const resultado = checkTie(tabla);

        expect(resultado).toBe(false);
    });
});