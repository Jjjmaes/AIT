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
exports.TranslationMemorySet = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const TranslationMemorySetSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true, index: true },
    description: { type: String, trim: true },
    sourceLanguage: { type: String, required: true, index: true },
    targetLanguage: { type: String, required: true, index: true },
    domain: { type: String, trim: true, default: 'general', index: true },
    project: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Project', index: true },
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    entryCount: { type: Number, default: 0 },
    isPublic: { type: Boolean, default: false, index: true },
}, {
    timestamps: true, // Adds createdAt and updatedAt automatically
    collection: 'translation_memory_sets' // Explicit collection name
});
// Optional: Compound index for common lookups
TranslationMemorySetSchema.index({ sourceLanguage: 1, targetLanguage: 1, domain: 1 });
// TODO: Add pagination plugin if needed for listing sets
// TranslationMemorySetSchema.plugin(mongoosePaginate);
exports.TranslationMemorySet = mongoose_1.default.model('TranslationMemorySet', TranslationMemorySetSchema);
