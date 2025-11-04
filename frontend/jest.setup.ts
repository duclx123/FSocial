// Jest setup file for Frontend tests
import '@testing-library/jest-dom';

// Set test environment variables
process.env.TEST_ENV = process.env.TEST_ENV || 'mock';
process.env.NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://kmt7f23tbj.execute-api.us-east-1.amazonaws.com/dev';
process.env.NEXT_PUBLIC_USER_POOL_ID = 'us-east-1_IT8I0ahLq';
process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID = 'test-client-id';

// Mock AuthContext globally with default implementation (reused across tests)
const mockAuthContext = {
  user: {
    sub: 'test-user-123',
    email: 'testuser1@example.com',
    name: 'Test User',
    username: 'testuser1',
  },
  session: null,
  token: 'mock-jwt-token-12345',
  loading: false,
  signIn: jest.fn(),
  signUp: jest.fn(),
  signOut: jest.fn(),
  refreshUser: jest.fn(),
};

jest.mock('@/contexts/AuthContext', () => ({
  __esModule: true,
  useAuth: jest.fn(() => mockAuthContext),
  AuthProvider: ({ children }: { children: any }) => children,
  default: ({ children }: { children: any }) => children,
}));

// Mock window.matchMedia (reused instance)
const mockMatchMedia = jest.fn().mockImplementation(query => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: mockMatchMedia,
});

// Mock IntersectionObserver (reused class)
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Mock localStorage (reused instance)
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock as any;

// Suppress console logs during tests to reduce noise and improve performance
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  // Keep error for debugging
  error: console.error,
};

// Global test timeout
jest.setTimeout(10000);

// Global cleanup to prevent memory leaks
afterEach(() => {
  // Clear localStorage after each test
  localStorageMock.clear();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
});

afterAll(async () => {
  // Clear all timers
  jest.clearAllTimers();
  
  // Clear all mocks
  jest.clearAllMocks();
  
  // Allow time for async cleanup (use setTimeout for browser environment)
  await new Promise(resolve => setTimeout(resolve, 0));
});
