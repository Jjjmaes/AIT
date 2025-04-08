import { jest } from '@jest/globals';

// Export mock functions so they can be imported and controlled in tests
export const mockSegmentDeleteMany = jest.fn();
export const mockSegmentInsertMany = jest.fn();

// Export the mocked model structure
export const Segment = {
  deleteMany: mockSegmentDeleteMany,
  insertMany: mockSegmentInsertMany,
}; 