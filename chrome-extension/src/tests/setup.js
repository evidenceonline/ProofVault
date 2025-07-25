// Test setup for ProofVault Chrome Extension

// Mock Web Crypto API
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      digest: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
      generateKey: jest.fn().mockResolvedValue({
        privateKey: {},
        publicKey: {}
      }),
      exportKey: jest.fn().mockResolvedValue(new ArrayBuffer(256)),
      importKey: jest.fn().mockResolvedValue({}),
      sign: jest.fn().mockResolvedValue(new ArrayBuffer(64)),
      verify: jest.fn().mockResolvedValue(true)
    },
    getRandomValues: jest.fn().mockImplementation((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    })
  }
});

// Mock FileReader
global.FileReader = class FileReader {
  constructor() {
    this.result = null;
    this.onloadend = null;
    this.onerror = null;
  }
  
  readAsDataURL(blob) {
    setTimeout(() => {
      this.result = 'data:application/pdf;base64,mock-pdf-data';
      if (this.onloadend) this.onloadend();
    }, 10);
  }
  
  readAsArrayBuffer(blob) {
    setTimeout(() => {
      this.result = new ArrayBuffer(1024);
      if (this.onloadend) this.onloadend();
    }, 10);
  }
};

// Mock Blob
global.Blob = class Blob {
  constructor(parts, options) {
    this.parts = parts;
    this.size = parts.reduce((acc, part) => acc + (part.length || 0), 0);
    this.type = options?.type || '';
  }
  
  arrayBuffer() {
    return Promise.resolve(new ArrayBuffer(this.size));
  }
  
  text() {
    return Promise.resolve(this.parts.join(''));
  }
};

// Mock URL
global.URL = {
  createObjectURL: jest.fn(() => 'blob:mock-url'),
  revokeObjectURL: jest.fn()
};

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true }),
    text: () => Promise.resolve('mock response')
  })
);

// Mock chrome extension APIs
global.chrome = {
  runtime: {
    getManifest: () => ({ version: '1.0.0' }),
    sendMessage: jest.fn((message, callback) => {
      if (callback) callback({ success: true });
    }),
    onMessage: {
      addListener: jest.fn()
    },
    onInstalled: {
      addListener: jest.fn()
    },
    getURL: jest.fn((path) => `chrome-extension://mock-id/${path}`)
  },
  storage: {
    local: {
      get: jest.fn((keys, callback) => {
        callback({});
      }),
      set: jest.fn((items, callback) => {
        if (callback) callback();
      }),
      clear: jest.fn((callback) => {
        if (callback) callback();
      }),
      getBytesInUse: jest.fn((keys, callback) => {
        callback(1024);
      })
    },
    sync: {
      get: jest.fn((keys, callback) => {
        callback({});
      }),
      set: jest.fn((items, callback) => {
        if (callback) callback();
      }),
      clear: jest.fn((callback) => {
        if (callback) callback();
      })
    }
  },
  tabs: {
    captureVisibleTab: jest.fn((windowId, options, callback) => {
      callback('data:image/png;base64,mock-screenshot-data');
    }),
    query: jest.fn((queryInfo, callback) => {
      callback([{
        id: 1,
        url: 'https://example.com',
        title: 'Example Page',
        windowId: 1
      }]);
    })
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
  },
  downloads: {
    download: jest.fn()
  }
};

// Mock DOM methods
Object.defineProperty(window, 'navigator', {
  value: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    language: 'en-US',
    clipboard: {
      writeText: jest.fn().mockResolvedValue()
    }
  }
});

// Suppress console warnings during tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn()
};