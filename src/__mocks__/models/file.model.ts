import { jest } from '@jest/globals';

// Export the mock function for the .exec() call so it can be imported and controlled in tests
export const mockFileFindByIdExec = jest.fn();

// Export the mocked model structure directly
export const File = {
  findById: jest.fn().mockImplementation((id) => ({
    // The findById mock returns an object with our controllable exec mock
    exec: mockFileFindByIdExec, 
  })),
}; 