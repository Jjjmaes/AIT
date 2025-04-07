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
exports.File = exports.FileType = exports.FileStatus = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var FileStatus;
(function (FileStatus) {
    FileStatus["PENDING"] = "pending";
    FileStatus["PROCESSING"] = "processing";
    FileStatus["TRANSLATED"] = "translated";
    FileStatus["REVIEWING"] = "reviewing";
    FileStatus["COMPLETED"] = "completed";
    FileStatus["ERROR"] = "error";
})(FileStatus || (exports.FileStatus = FileStatus = {}));
var FileType;
(function (FileType) {
    FileType["TXT"] = "txt";
    FileType["JSON"] = "json";
    FileType["MD"] = "md";
    FileType["DOCX"] = "docx";
    FileType["HTML"] = "html";
    FileType["XML"] = "xml";
    FileType["CSV"] = "csv";
    FileType["XLSX"] = "xlsx";
    FileType["MEMOQ_XLIFF"] = "mqxliff";
    FileType["XLIFF"] = "xliff";
})(FileType || (exports.FileType = FileType = {}));
const fileSchema = new mongoose_1.Schema({
    projectId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    fileName: {
        type: String,
        required: true
    },
    originalName: {
        type: String,
        required: true
    },
    fileSize: {
        type: Number,
        required: true
    },
    mimeType: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: Object.values(FileType),
        required: true
    },
    status: {
        type: String,
        enum: Object.values(FileStatus),
        default: FileStatus.PENDING
    },
    uploadedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    storageUrl: {
        type: String,
        required: true
    },
    path: {
        type: String,
        required: true
    },
    metadata: {
        sourceLanguage: {
            type: String,
            required: true
        },
        targetLanguage: {
            type: String,
            required: true
        },
        category: String,
        tags: [String]
    },
    progress: {
        total: Number,
        completed: Number,
        translated: Number,
        percentage: Number
    },
    error: String,
    errorDetails: String,
    processingStartedAt: Date,
    processingCompletedAt: Date,
    segmentCount: {
        type: Number,
        required: true,
        default: 0
    },
    translatedCount: {
        type: Number,
        default: 0
    },
    reviewedCount: {
        type: Number,
        default: 0
    },
    processedAt: Date
}, {
    timestamps: true
});
// 创建索引
fileSchema.index({ projectId: 1 });
fileSchema.index({ status: 1 });
fileSchema.index({ type: 1 });
exports.File = mongoose_1.default.model('File', fileSchema);
