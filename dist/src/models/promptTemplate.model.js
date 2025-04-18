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
exports.PromptTemplate = exports.OutputFormat = exports.PromptTemplateType = void 0;
const mongoose_1 = __importStar(require("mongoose"));
// Enum for prompt types (optional but recommended)
var PromptTemplateType;
(function (PromptTemplateType) {
    PromptTemplateType["TRANSLATION"] = "translation";
    PromptTemplateType["REVIEW"] = "review";
    // Add other types as needed (e.g., summarization, terminology extraction)
})(PromptTemplateType || (exports.PromptTemplateType = PromptTemplateType = {}));
// Enum for output formats (optional but recommended)
var OutputFormat;
(function (OutputFormat) {
    OutputFormat["TEXT"] = "text";
    OutputFormat["MARKDOWN"] = "markdown";
    OutputFormat["JSON"] = "json";
    // Add others like XML, YAML if needed
})(OutputFormat || (exports.OutputFormat = OutputFormat = {}));
const promptTemplateSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: [true, 'Template name is required'],
        trim: true,
        unique: true, // Ensure names are unique
    },
    description: {
        type: String,
        required: [true, 'Template description is required'],
        trim: true,
    },
    type: {
        type: String,
        required: [true, 'Template type is required'],
        enum: Object.values(PromptTemplateType), // Use enum values
        default: PromptTemplateType.TRANSLATION,
    },
    content: {
        type: String,
        required: [true, 'Prompt content is required'],
        trim: true,
    },
    outputFormat: {
        type: String,
        required: [true, 'Output format description is required'],
        trim: true,
    },
    variables: {
        type: [String],
        default: [], // Default to empty array
    },
    modelIdentifier: {
        type: String,
        required: [true, 'AI model identifier is required'],
        trim: true,
        // Example: "OpenAI-gpt-4o", "Grok-grok-3-latest"
        // Validation could be added later to check against available AI models
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    createdBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User', // Reference the User model if you have one
        // required: true, // Make required if needed
    },
}, {
    timestamps: true, // Adds createdAt and updatedAt automatically
});
// Indexes for performance
promptTemplateSchema.index({ name: 1 });
promptTemplateSchema.index({ type: 1 });
promptTemplateSchema.index({ isActive: 1 });
promptTemplateSchema.index({ modelIdentifier: 1 });
exports.PromptTemplate = mongoose_1.default.model('PromptTemplate', promptTemplateSchema);
