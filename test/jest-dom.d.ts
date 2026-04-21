import '@testing-library/jest-dom';
import 'bun:test';

declare global {
  namespace jest {
    interface Matchers<R> extends import('@testing-library/jest-dom').jest.Matchers<R> {}
  }
}

declare module 'bun:test' {
  interface Matchers<T> extends import('@testing-library/jest-dom').TestingLibraryMatchers<any, T> {}
}
