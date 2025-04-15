import mongoose, { Schema, Document } from 'mongoose';

// Enum for prompt types (optional but recommended)
export enum PromptTemplateType {
    TRANSLATION = 'translation',
    REVIEW = 'review',
    // Add other types as needed (e.g., summarization, terminology extraction)
}

// Enum for output formats (optional but recommended)
export enum OutputFormat {
    TEXT = 'text',
    MARKDOWN = 'markdown',
    JSON = 'json',
    // Add others like XML, YAML if needed
}

export interface IPromptTemplate extends Document {
    name: string;
    description: string;
    type: PromptTemplateType;
    content: string;
    outputFormat: string;
    variables: string[]; // e.g., ['sourceText', 'targetLang']
    modelIdentifier: string; // Identifier linking to AI Config + Model, e.g., "OpenAI-gpt-4"
    isActive: boolean;
    createdBy?: mongoose.Types.ObjectId; // Optional: Link to user who created it
    createdAt: Date;
    updatedAt: Date;
}

const promptTemplateSchema = new Schema<IPromptTemplate>(
    {
        name: {
            type: String,
            required: [true, 'Template name is required'],
            trim: true,
            unique: true, // Ensure names are unique
        },
        description: {
            type: String,
            required: [true, 'Template description is required'],
            trim: true,
        },
        type: {
            type: String,
            required: [true, 'Template type is required'],
            enum: Object.values(PromptTemplateType), // Use enum values
            default: PromptTemplateType.TRANSLATION,
        },
        content: {
            type: String,
            required: [true, 'Prompt content is required'],
            trim: true,
        },
        outputFormat: {
            type: String,
            required: [true, 'Output format description is required'],
            trim: true,
        },
        variables: {
            type: [String],
            default: [], // Default to empty array
        },
        modelIdentifier: {
            type: String,
            required: [true, 'AI model identifier is required'],
            trim: true,
            // Example: "OpenAI-gpt-4o", "Grok-grok-3-latest"
            // Validation could be added later to check against available AI models
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User', // Reference the User model if you have one
            // required: true, // Make required if needed
        },
    },
    {
        timestamps: true, // Adds createdAt and updatedAt automatically
    }
);

// Indexes for performance
promptTemplateSchema.index({ name: 1 });
promptTemplateSchema.index({ type: 1 });
promptTemplateSchema.index({ isActive: 1 });
promptTemplateSchema.index({ modelIdentifier: 1 });

export const PromptTemplate = mongoose.model<IPromptTemplate>('PromptTemplate', promptTemplateSchema);
