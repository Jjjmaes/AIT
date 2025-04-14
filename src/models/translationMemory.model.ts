import mongoose, { Schema, Document, Types } from 'mongoose';
import { IUser } from './user.model'; // For createdBy
import { IProject } from './project.model'; // For context

// Interface describing a Translation Memory Entry document in MongoDB
export interface ITranslationMemoryEntry extends Document {
  sourceLanguage: string; // e.g., 'en'
  targetLanguage: string; // e.g., 'fr'
  sourceText: string;
  targetText: string;
  // Context - Linking to project helps filter relevant TMs
  project?: Types.ObjectId | IProject;
  // Optional: More granular context, like domain or filename?
  // domain?: string;
  createdBy?: Types.ObjectId | IUser;
  createdAt: Date;
  lastUsedAt?: Date;
  usageCount?: number;
  // Optional: Quality score assigned during review or based on source?
  // qualityScore?: number;
}

const TranslationMemorySchema: Schema = new Schema(
  {
    sourceLanguage: { type: String, required: true, index: true },
    targetLanguage: { type: String, required: true, index: true },
    sourceText: { type: String, required: true, index: 'text' }, // Index for text search
    targetText: { type: String, required: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    lastUsedAt: { type: Date },
    usageCount: { type: Number, default: 0 },
    // qualityScore: { type: Number, min: 0, max: 100 },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
    collection: 'translation_memory_entries'
  }
);

// Compound index for efficient lookups based on language and source text
// Consider adding project to the index if filtering by project is common
TranslationMemorySchema.index({ sourceLanguage: 1, targetLanguage: 1, sourceText: 1, project: 1 });

export const TranslationMemory = mongoose.model<ITranslationMemoryEntry>('TranslationMemory', TranslationMemorySchema);