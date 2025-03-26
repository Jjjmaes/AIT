import { BaseAIServiceAdapter } from '../../../../services/translation/ai-adapters/base.adapter';
import { AIServiceConfig, AIProvider } from '../../../../types/ai-service.types';
import { TranslationOptions } from '../../../../types/translation.types';

// 创建测试用的适配器类
class TestAdapter extends BaseAIServiceAdapter {
  async translateText(sourceText: string, options: TranslationOptions): Promise<any> {
    throw new Error('Method not implemented.');
  }

  async validateApiKey(): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  async getAvailableModels(): Promise<any[]> {
    throw new Error('Method not implemented.');
  }

  async getModelInfo(modelId: string): Promise<any> {
    throw new Error('Method not implemented.');
  }

  async getPricing(modelId: string): Promise<{ input: number; output: number }> {
    throw new Error('Method not implemented.');
  }
}

describe('BaseAIServiceAdapter', () => {
  let adapter: TestAdapter;
  let mockConfig: AIServiceConfig;

  beforeEach(() => {
    mockConfig = {
      provider: AIProvider.OPENAI,
      apiKey: 'test-api-key',
      model: 'gpt-4'
    };
    adapter = new TestAdapter(mockConfig);
  });

  describe('createError', () => {
    it('should create error with correct format', () => {
      const error = adapter['createError']('TEST_ERROR', 'Test error message', { details: 'test' });

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Test error message');
      expect((error as any).code).toBe('TEST_ERROR');
      expect((error as any).provider).toBe(AIProvider.OPENAI);
      expect((error as any).details).toEqual({ details: 'test' });
    });
  });

  describe('calculateWordCount', () => {
    it('should count words correctly', () => {
      const text = 'Hello world, this is a test.';
      const count = adapter['calculateWordCount'](text);
      expect(count).toBe(6);
    });

    it('should handle empty string', () => {
      const count = adapter['calculateWordCount']('');
      expect(count).toBe(0);
    });

    it('should handle string with multiple spaces', () => {
      const text = 'Hello   world    test';
      const count = adapter['calculateWordCount'](text);
      expect(count).toBe(3);
    });
  });

  describe('calculateCharacterCount', () => {
    it('should count characters correctly', () => {
      const text = 'Hello, world!';
      const count = adapter['calculateCharacterCount'](text);
      expect(count).toBe(13);
    });

    it('should handle empty string', () => {
      const count = adapter['calculateCharacterCount']('');
      expect(count).toBe(0);
    });
  });

  describe('buildPrompt', () => {
    it('should build basic prompt', async () => {
      const sourceText = 'Hello, world!';
      const options: TranslationOptions = {
        sourceLanguage: 'en',
        targetLanguage: 'zh'
      };

      const prompt = await adapter['buildPrompt'](sourceText, options);

      expect(prompt).toContain('Translate the following text from en to zh');
      expect(prompt).toContain('Hello, world!');
    });

    it('should include formatting preservation when requested', async () => {
      const sourceText = 'Hello, world!';
      const options: TranslationOptions = {
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        preserveFormatting: true
      };

      const prompt = await adapter['buildPrompt'](sourceText, options);

      expect(prompt).toContain('Please preserve all formatting');
    });

    it('should include terminology usage when requested', async () => {
      const sourceText = 'Hello, world!';
      const options: TranslationOptions = {
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        useTerminology: true
      };

      const prompt = await adapter['buildPrompt'](sourceText, options);

      expect(prompt).toContain('Please use the provided terminology');
    });

    it('should combine all options', async () => {
      const sourceText = 'Hello, world!';
      const options: TranslationOptions = {
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        preserveFormatting: true,
        useTerminology: true
      };

      const prompt = await adapter['buildPrompt'](sourceText, options);

      expect(prompt).toContain('Please preserve all formatting');
      expect(prompt).toContain('Please use the provided terminology');
      expect(prompt).toContain('Hello, world!');
    });
  });
}); 