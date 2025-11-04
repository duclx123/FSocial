/**
 * Test Cleanup Utilities
 * 
 * Provides reusable cleanup functions to prevent memory leaks and improve test performance
 */

/**
 * Cleanup function for tests using timers
 * Call this in afterEach when using jest.useFakeTimers()
 */
export const cleanupTimers = () => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.clearAllTimers();
};

/**
 * Cleanup function for tests using fetch mocks
 * Call this in afterEach when mocking global.fetch
 */
export const cleanupFetchMocks = () => {
  if (global.fetch && jest.isMockFunction(global.fetch)) {
    (global.fetch as jest.Mock).mockClear();
  }
};

/**
 * Cleanup function for tests using localStorage
 * Call this in afterEach when using localStorage
 */
export const cleanupLocalStorage = () => {
  localStorage.clear();
  if (jest.isMockFunction(localStorage.getItem)) {
    (localStorage.getItem as jest.Mock).mockClear();
  }
  if (jest.isMockFunction(localStorage.setItem)) {
    (localStorage.setItem as jest.Mock).mockClear();
  }
  if (jest.isMockFunction(localStorage.removeItem)) {
    (localStorage.removeItem as jest.Mock).mockClear();
  }
};

/**
 * Cleanup function for tests using sessionStorage
 * Call this in afterEach when using sessionStorage
 */
export const cleanupSessionStorage = () => {
  sessionStorage.clear();
};

/**
 * Complete cleanup for component tests
 * Combines all common cleanup operations
 */
export const cleanupComponentTest = () => {
  jest.clearAllMocks();
  cleanupLocalStorage();
  cleanupSessionStorage();
  cleanupFetchMocks();
};

/**
 * Cleanup for tests with async operations
 * Ensures all pending promises are resolved
 */
export const cleanupAsync = async () => {
  await new Promise(resolve => setTimeout(resolve, 0));
};
