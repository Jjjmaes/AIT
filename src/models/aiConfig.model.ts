import mongoose, { Schema, Document, Types } from 'mongoose';
import { IUser } from './user.model'; // Assuming IUser might be referenced
// Remove local enum definition
// export enum AIProvider {
//     OPENAI = 'openai',
//     GOOGLE = 'google',
//     DEEPSEEK = 'deepseek',
//     GROK = 'grok'
// }

// Import the canonical AIProvider enum
import { AIProvider } from '../services/ai-provider.manager';

export interface IAIProviderConfig extends Document {
    providerName: AIProvider; // Use the imported enum
    apiKey: string; // Sensitive: Consider encryption at rest or env vars
    baseURL?: string;
    models: string[]; // List of available model names for this provider/key
    defaultModel?: string;
    defaultParams?: Record<string, any>; // e.g., { temperature: 0.7, maxTokens: 1000 }
    isActive: boolean;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

const aiProviderConfigSchema = new Schema<IAIProviderConfig>(
    {
        providerName: {
            type: String,
            required: true,
            trim: true,
            // Consider enum: Object.values(AIProvider) later
        },
        apiKey: {
            type: String,
            required: [true, 'API Key is required'],
            trim: true,
            // TODO: Implement encryption or better secure storage mechanism
        },
        baseURL: {
            type: String,
            trim: true,
        },
        models: {
            type: [String],
            required: [true, 'At least one model name is required'],
            validate: {
                validator: (v: string[]) => v.length > 0,
                message: 'Model list cannot be empty'
            }
        },
        defaultModel: {
            type: String,
            trim: true,
            // TODO: Add validation to ensure it's one of the models in the array
        },
        defaultParams: {
            type: Schema.Types.Mixed,
            default: {},
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        notes: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

// Index for faster lookups if needed
aiProviderConfigSchema.index({ providerName: 1 });
aiProviderConfigSchema.index({ isActive: 1 });

export const AIProviderConfig = mongoose.model<IAIProviderConfig>('AIProviderConfig', aiProviderConfigSchema); 