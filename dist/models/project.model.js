"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Project = exports.ProjectStatus = void 0;
const mongoose_1 = __importStar(require("mongoose"));
// Define ProjectStatus enum here and export it
var ProjectStatus;
(function (ProjectStatus) {
    ProjectStatus["ACTIVE"] = "active";
    ProjectStatus["PENDING"] = "pending";
    ProjectStatus["IN_PROGRESS"] = "in_progress";
    ProjectStatus["COMPLETED"] = "completed";
    ProjectStatus["ARCHIVED"] = "archived";
})(ProjectStatus || (exports.ProjectStatus = ProjectStatus = {}));
const fileSegmentSchema = new mongoose_1.Schema({
    id: { type: String, required: true },
    source: { type: String, required: true },
    target: { type: String },
    status: { type: String, default: 'pending' },
    metadata: {
        processingTime: { type: Number },
        tokens: { type: Number },
        cost: { type: Number },
        reviewStatus: { type: String, enum: ['approved', 'rejected'] }
    },
    reviewedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date }
});
const projectFileSchema = new mongoose_1.Schema({
    id: String,
    name: String,
    path: String,
    wordCount: Number,
    characterCount: Number,
    status: String,
    progress: Number,
    segments: [mongoose_1.Schema.Types.Mixed]
});
const languagePairSchema = new mongoose_1.Schema({
    source: { type: String, required: true },
    target: { type: String, required: true }
}, { _id: false });
const projectSchema = new mongoose_1.Schema({
    name: { type: String, required: true, index: true },
    description: { type: String },
    owner: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    manager: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reviewers: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }],
    members: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }],
    languagePairs: [languagePairSchema],
    defaultTranslationPromptTemplate: { type: mongoose_1.Schema.Types.ObjectId, ref: 'PromptTemplate' },
    defaultReviewPromptTemplate: { type: mongoose_1.Schema.Types.ObjectId, ref: 'PromptTemplate' },
    translationPromptTemplate: { type: mongoose_1.Schema.Types.ObjectId, ref: 'PromptTemplate' },
    reviewPromptTemplate: { type: mongoose_1.Schema.Types.ObjectId, ref: 'PromptTemplate' },
    domain: { type: String },
    industry: { type: String },
    terminology: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Terminology' },
    status: {
        type: String,
        enum: Object.values(ProjectStatus),
        default: ProjectStatus.ACTIVE,
        index: true
    },
    priority: { type: Number, index: true },
    deadline: { type: Date, index: true },
    files: [projectFileSchema],
    progress: { type: Number },
    completedAt: { type: Date }
}, {
    timestamps: true
});
// Indexes for querying
projectSchema.index({ owner: 1 });
projectSchema.index({ manager: 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ priority: 1 });
projectSchema.index({ deadline: 1 });
exports.Project = mongoose_1.default.model('Project', projectSchema);
exports.default = exports.Project;
