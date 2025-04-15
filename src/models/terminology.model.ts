import mongoose, { Schema, Document, Types } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2'; // Import pagination plugin
import { IUser } from './user.model';
import { IProject } from './project.model';

// Interface for a single term entry
export interface ITermEntry {
  source: string;
  target: string;
  domain?: string; // Optional domain specific to the term
  notes?: string;  // Optional notes about the term usage
  createdBy: Types.ObjectId | IUser; // User who added the term
  createdAt: Date;                // When the term was added
  lastModifiedBy?: Types.ObjectId | IUser; // User who last modified
  lastModifiedAt?: Date;               // When the term was last modified
}

// Interface representing a language pair for the terminology
export interface ITerminologyLanguagePair {
  source: string; // Language code (e.g., 'en', 'fr')
  target: string; // Language code
}

// Interface describing a Terminology document in MongoDB
export interface ITerminology extends Document {
  name: string;
  description?: string;
  languagePairs: ITerminologyLanguagePair[]; // Should have at least one
  terms: ITermEntry[];
  project?: Types.ObjectId | IProject; // Optional link to a specific project
  createdBy: Types.ObjectId | IUser; // User who created the terminology
  isPublic: boolean;         // Whether the terminology is available publicly
  createdAt: Date;
  updatedAt: Date;
}

// Mongoose Schema for individual term entries (to be embedded)
const TermEntrySchema = new Schema<ITermEntry>(
  {
    source: {
      type: String,
      required: [true, '源术语不能为空'],
      trim: true
    },
    target: {
      type: String,
      required: [true, '目标术语不能为空'],
      trim: true
    },
    domain: {
      type: String,
      trim: true,
      lowercase: true
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, '术语备注不能超过500个字符']
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    lastModifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    lastModifiedAt: {
      type: Date
    }
  },
  { _id: false }
);

// Mongoose Schema for Terminology lists
const TerminologySchema = new Schema<ITerminology>(
  {
    name: {
      type: String,
      required: [true, '术语表名称不能为空'],
      trim: true,
      maxlength: [100, '术语表名称不能超过100个字符'],
      index: true
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, '术语表描述不能超过500个字符']
    },
    languagePairs: [
      {
        source: { type: String, required: true, trim: true, lowercase: true },
        target: { type: String, required: true, trim: true, lowercase: true },
        _id: false
      }
    ],
    terms: [TermEntrySchema],
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      index: true,
      default: null
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    isPublic: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Validation: Ensure at least one language pair is provided
TerminologySchema.path('languagePairs').validate(function(value) {
  return value && value.length > 0;
}, '术语表必须至少指定一个语言对');

// Indexing for common query patterns
TerminologySchema.index({ createdBy: 1, name: 1 });
TerminologySchema.index({ project: 1 });
TerminologySchema.index({ isPublic: 1 });

// Apply the pagination plugin
TerminologySchema.plugin(mongoosePaginate);

// Export the Mongoose model
export const Terminology = mongoose.model<ITerminology>('Terminology', TerminologySchema);
