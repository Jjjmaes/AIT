"use strict";
// src/validators/projectValidator.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUpdateProjectProgress = void 0;
const zod_1 = require("zod");
// Remove unused imports if ProjectPriority and ProjectStatus are no longer needed here
// import { ProjectPriority } from '../types/project.types';
// import { ProjectStatus } from '../models/project.model';
const common_1 = require("./common");
const project_model_1 = require("../models/project.model"); // Keep if needed for Progress
// --- Remove validateCreateProject and validateUpdateProject --- 
/*
export const validateCreateProject = z.object({ ... });
export const validateUpdateProject = z.object({ ... });
*/
// --- Keep validateUpdateProjectProgress if still used --- 
exports.validateUpdateProjectProgress = zod_1.z.object({
    params: zod_1.z.object({
        projectId: common_1.mongoIdSchema
    }),
    body: zod_1.z.object({
        status: (0, common_1.createEnumValidator)(project_model_1.ProjectStatus)
            .optional(),
        progress: zod_1.z.object({
            totalSegments: zod_1.z.number()
                .optional(),
            translatedSegments: zod_1.z.number()
                .optional(),
            reviewedSegments: zod_1.z.number()
                .optional()
        })
            .optional()
    })
});
