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
exports.PromptStatus = exports.PromptType = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var PromptType;
(function (PromptType) {
    PromptType["TRANSLATION"] = "translation";
    PromptType["REVIEW"] = "review";
})(PromptType || (exports.PromptType = PromptType = {}));
var PromptStatus;
(function (PromptStatus) {
    PromptStatus["DRAFT"] = "draft";
    PromptStatus["PUBLISHED"] = "published";
    PromptStatus["ARCHIVED"] = "archived";
})(PromptStatus || (exports.PromptStatus = PromptStatus = {}));
const PromptTemplateSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    type: {
        type: String,
        enum: Object.values(PromptType),
        required: true
    },
    systemInstruction: {
        type: String,
        required: true
    },
    userInputTemplate: {
        type: String,
        required: true
    },
    outputFormat: {
        type: String
    },
    variables: [{
            type: String
        }],
    sourceLanguages: [{
            type: String
        }],
    targetLanguages: [{
            type: String
        }],
    domains: [{
            type: String
        }],
    creator: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: Object.values(PromptStatus),
        default: PromptStatus.DRAFT
    },
    version: {
        type: Number,
        default: 1
    },
    aiProvider: {
        type: String,
        required: true
    },
    aiModel: {
        type: String,
        required: true
    },
    parentTemplate: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'PromptTemplate'
    },
    usageCount: {
        type: Number,
        default: 0
    },
    performanceMetrics: {
        acceptanceRate: {
            type: Number
        },
        averageModificationRate: {
            type: Number
        },
        averageTokenUsage: {
            type: Number
        }
    }
}, {
    timestamps: true
});
exports.default = mongoose_1.default.model('PromptTemplate', PromptTemplateSchema);
