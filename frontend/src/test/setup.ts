import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock clsx to avoid import issues in tests
vi.mock('clsx', () => ({
  clsx: (...args: any[]) => args.filter(Boolean).join(' '),
}));
