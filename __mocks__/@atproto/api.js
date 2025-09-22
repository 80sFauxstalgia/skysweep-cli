import { jest } from '@jest/globals';

export const BskyAgent = jest.fn(() => ({
  login: jest.fn(),
}));