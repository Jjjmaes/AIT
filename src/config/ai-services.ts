import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

// 支持的AI服务提供商
export enum AIProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GROK = 'grok'
}

// 各服务提供商支持的模型列表
export const AIModels = {
  [AIProvider.OPENAI]: [
    'gpt-4',
    'gpt-4-turbo',
    'gpt-3.5-turbo',
  ],
  [AIProvider.ANTHROPIC]: [
    'claude-3-opus',
    'claude-3-sonnet',
    'claude-3-haiku',
  ],
  [AIProvider.GROK]: [
    'grok-1',
  ],
};

// 初始化AI服务客户端
export const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export const anthropicClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// 简单的AI服务工厂函数，根据提供商返回相应客户端
export const getAIClient = (provider: AIProvider) => {
  switch (provider) {
    case AIProvider.OPENAI:
      return openaiClient;
    case AIProvider.ANTHROPIC:
      return anthropicClient;
    default:
      throw new Error(`AI provider ${provider} not supported or not configured`);
  }
};

// AI调用参数配置接口
export interface AIRequestConfig {
  provider: AIProvider;
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  systemMessage?: string;
  userMessage: string;
}

// 统一的AI请求处理函数
export const callAIService = async (config: AIRequestConfig): Promise<string> => {
  const startTime = Date.now();
  
  try {
    switch (config.provider) {
      case AIProvider.OPENAI: {
        const response = await openaiClient.chat.completions.create({
          model: config.model,
          messages: [
            ...(config.systemMessage ? [{ role: 'system', content: config.systemMessage }] : []),
            { role: 'user', content: config.userMessage }
          ],
          temperature: config.temperature ?? 0.7,
          max_tokens: config.maxTokens,
          top_p: config.topP ?? 1,
        });
        
        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No content returned from OpenAI');
        }
        
        return content;
      }
      
      case AIProvider.ANTHROPIC: {
        const response = await anthropicClient.messages.create({
          model: config.model,
          system: config.systemMessage,
          messages: [
            { role: 'user', content: config.userMessage }
          ],
          temperature: config.temperature ?? 0.7,
          max_tokens: config.maxTokens,
          top_p: config.topP ?? 1,
        });
        
        const content = response.content[0]?.text;
        if (!content) {
          throw new Error('No content returned from Anthropic');
        }
        
        return content;
      }
      
      case AIProvider.GROK:
        // 待实现Grok API客户端
        throw new Error('Grok API integration not yet implemented');
      
      default:
        throw new Error(`Unsupported AI provider: ${config.provider}`);
    }
  } catch (error: any) {
    console.error(`AI service call failed: ${error.message}`);
    throw new Error(`AI service call failed: ${error.message}`);
  } finally {
    const endTime = Date.now();
    console.log(`AI call to ${config.provider}/${config.model} took ${endTime - startTime}ms`);
  }
};