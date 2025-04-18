import { Service } from 'typedi';
import { Segment, ISegment, SegmentStatus } from '../models/segment.model';
import { handleServiceError, validateId, validateEntityExists } from '../utils/errorHandler';
import logger from '../utils/logger';
import { Types } from 'mongoose';
import { NotFoundError, ValidationError } from '../utils/errors';

// Interface defining the service methods (optional but good practice)
export interface ISegmentService {
  getSegmentById(segmentId: string): Promise<ISegment>; // Return non-null or throw
  getSegmentsByFileId(fileId: string, filters?: { status?: SegmentStatus }, pagination?: { page?: number, limit?: number }): Promise<{ segments: ISegment[], total: number }>;
  updateSegment(segmentId: string, updateData: Partial<ISegment>): Promise<ISegment>; // Return non-null or throw
  // Add other methods like delete as needed
}

@Service()
export class SegmentService implements ISegmentService {
  private serviceName = 'SegmentService';

  async getSegmentById(segmentId: string): Promise<ISegment> {
    const methodName = 'getSegmentById';
    validateId(segmentId, '段落');
    try {
      const segment = await Segment.findById(segmentId).exec();
      validateEntityExists(segment, '段落');
      return segment;
    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName} for segment ${segmentId}:`, error);
      throw handleServiceError(error, this.serviceName, methodName, '段落');
    }
  }

  async getSegmentsByFileId(
      fileId: string, 
      filters: { status?: SegmentStatus } = {},
      pagination: { page?: number, limit?: number } = {}
  ): Promise<{ segments: ISegment[], total: number }> {
      const methodName = 'getSegmentsByFileId';
      validateId(fileId, '文件');
      const page = pagination.page || 1;
      const limit = pagination.limit || 50; // Default limit
      const skip = (page - 1) * limit;

      const query: any = { fileId: new Types.ObjectId(fileId) };
      if (filters.status) {
        if (!Object.values(SegmentStatus).includes(filters.status)) {
            throw new ValidationError('无效的段落状态过滤器');
        }
        query.status = filters.status;
      }

      try {
          const [segments, total] = await Promise.all([
              Segment.find(query)
                  .sort({ index: 1 }) // Sort by segment index
                  .skip(skip)
                  .limit(limit)
                  .exec(),
              Segment.countDocuments(query).exec()
          ]);
          return { segments, total };
      } catch (error) {
          logger.error(`Error in ${this.serviceName}.${methodName} for file ${fileId}:`, error);
          throw handleServiceError(error, this.serviceName, methodName, '文件段落');
      }
  }

  async updateSegment(segmentId: string, updateData: Partial<ISegment>): Promise<ISegment> {
    const methodName = 'updateSegment';
    validateId(segmentId, '段落');
    if (!updateData || Object.keys(updateData).length === 0) {
        throw new ValidationError('缺少更新数据');
    }
    // Prevent updating critical fields directly if needed
    // delete updateData.fileId; 
    // delete updateData.index;
    try {
      // Ensure updatedAt is updated
      updateData.updatedAt = new Date(); 
      
      const updatedSegment = await Segment.findByIdAndUpdate(
          segmentId, 
          { $set: updateData }, 
          { new: true, runValidators: true } // Return updated doc, run schema validators
      ).exec();
      
      validateEntityExists(updatedSegment, '段落');
      return updatedSegment;
    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName} for segment ${segmentId}:`, error);
      throw handleServiceError(error, this.serviceName, methodName, '段落');
    }
  }
  
  // Add delete method if required later
  // async deleteSegmentsByFileId(fileId: string): Promise<{ deletedCount: number }> { ... }
} 