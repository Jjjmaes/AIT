"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IssueType = exports.ReviewScoreType = void 0;
var ReviewScoreType;
(function (ReviewScoreType) {
    ReviewScoreType["ACCURACY"] = "ACCURACY";
    ReviewScoreType["NATURALNESS"] = "NATURALNESS";
    ReviewScoreType["CULTURAL_APPROPRIATENESS"] = "CULTURAL_APPROPRIATENESS";
    ReviewScoreType["OVERALL"] = "OVERALL";
})(ReviewScoreType || (exports.ReviewScoreType = ReviewScoreType = {}));
var IssueType;
(function (IssueType) {
    IssueType["GRAMMAR"] = "GRAMMAR";
    IssueType["SPELLING"] = "SPELLING";
    IssueType["PUNCTUATION"] = "PUNCTUATION";
    IssueType["STYLE"] = "STYLE";
    IssueType["CULTURAL"] = "CULTURAL";
    IssueType["TERMINOLOGY"] = "TERMINOLOGY";
    IssueType["FORMATTING"] = "FORMATTING";
    IssueType["OTHER"] = "OTHER";
})(IssueType || (exports.IssueType = IssueType = {}));
