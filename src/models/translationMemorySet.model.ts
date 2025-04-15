import mongoose, { Schema, Document, Types } from 'mongoose';
import { IUser } from './user.model'; // Assuming User model exists
import { IProject } from './project.model'; // Assuming Project model exists

// Represents a collection/database of translation memory entries
export interface ITranslationMemorySet extends Document {
  name: string;
  description?: string;
  sourceLanguage: string; // e.g., 'en-US'
  targetLanguage: string; // e.g., 'zh-CN'
  domain?: string; // e.g., 'technical', 'general'
  project?: Types.ObjectId | IProject; // Optional link to a project
  createdBy: Types.ObjectId | IUser;
  entryCount: number; // Cache the number of entries
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TranslationMemorySetSchema: Schema = new Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    description: { type: String, trim: true },
    sourceLanguage: { type: String, required: true, index: true },
    targetLanguage: { type: String, required: true, index: true },
    domain: { type: String, trim: true, default: 'general', index: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    entryCount: { type: Number, default: 0 },
    isPublic: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
    collection: 'translation_memory_sets' // Explicit collection name
  }
);

// Optional: Compound index for common lookups
TranslationMemorySetSchema.index({ sourceLanguage: 1, targetLanguage: 1, domain: 1 });

// TODO: Add pagination plugin if needed for listing sets
// TranslationMemorySetSchema.plugin(mongoosePaginate);

export const TranslationMemorySet = mongoose.model<ITranslationMemorySet>('TranslationMemorySet', TranslationMemorySetSchema);