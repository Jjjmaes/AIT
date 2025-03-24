import mongoose, { Document, Schema } from 'mongoose';
import { IUser } from './user.model';

export enum PromptType {
  TRANSLATION = 'translation',
  REVIEW = 'review'
}

export enum PromptStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived'
}

export interface IPromptTemplate extends Document {
  name: string;
  description?: string;
  type: PromptType;
  systemInstruction: string;
  userInputTemplate: string;
  outputFormat?: string;
  variables: string[];
  sourceLanguages: string[];
  targetLanguages: string[];
  domains: string[];
  creator: mongoose.Types.ObjectId | IUser;
  status: PromptStatus;
  version: number;
  aiProvider: string;
  aiModel: string;
  parentTemplate?: mongoose.Types.ObjectId;
  usageCount: number;
  performanceMetrics?: {
    acceptanceRate?: number;
    averageModificationRate?: number;
    averageTokenUsage?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const PromptTemplateSchema: Schema = new Schema({
  name: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String 
  },
  type: { 
    type: String, 
    enum: Object.values(PromptType),
    required: true 
  },
  systemInstruction: { 
    type: String, 
    required: true 
  },
  userInputTemplate: { 
    type: String, 
    required: true 
  },
  outputFormat: { 
    type: String 
  },
  variables: [{ 
    type: String 
  }],
  sourceLanguages: [{ 
    type: String 
  }],
  targetLanguages: [{ 
    type: String 
  }],
  domains: [{ 
    type: String 
  }],
  creator: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  status: { 
    type: String, 
    enum: Object.values(PromptStatus),
    default: PromptStatus.DRAFT 
  },
  version: { 
    type: Number, 
    default: 1 
  },
  aiProvider: { 
    type: String, 
    required: true 
  },
  aiModel: { 
    type: String, 
    required: true 
  },
  parentTemplate: { 
    type: Schema.Types.ObjectId, 
    ref: 'PromptTemplate' 
  },
  usageCount: { 
    type: Number, 
    default: 0 
  },
  performanceMetrics: {
    acceptanceRate: { 
      type: Number 
    },
    averageModificationRate: { 
      type: Number 
    },
    averageTokenUsage: { 
      type: Number 
    }
  }
}, { 
  timestamps: true 
});

export default mongoose.model<IPromptTemplate>('PromptTemplate', PromptTemplateSchema);