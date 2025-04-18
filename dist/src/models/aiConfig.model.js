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
exports.AIProviderConfig = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const aiProviderConfigSchema = new mongoose_1.Schema({
    providerName: {
        type: String,
        required: true,
        trim: true,
        // Consider enum: Object.values(AIProvider) later
    },
    apiKey: {
        type: String,
        required: [true, 'API Key is required'],
        trim: true,
        // TODO: Implement encryption or better secure storage mechanism
    },
    baseURL: {
        type: String,
        trim: true,
    },
    models: {
        type: [String],
        required: [true, 'At least one model name is required'],
        validate: {
            validator: (v) => v.length > 0,
            message: 'Model list cannot be empty'
        }
    },
    defaultModel: {
        type: String,
        trim: true,
        // TODO: Add validation to ensure it's one of the models in the array
    },
    defaultParams: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    notes: {
        type: String,
        trim: true,
    },
}, {
    timestamps: true,
});
// Index for faster lookups if needed
aiProviderConfigSchema.index({ providerName: 1 });
aiProviderConfigSchema.index({ isActive: 1 });
exports.AIProviderConfig = mongoose_1.default.model('AIProviderConfig', aiProviderConfigSchema);
