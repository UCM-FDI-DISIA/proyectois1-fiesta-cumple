// Configuración global para Jest
require('@testing-library/jest-dom');

// Mock de Firebase
global.firebase = {
    initializeApp: jest.fn(),
    firestore: jest.fn(() => ({
        collection: jest.fn(() => ({
            doc: jest.fn(() => ({
                get: jest.fn(),
                set: jest.fn(),
                update: jest.fn(),
                collection: jest.fn()
            })),
            where: jest.fn(() => ({
                orderBy: jest.fn(() => ({
                    onSnapshot: jest.fn()
                }))
            })),
            orderBy: jest.fn(() => ({
                onSnapshot: jest.fn()
            })),
            add: jest.fn()
        }))
    }))
};

// Mock de console
global.console = {
    ...console,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
};