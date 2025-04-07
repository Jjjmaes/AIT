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
exports.Terminology = void 0;
const mongoose_1 = __importStar(require("mongoose"));
// Mongoose Schema for individual term entries (to be embedded)
const TermEntrySchema = new mongoose_1.Schema({
    source: {
        type: String,
        required: [true, '源术语不能为空'],
        trim: true
    },
    target: {
        type: String,
        required: [true, '目标术语不能为空'],
        trim: true
    },
    domain: {
        type: String,
        trim: true,
        lowercase: true
    },
    notes: {
        type: String,
        trim: true,
        maxlength: [500, '术语备注不能超过500个字符']
    }
}, { _id: false } // No separate _id for embedded terms
);
// Mongoose Schema for Terminology lists
const TerminologySchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: [true, '术语表名称不能为空'],
        trim: true,
        maxlength: [100, '术语表名称不能超过100个字符'],
        index: true
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, '术语表描述不能超过500个字符']
    },
    languagePairs: [
        {
            source: { type: String, required: true, trim: true, lowercase: true },
            target: { type: String, required: true, trim: true, lowercase: true },
            _id: false
        }
    ],
    terms: [TermEntrySchema], // Embed the term schema
    project: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Project', // Reference to the Project model
        index: true,
        default: null // Explicitly nullable
    },
    createdBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User', // Reference to the User model
        required: true
    },
    isPublic: {
        type: Boolean,
        default: false, // Terminology lists are private by default
        index: true
    }
}, {
    timestamps: true // Automatically add createdAt and updatedAt fields
});
// Validation: Ensure at least one language pair is provided
TerminologySchema.path('languagePairs').validate(function (value) {
    return value && value.length > 0;
}, '术语表必须至少指定一个语言对');
// Indexing for common query patterns
TerminologySchema.index({ createdBy: 1, name: 1 });
TerminologySchema.index({ project: 1 });
TerminologySchema.index({ isPublic: 1 });
// Export the Mongoose model
exports.Terminology = mongoose_1.default.model('Terminology', TerminologySchema);
