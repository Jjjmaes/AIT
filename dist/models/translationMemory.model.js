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
exports.TranslationMemory = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const TranslationMemorySchema = new mongoose_1.Schema({
    sourceLanguage: { type: String, required: true, index: true },
    targetLanguage: { type: String, required: true, index: true },
    sourceText: { type: String, required: true, index: 'text' }, // Index for text search
    targetText: { type: String, required: true },
    project: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Project', index: true },
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    lastUsedAt: { type: Date },
    usageCount: { type: Number, default: 0 },
    // qualityScore: { type: Number, min: 0, max: 100 },
}, {
    timestamps: true, // Adds createdAt and updatedAt automatically
    collection: 'translation_memory_entries'
});
// Compound index for efficient lookups based on language and source text
// Consider adding project to the index if filtering by project is common
TranslationMemorySchema.index({ sourceLanguage: 1, targetLanguage: 1, sourceText: 1, project: 1 });
exports.TranslationMemory = mongoose_1.default.model('TranslationMemory', TranslationMemorySchema);
