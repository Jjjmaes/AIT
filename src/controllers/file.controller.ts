import { Request, Response, NextFunction } from 'express';
import fileService from '../services/file.service';
import { File, FileStatus } from '../models/file.model';
import { Segment } from '../models/segment.model';
import { NotFoundError, ValidationError } from '../utils/errors';

export class FileController {
  /**
   * 处理文件分段
   */
  processFile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileId } = req.params;
      const options = req.body;

      await fileService.processFile(fileId, options);
      res.json({ message: '文件处理成功' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 获取文件分段列表
   */
  getFileSegments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileId } = req.params;
      const { page = 1, limit = 50, status } = req.query;

      const file = await File.findById(fileId);
      if (!file) {
        throw new NotFoundError('文件不存在');
      }

      // 构建查询条件
      const query: any = { fileId };
      if (status) {
        query.status = status;
      }

      // 获取分页数据
      const skip = (Number(page) - 1) * Number(limit);
      const segments = await Segment.find(query)
        .sort({ order: 1 })
        .skip(skip)
        .limit(Number(limit));

      // 获取总数
      const total = await Segment.countDocuments(query);

      res.json({
        segments,
        total,
        page: Number(page),
        limit: Number(limit),
        status: file.status
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 更新文件进度
   */
  updateFileProgress = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileId } = req.params;
      const { status, error } = req.body;

      const file = await File.findById(fileId);
      if (!file) {
        throw new NotFoundError('文件不存在');
      }

      if (status) {
        if (!Object.values(FileStatus).includes(status)) {
          throw new ValidationError('无效的文件状态');
        }
        file.status = status;
      }

      if (error) {
        file.error = error;
      }

      await file.save();
      res.json({ message: '文件进度更新成功' });
    } catch (error) {
      next(error);
    }
  };
}

export default new FileController(); 