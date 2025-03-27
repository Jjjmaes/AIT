"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileController = void 0;
const file_service_1 = __importDefault(require("../services/file.service"));
const file_model_1 = require("../models/file.model");
const segment_model_1 = require("../models/segment.model");
const errors_1 = require("../utils/errors");
class FileController {
    constructor() {
        /**
         * 处理文件分段
         */
        this.processFile = async (req, res, next) => {
            try {
                const { fileId } = req.params;
                const options = req.body;
                await file_service_1.default.processFile(fileId, options);
                res.json({ message: '文件处理成功' });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * 获取文件分段列表
         */
        this.getFileSegments = async (req, res, next) => {
            try {
                const { fileId } = req.params;
                const { page = 1, limit = 50, status } = req.query;
                const file = await file_model_1.File.findById(fileId);
                if (!file) {
                    throw new errors_1.NotFoundError('文件不存在');
                }
                // 构建查询条件
                const query = { fileId };
                if (status) {
                    query.status = status;
                }
                // 获取分页数据
                const skip = (Number(page) - 1) * Number(limit);
                const segments = await segment_model_1.Segment.find(query)
                    .sort({ order: 1 })
                    .skip(skip)
                    .limit(Number(limit));
                // 获取总数
                const total = await segment_model_1.Segment.countDocuments(query);
                res.json({
                    segments,
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    status: file.status
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * 更新文件进度
         */
        this.updateFileProgress = async (req, res, next) => {
            try {
                const { fileId } = req.params;
                const { status, error } = req.body;
                const file = await file_model_1.File.findById(fileId);
                if (!file) {
                    throw new errors_1.NotFoundError('文件不存在');
                }
                if (status) {
                    if (!Object.values(file_model_1.FileStatus).includes(status)) {
                        throw new errors_1.ValidationError('无效的文件状态');
                    }
                    file.status = status;
                }
                if (error) {
                    file.error = error;
                }
                await file.save();
                res.json({ message: '文件进度更新成功' });
            }
            catch (error) {
                next(error);
            }
        };
    }
}
exports.FileController = FileController;
exports.default = new FileController();
