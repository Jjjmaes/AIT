"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const project_types_1 = require("../types/project.types");
const projectSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    managerId: { type: String, required: true },
    sourceLanguage: { type: String, required: true },
    targetLanguage: { type: String, required: true },
    status: {
        type: String,
        enum: Object.values(project_types_1.ProjectStatus),
        default: project_types_1.ProjectStatus.PENDING
    },
    priority: {
        type: String,
        enum: Object.values(project_types_1.ProjectPriority),
        default: project_types_1.ProjectPriority.MEDIUM
    },
    translationPromptTemplate: { type: String, required: true },
    reviewPromptTemplate: { type: String, required: true },
    deadline: { type: Date },
    estimatedCompletionTime: { type: Date },
    progress: {
        completionPercentage: { type: Number, default: 0 },
        translatedWords: { type: Number, default: 0 },
        totalWords: { type: Number, default: 0 }
    },
    reviewers: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }]
}, {
    timestamps: true
});
exports.default = (0, mongoose_1.model)('Project', projectSchema);
