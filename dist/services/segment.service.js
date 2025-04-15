"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.segmentService = void 0;
const segment_model_1 = require("../models/segment.model");
const errorHandler_1 = require("../utils/errorHandler");
const logger_1 = __importDefault(require("../utils/logger"));
const mongoose_1 = require("mongoose");
const errors_1 = require("../utils/errors");
class SegmentService {
    constructor() {
        this.serviceName = 'SegmentService';
        // Add delete method if required later
        // async deleteSegmentsByFileId(fileId: string): Promise<{ deletedCount: number }> { ... }
    }
    async getSegmentById(segmentId) {
        const methodName = 'getSegmentById';
        (0, errorHandler_1.validateId)(segmentId, '段落');
        try {
            const segment = await segment_model_1.Segment.findById(segmentId).exec();
            (0, errorHandler_1.validateEntityExists)(segment, '段落');
            return segment;
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName} for segment ${segmentId}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '段落');
        }
    }
    async getSegmentsByFileId(fileId, filters = {}, pagination = {}) {
        const methodName = 'getSegmentsByFileId';
        (0, errorHandler_1.validateId)(fileId, '文件');
        const page = pagination.page || 1;
        const limit = pagination.limit || 50; // Default limit
        const skip = (page - 1) * limit;
        const query = { fileId: new mongoose_1.Types.ObjectId(fileId) };
        if (filters.status) {
            if (!Object.values(segment_model_1.SegmentStatus).includes(filters.status)) {
                throw new errors_1.ValidationError('无效的段落状态过滤器');
            }
            query.status = filters.status;
        }
        try {
            const [segments, total] = await Promise.all([
                segment_model_1.Segment.find(query)
                    .sort({ index: 1 }) // Sort by segment index
                    .skip(skip)
                    .limit(limit)
                    .exec(),
                segment_model_1.Segment.countDocuments(query).exec()
            ]);
            return { segments, total };
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName} for file ${fileId}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '文件段落');
        }
    }
    async updateSegment(segmentId, updateData) {
        const methodName = 'updateSegment';
        (0, errorHandler_1.validateId)(segmentId, '段落');
        if (!updateData || Object.keys(updateData).length === 0) {
            throw new errors_1.ValidationError('缺少更新数据');
        }
        // Prevent updating critical fields directly if needed
        // delete updateData.fileId; 
        // delete updateData.index;
        try {
            // Ensure updatedAt is updated
            updateData.updatedAt = new Date();
            const updatedSegment = await segment_model_1.Segment.findByIdAndUpdate(segmentId, { $set: updateData }, { new: true, runValidators: true } // Return updated doc, run schema validators
            ).exec();
            (0, errorHandler_1.validateEntityExists)(updatedSegment, '段落');
            return updatedSegment;
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName} for segment ${segmentId}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '段落');
        }
    }
}
// Export singleton instance
exports.segmentService = new SegmentService();
