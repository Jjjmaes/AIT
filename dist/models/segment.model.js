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
exports.Issue = exports.Segment = exports.ReviewScoreType = exports.IssueType = exports.SegmentStatus = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var SegmentStatus;
(function (SegmentStatus) {
    SegmentStatus["PENDING"] = "pending";
    SegmentStatus["TRANSLATED"] = "translated";
    SegmentStatus["REVIEWING"] = "reviewing";
    SegmentStatus["REVIEW_PENDING"] = "review_pending";
    SegmentStatus["REVIEW_IN_PROGRESS"] = "review_in_progress";
    SegmentStatus["REVIEW_FAILED"] = "review_failed";
    SegmentStatus["REVIEW_COMPLETED"] = "review_completed";
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
var ReviewScoreType;
(function (ReviewScoreType) {
    ReviewScoreType["OVERALL"] = "overall";
    ReviewScoreType["ACCURACY"] = "accuracy";
    ReviewScoreType["FLUENCY"] = "fluency";
    ReviewScoreType["TERMINOLOGY"] = "terminology";
    ReviewScoreType["STYLE"] = "style";
    ReviewScoreType["LOCALE"] = "locale"; // 本地化适配
})(ReviewScoreType || (exports.ReviewScoreType = ReviewScoreType = {}));
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
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    resolvedAt: Date,
    createdBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User'
    },
    resolvedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    _id: true
});
const ReviewScoreSchema = new mongoose_1.Schema({
    type: {
        type: String,
        enum: Object.values(ReviewScoreType),
        required: true
    },
    score: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    details: String
}, {
    _id: false
});
const ReviewChangeSchema = new mongoose_1.Schema({
    version: {
        type: Number,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    modifiedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User'
    },
    aiGenerated: {
        type: Boolean,
        default: false
    },
    acceptedByHuman: {
        type: Boolean,
        default: false
    }
}, {
    _id: false
});
const ReviewResultSchema = new mongoose_1.Schema({
    originalTranslation: {
        type: String,
        required: true
    },
    suggestedTranslation: String,
    finalTranslation: String,
    issues: [{
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'Issue'
        }],
    scores: [ReviewScoreSchema],
    reviewDate: {
        type: Date,
        default: Date.now
    },
    reviewerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User'
    },
    aiReviewer: String,
    modificationDegree: {
        type: Number,
        min: 0,
        max: 1
    },
    acceptedChanges: Boolean
}, {
    _id: false
});
const segmentSchema = new mongoose_1.Schema({
    fileId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'File',
        required: true
    },
    content: {
        type: String,
        required: true
    },
    translation: String,
    originalLength: {
        type: Number,
        required: true
    },
    translatedLength: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: Object.values(SegmentStatus),
        default: SegmentStatus.PENDING
    },
    translator: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User'
    },
    reviewer: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User'
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed
    },
    error: String,
    issues: [IssueSchema],
    reviewResult: ReviewResultSchema,
    reviewHistory: [ReviewChangeSchema]
}, {
    timestamps: true
});
// 创建索引
segmentSchema.index({ fileId: 1 });
segmentSchema.index({ status: 1 });
segmentSchema.index({ translator: 1 });
segmentSchema.index({ reviewer: 1 });
exports.Segment = mongoose_1.default.model('Segment', segmentSchema);
// 导出问题模型，用于独立查询
exports.Issue = mongoose_1.default.model('Issue', IssueSchema);
