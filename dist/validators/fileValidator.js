"use strict";
// src/validators/fileValidator.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUpdateFileProgress = exports.validateGetFileSegments = exports.validateProcessFile = exports.validateGetFiles = exports.validateUpdateFileStatus = exports.validateFileUpload = void 0;
const zod_1 = require("zod");
const file_model_1 = require("../models/file.model");
const common_1 = require("./common");
// 上传文件验证
exports.validateFileUpload = zod_1.z.object({
    body: zod_1.z.object({
        projectId: common_1.mongoIdSchema,
        type: (0, common_1.createEnumValidator)(file_model_1.FileType)
            .optional()
    })
});
// 更新文件状态验证
exports.validateUpdateFileStatus = zod_1.z.object({
    params: zod_1.z.object({
        fileId: common_1.mongoIdSchema
    }),
    body: zod_1.z.object({
        status: (0, common_1.createEnumValidator)(file_model_1.FileStatus)
    })
});
// 获取文件列表验证
exports.validateGetFiles = zod_1.z.object({
    query: zod_1.z.object({
        projectId: common_1.mongoIdSchema,
        status: (0, common_1.createEnumValidator)(file_model_1.FileStatus)
            .optional(),
        type: (0, common_1.createEnumValidator)(file_model_1.FileType)
            .optional()
    })
});
// 处理文件验证
exports.validateProcessFile = zod_1.z.object({
    params: zod_1.z.object({
        fileId: common_1.mongoIdSchema
    }),
    body: zod_1.z.object({
        segmentationOptions: zod_1.z.record(zod_1.z.unknown())
            .optional(),
        maxSegmentLength: zod_1.z.number()
            .int('段落最大长度必须是整数')
            .min(1, '段落最大长度必须大于0')
            .optional(),
        minSegmentLength: zod_1.z.number()
            .int('段落最小长度必须是整数')
            .min(1, '段落最小长度必须大于0')
            .optional(),
        preserveFormatting: zod_1.z.boolean()
            .optional()
    })
});
// 获取文件段落验证
exports.validateGetFileSegments = zod_1.z.object({
    params: zod_1.z.object({
        fileId: common_1.mongoIdSchema
    }),
    query: zod_1.z.intersection(common_1.paginationSchema, zod_1.z.object({
        status: zod_1.z.string()
            .optional()
    }))
});
// 更新文件进度验证
exports.validateUpdateFileProgress = zod_1.z.object({
    params: zod_1.z.object({
        fileId: common_1.mongoIdSchema
    }),
    body: zod_1.z.object({
        status: (0, common_1.createEnumValidator)(file_model_1.FileStatus)
            .optional(),
        error: zod_1.z.string()
            .optional()
    })
});
