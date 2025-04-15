// src/validators/projectValidator.ts

import { z } from 'zod';
// Remove unused imports if ProjectPriority and ProjectStatus are no longer needed here
// import { ProjectPriority } from '../types/project.types';
// import { ProjectStatus } from '../models/project.model';
import { mongoIdSchema, createEnumValidator } from './common';
import { ProjectStatus } from '../models/project.model'; // Keep if needed for Progress

// --- Remove validateCreateProject and validateUpdateProject --- 
/*
export const validateCreateProject = z.object({ ... });
export const validateUpdateProject = z.object({ ... });
*/

// --- Keep validateUpdateProjectProgress if still used --- 
export const validateUpdateProjectProgress = z.object({
  params: z.object({
    projectId: mongoIdSchema
  }),
  body: z.object({
    status: createEnumValidator(ProjectStatus)
      .optional(),
    progress: z.object({
      totalSegments: z.number()
        .optional(),
      translatedSegments: z.number()
        .optional(),
      reviewedSegments: z.number()
        .optional()
    })
      .optional()
  })
});