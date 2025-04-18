"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Segment = exports.mockSegmentInsertMany = exports.mockSegmentDeleteMany = void 0;
const globals_1 = require("@jest/globals");
// Export mock functions so they can be imported and controlled in tests
exports.mockSegmentDeleteMany = globals_1.jest.fn();
exports.mockSegmentInsertMany = globals_1.jest.fn();
// Export the mocked model structure
exports.Segment = {
    deleteMany: exports.mockSegmentDeleteMany,
    insertMany: exports.mockSegmentInsertMany,
};
