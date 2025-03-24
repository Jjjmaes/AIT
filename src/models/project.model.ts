import mongoose, { Document, Schema } from 'mongoose';
import { IUser } from './user.model';

export enum ProjectStatus {
  DRAFT = 'draft',
  IN_PROGRESS = 'in_progress',
  REVIEW = 'review',
  COMPLETED = 'completed',
  ARCHIVED = 'archived'
}

export enum ProjectPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export interface IProject extends Document {
  name: string;
  description?: string;
  sourceLanguage: string;
  targetLanguage: string;
  manager: mongoose.Types.ObjectId | IUser;
  reviewers: mongoose.Types.ObjectId[] | IUser[];
  translationPromptTemplate: mongoose.Types.ObjectId;
  reviewPromptTemplate: mongoose.Types.ObjectId;
  deadline?: Date;
  status: ProjectStatus;
  priority: ProjectPriority;
  progress: {
    totalSegments: number;
    translatedSegments: number;
    reviewedSegments: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema: Schema = new Schema({
  name: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String 
  },
  sourceLanguage: { 
    type: String, 
    required: true 
  },
  targetLanguage: { 
    type: String, 
    required: true 
  },
  manager: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  reviewers: [{ 
    type: Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  translationPromptTemplate: { 
    type: Schema.Types.ObjectId, 
    ref: 'PromptTemplate',
    required: true 
  },
  reviewPromptTemplate: { 
    type: Schema.Types.ObjectId, 
    ref: 'PromptTemplate',
    required: true 
  },
  deadline: { 
    type: Date 
  },
  status: { 
    type: String, 
    enum: Object.values(ProjectStatus),
    default: ProjectStatus.DRAFT 
  },
  priority: { 
    type: String, 
    enum: Object.values(ProjectPriority),
    default: ProjectPriority.MEDIUM 
  },
  progress: {
    totalSegments: { 
      type: Number, 
      default: 0 
    },
    translatedSegments: { 
      type: Number, 
      default: 0 
    },
    reviewedSegments: { 
      type: Number, 
      default: 0 
    }
  }
}, { 
  timestamps: true 
});

export default mongoose.model<IProject>('Project', ProjectSchema);