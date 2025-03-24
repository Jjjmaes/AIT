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
exports.ProjectPriority = exports.ProjectStatus = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var ProjectStatus;
(function (ProjectStatus) {
    ProjectStatus["DRAFT"] = "draft";
    ProjectStatus["IN_PROGRESS"] = "in_progress";
    ProjectStatus["REVIEW"] = "review";
    ProjectStatus["COMPLETED"] = "completed";
    ProjectStatus["ARCHIVED"] = "archived";
})(ProjectStatus || (exports.ProjectStatus = ProjectStatus = {}));
var ProjectPriority;
(function (ProjectPriority) {
    ProjectPriority["LOW"] = "low";
    ProjectPriority["MEDIUM"] = "medium";
    ProjectPriority["HIGH"] = "high";
    ProjectPriority["URGENT"] = "urgent";
})(ProjectPriority || (exports.ProjectPriority = ProjectPriority = {}));
const ProjectSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    sourceLanguage: {
        type: String,
        required: true
    },
    targetLanguage: {
        type: String,
        required: true
    },
    manager: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reviewers: [{
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'User'
        }],
    translationPromptTemplate: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'PromptTemplate',
        required: true
    },
    reviewPromptTemplate: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'PromptTemplate',
        required: true
    },
    deadline: {
        type: Date
    },
    status: {
        type: String,
        enum: Object.values(ProjectStatus),
        default: ProjectStatus.DRAFT
    },
    priority: {
        type: String,
        enum: Object.values(ProjectPriority),
        default: ProjectPriority.MEDIUM
    },
    progress: {
        totalSegments: {
            type: Number,
            default: 0
        },
        translatedSegments: {
            type: Number,
            default: 0
        },
        reviewedSegments: {
            type: Number,
            default: 0
        }
    }
}, {
    timestamps: true
});
exports.default = mongoose_1.default.model('Project', ProjectSchema);
