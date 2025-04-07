import mongoose, { Schema, Document, Types } from 'mongoose';
import { IUser } from './user.model'; // Assuming user model exists for createdBy

// Enum for the task type the prompt is designed for
export enum PromptTaskType {
  TRANSLATION = 'translation',
  REVIEW = 'review'
}

// Interface representing a language pair for the template
export interface IPromptLanguagePair {
  source: string; // Language code (e.g., 'en', 'fr')
  target: string; // Language code
}

// Interface describing a Prompt Template document in MongoDB
// Add export here
export interface IPromptTemplate extends Document {
  name: string;
  description?: string;
  systemInstruction: string; // The system prompt or instruction
  userPrompt: string;        // The user-facing prompt template (with placeholders like {{input}})
  domain?: string;           // Optional domain specification (e.g., 'medical', 'legal')
  languagePairs?: IPromptLanguagePair[]; // Specific language pairs this template is suitable for
  taskType: PromptTaskType;  // Specifies if it's for translation or review
  createdBy: Types.ObjectId | IUser; // User who created the template
  isPublic: boolean;         // Whether the template is available to others (based on permissions)
  createdAt: Date;
  updatedAt: Date;
}

// Mongoose Schema for Prompt Templates
const PromptTemplateSchema = new Schema<IPromptTemplate>(
  {
    name: {
      type: String,
      required: [true, '模板名称不能为空'],
      trim: true,
      maxlength: [100, '模板名称不能超过100个字符'],
      index: true
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, '模板描述不能超过500个字符']
    },
    systemInstruction: {
      type: String,
      required: [true, '系统指令不能为空'],
      trim: true
    },
    userPrompt: {
      type: String,
      required: [true, '用户提示模板不能为空'],
      trim: true
    },
    domain: {
      type: String,
      trim: true,
      lowercase: true,
      index: true
    },
    languagePairs: [
      {
        source: { type: String, required: true, trim: true, lowercase: true },
        target: { type: String, required: true, trim: true, lowercase: true },
        _id: false // Don't create separate IDs for language pairs in the array
      }
    ],
    taskType: {
      type: String,
      enum: Object.values(PromptTaskType),
      required: [true, '任务类型不能为空'],
      index: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User', // Reference to the User model
      required: true
    },
    isPublic: {
      type: Boolean,
      default: false, // Templates are private by default
      index: true
    }
  },
  {
    timestamps: true // Automatically add createdAt and updatedAt fields
  }
);

// Indexing for common query patterns
PromptTemplateSchema.index({ createdBy: 1, name: 1 });
PromptTemplateSchema.index({ taskType: 1, domain: 1, isPublic: 1 });

// Export the Mongoose model
export const PromptTemplate = mongoose.model<IPromptTemplate>('PromptTemplate', PromptTemplateSchema);
