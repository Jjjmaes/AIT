"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockProjects = void 0;
const mongoose_1 = require("mongoose");
exports.mockProjects = [
    {
        name: 'Test Project 1',
        description: 'Test Description 1',
        languagePairs: [{ source: 'en', target: 'zh' }],
        manager: new mongoose_1.Types.ObjectId().toString(),
        priority: 1
    },
    {
        name: 'Test Project 2',
        description: 'Test Description 2',
        languagePairs: [{ source: 'ja', target: 'en' }],
        manager: new mongoose_1.Types.ObjectId().toString(),
        priority: 2
    }
];
// export const mockProjectsWithStatus = mockProjects.map(project => ({ ... }));
