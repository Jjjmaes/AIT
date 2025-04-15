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
exports.PromptTemplate = exports.PromptTaskType = void 0;
const mongoose_1 = __importStar(require("mongoose"));
// Enum for the task type the prompt is designed for
var PromptTaskType;
(function (PromptTaskType) {
    PromptTaskType["TRANSLATION"] = "translation";
    PromptTaskType["REVIEW"] = "review";
})(PromptTaskType || (exports.PromptTaskType = PromptTaskType = {}));
// Mongoose Schema for Prompt Templates
const PromptTemplateSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: [true, '模板名称不能为空'],
        trim: true,
        maxlength: [100, '模板名称不能超过100个字符'],
        index: true
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, '模板描述不能超过500个字符']
    },
    systemInstruction: {
        type: String,
        required: [true, '系统指令不能为空'],
        trim: true
    },
    userPrompt: {
        type: String,
        required: [true, '用户提示模板不能为空'],
        trim: true
    },
    domain: {
        type: String,
        trim: true,
        lowercase: true,
        index: true
    },
    languagePairs: [
        {
            source: { type: String, required: true, trim: true, lowercase: true },
            target: { type: String, required: true, trim: true, lowercase: true },
            _id: false // Don't create separate IDs for language pairs in the array
        }
    ],
    taskType: {
        type: String,
        enum: Object.values(PromptTaskType),
        required: [true, '任务类型不能为空'],
        index: true
    },
    createdBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User', // Reference to the User model
        required: true
    },
    isPublic: {
        type: Boolean,
        default: false, // Templates are private by default
        index: true
    }
}, {
    timestamps: true // Automatically add createdAt and updatedAt fields
});
// Indexing for common query patterns
PromptTemplateSchema.index({ createdBy: 1, name: 1 });
PromptTemplateSchema.index({ taskType: 1, domain: 1, isPublic: 1 });
// Export the Mongoose model
exports.PromptTemplate = mongoose_1.default.model('PromptTemplate', PromptTemplateSchema);
