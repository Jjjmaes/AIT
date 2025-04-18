"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.File = exports.mockFileFindByIdExec = void 0;
const globals_1 = require("@jest/globals");
// Export the mock function for the .exec() call so it can be imported and controlled in tests
exports.mockFileFindByIdExec = globals_1.jest.fn();
// Export the mocked model structure directly
exports.File = {
    findById: globals_1.jest.fn().mockImplementation((id) => ({
        // The findById mock returns an object with our controllable exec mock
        exec: exports.mockFileFindByIdExec,
    })),
};
