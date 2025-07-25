module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.js'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.js',
    '<rootDir>/src/**/*.test.js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/tests/**',
    '!src/**/*.test.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  globals: {
    chrome: {
      runtime: {
        getManifest: () => ({ version: '1.0.0' }),
        sendMessage: jest.fn(),
        onMessage: {
          addListener: jest.fn()
        }
      },
      storage: {
        local: {
          get: jest.fn(),
          set: jest.fn(),
          clear: jest.fn()
        },
        sync: {
          get: jest.fn(),
          set: jest.fn(),
          clear: jest.fn()
        }
      },
      tabs: {
        captureVisibleTab: jest.fn(),
        query: jest.fn()
      },
      contextMenus: {
        create: jest.fn(),
        onClicked: {
          addListener: jest.fn()
        }
      },
      action: {
        setBadgeText: jest.fn(),
        setBadgeBackgroundColor: jest.fn()
      }
    }
  }
};