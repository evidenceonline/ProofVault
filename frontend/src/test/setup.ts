import '@testing-library/jest-dom';

// Mock crypto.subtle for tests
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      digest: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
    },
  },
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock FileReader
global.FileReader = class {
  result: any = null;
  onload: any = null;
  onerror: any = null;
  
  readAsArrayBuffer(file: File) {
    setTimeout(() => {
      this.result = new ArrayBuffer(file.size);
      if (this.onload) this.onload({ target: this });
    }, 0);
  }
  
  readAsDataURL(file: File) {
    setTimeout(() => {
      this.result = `data:${file.type};base64,mock-data`;
      if (this.onload) this.onload({ target: this });
    }, 0);
  }
} as any;

// Mock fetch
global.fetch = jest.fn();

// Silence console.error for tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});