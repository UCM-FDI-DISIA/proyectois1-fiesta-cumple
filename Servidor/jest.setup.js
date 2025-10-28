// Configuración global para Jest
require('@testing-library/jest-dom');

// Mock completo de Firebase
global.firebase = {
    initializeApp: jest.fn(),
    
    // Mock de Firestore
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
            orderBy: jest.fn(() => ({
                onSnapshot: jest.fn()
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
            getDownloadURL: jest.fn(() => Promise.resolve('https://example.com/photo.jpg'))
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