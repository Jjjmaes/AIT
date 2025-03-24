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
exports.IssueType = exports.SegmentStatus = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var SegmentStatus;
(function (SegmentStatus) {
    SegmentStatus["PENDING"] = "pending";
    SegmentStatus["TRANSLATING"] = "translating";
    SegmentStatus["TRANSLATED"] = "translated";
    SegmentStatus["REVIEWING"] = "reviewing";
    SegmentStatus["REVIEWED"] = "reviewed";
    SegmentStatus["COMPLETED"] = "completed";
    SegmentStatus["ERROR"] = "error";
})(SegmentStatus || (exports.SegmentStatus = SegmentStatus = {}));
var IssueType;
(function (IssueType) {
    IssueType["TERMINOLOGY"] = "terminology";
    IssueType["GRAMMAR"] = "grammar";
    IssueType["STYLE"] = "style";
    IssueType["ACCURACY"] = "accuracy";
    IssueType["FORMATTING"] = "formatting";
    IssueType["CONSISTENCY"] = "consistency";
    IssueType["OTHER"] = "other";
})(IssueType || (exports.IssueType = IssueType = {}));
const IssueSchema = new mongoose_1.Schema({
    type: {
        type: String,
        enum: Object.values(IssueType),
        required: true
    },
    description: {
        type: String,
        required: true
    },
    position: {
        start: { type: Number },
        end: { type: Number }
    },
    suggestion: {
        type: String
    },
    resolved: {
        type: Boolean,
        default: false
    }
}, {
    _id: true
});
const SegmentSchema = new mongoose_1.Schema({
    file: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'File',
        required: true
    },
    index: {
        type: Number,
        required: true
    },
    sourceText: {
        type: String,
        required: true
    },
    aiTranslation: {
        type: String
    },
    aiReview: {
        type: String
    },
    finalTranslation: {
        type: String
    },
    status: {
        type: String,
        enum: Object.values(SegmentStatus),
        default: SegmentStatus.PENDING
    },
    issues: [IssueSchema],
    reviewer: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User'
    },
    translationMetadata: {
        aiModel: { type: String },
        promptTemplateId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'PromptTemplate' },
        tokenCount: { type: Number },
        processingTime: { type: Number }
    },
    reviewMetadata: {
        aiModel: { type: String },
        promptTemplateId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'PromptTemplate' },
        tokenCount: { type: Number },
        processingTime: { type: Number },
        acceptedChanges: { type: Boolean },
        modificationDegree: { type: Number }
    },
    translationCompletedAt: {
        type: Date
    },
    reviewCompletedAt: {
        type: Date
    }
}, {
    timestamps: true
});
// 创建复合索引以便快速查找某个文件中的所有段落
SegmentSchema.index({ file: 1, index: 1 });
exports.default = mongoose_1.default.model('Segment', SegmentSchema);
