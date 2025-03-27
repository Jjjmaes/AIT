"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockProjectsWithStatus = exports.mockProjects = void 0;
const mongoose_1 = require("mongoose");
const project_types_1 = require("../../types/project.types");
exports.mockProjects = [
    {
        name: 'Test Project 1',
        description: 'Test Description 1',
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        managerId: new mongoose_1.Types.ObjectId().toString(),
        translationPromptTemplate: 'translation template 1',
        reviewPromptTemplate: 'review template 1',
        priority: project_types_1.ProjectPriority.MEDIUM,
        deadline: new Date('2024-12-31')
    },
    {
        name: 'Test Project 2',
        description: 'Test Description 2',
        sourceLanguage: 'ja',
        targetLanguage: 'en',
        managerId: new mongoose_1.Types.ObjectId().toString(),
        translationPromptTemplate: 'translation template 2',
        reviewPromptTemplate: 'review template 2',
        priority: project_types_1.ProjectPriority.HIGH,
        deadline: new Date('2024-12-31')
    }
];
exports.mockProjectsWithStatus = exports.mockProjects.map(project => ({
    ...project,
    status: project_types_1.ProjectStatus.PENDING,
    progress: {
        totalWords: 1000,
        translatedWords: 0,
        completionPercentage: 0
    },
    reviewers: [new mongoose_1.Types.ObjectId().toString()],
    createdAt: new Date(),
    updatedAt: new Date()
}));
