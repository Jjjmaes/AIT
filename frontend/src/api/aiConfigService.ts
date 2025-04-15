import api from './api'; // Assuming 'api' is your configured Axios instance

// Interface for AI Config data received from backend (excluding sensitive info like full API key)
export interface AIConfig {
    _id: string;
    providerName: string;
    baseURL?: string;
    models: string[];
    defaultModel?: string;
    defaultParams?: Record<string, any>;
    isActive: boolean;
    notes?: string;
    createdAt: string;
    updatedAt: string;
    // apiKey is intentionally omitted here for list views
}

// Interface for the detailed AI Config including API key (for edit forms, handle with care)
export interface AIConfigDetail extends AIConfig {
    apiKey: string; // Included for editing, mask in UI
}


// Interface for payload when creating/updating (matches backend)
export interface AIConfigPayload {
    providerName: string;
    apiKey: string; // Sent during create/update
    baseURL?: string;
    models: string[];
    defaultModel?: string;
    defaultParams?: Record<string, any>;
    isActive?: boolean;
    notes?: string;
}

// --- Response Types ---

export interface GetAllAIConfigsResponse {
    success: boolean;
    data?: { configs: AIConfig[] }; // List of configs (without API key)
    message?: string;
}

export interface GetAIConfigByIdResponse {
    success: boolean;
    data?: { config: AIConfigDetail }; // Single config detail (with API key)
    message?: string;
}

export interface CreateAIConfigResponse {
    success: boolean;
    data?: { config: AIConfig }; // Returns created config (without API key)
    message?: string;
}

export interface UpdateAIConfigResponse {
    success: boolean;
    data?: { config: AIConfig }; // Returns updated config (without API key)
    message?: string;
}

export interface DeleteAIConfigResponse {
    success: boolean;
    message?: string;
}


// --- API Functions ---

/**
 * Fetches all AI configurations (for admin).
 */
export const getAllAIConfigs = async (): Promise<GetAllAIConfigsResponse> => {
    const response = await api.get<GetAllAIConfigsResponse>('/ai-configs');
    return response.data;
};

/**
 * Fetches a single AI configuration by ID (for admin).
 * Includes the API key, handle carefully in the UI.
 */
export const getAIConfigById = async (configId: string): Promise<GetAIConfigByIdResponse> => {
    const response = await api.get<GetAIConfigByIdResponse>(`/ai-configs/${configId}`);
    return response.data;
};

/**
 * Creates a new AI configuration (for admin).
 */
export const createAIConfig = async (payload: AIConfigPayload): Promise<CreateAIConfigResponse> => {
    const response = await api.post<CreateAIConfigResponse>('/ai-configs', payload);
    return response.data;
};

/**
 * Updates an existing AI configuration (for admin).
 */
export const updateAIConfig = async (configId: string, payload: Partial<AIConfigPayload>): Promise<UpdateAIConfigResponse> => {
    const response = await api.put<UpdateAIConfigResponse>(`/ai-configs/${configId}`, payload);
    return response.data;
};

/**
 * Deletes an AI configuration (for admin).
 */
export const deleteAIConfig = async (configId: string): Promise<DeleteAIConfigResponse> => {
    const response = await api.delete<DeleteAIConfigResponse>(`/ai-configs/${configId}`);
    return response.data;
}; 