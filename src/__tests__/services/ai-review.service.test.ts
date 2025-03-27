import { AIReviewService } from '../../services/ai-review.service';
import { AIServiceFactory } from '../../services/translation/ai-adapters';
import { AIProvider } from '../../types/ai-service.types';
import { ReviewScoreType, IssueType } from '../../models/segment.model';
import logger from '../../utils/logger';

// Mock dependencies
jest.mock('../../services/translation/ai-adapters');
jest.mock('../../utils/logger');

describe('AIReviewService', () => {
  let aiReviewService: AIReviewService;
  let mockReviewAdapter: any;
  let mockAIServiceFactory: any;
  
  const mockApiKey = 'test-api-key';
  const mockOriginalText = 'This is the original text in English.';
  const mockTranslatedText = '这是英文的原始文本。';
  
  const mockReviewResponse = {
    suggestedTranslation: '这是英语的原始文本。',
    issues: [
      {
        type: IssueType.TERMINOLOGY,
        description: 'Translation mistake for "English"',
        position: { start: 4, end: 6 },
        suggestion: '英语'
      }
    ],
    scores: [
      {
        type: ReviewScoreType.ACCURACY,
        score: 85,
        details: 'Good accuracy, minor terminology issues'
      },
      {
        type: ReviewScoreType.FLUENCY,
        score: 92,
        details: 'Natural flow in target language'
      }
    ],
    metadata: {
      provider: AIProvider.OPENAI,
      model: 'gpt-4',
      processingTime: 1200,
      confidence: 0.92,
      wordCount: 8,
      characterCount: 38,
      tokens: {
        input: 15,
        output: 20
      },
      modificationDegree: 0.15
    }
  };
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup the review adapter mock
    mockReviewAdapter = {
      reviewText: jest.fn().mockResolvedValue(mockReviewResponse)
    };
    
    // Setup the AIServiceFactory mock
    mockAIServiceFactory = {
      createReviewAdapter: jest.fn().mockReturnValue(mockReviewAdapter)
    };
    
    (AIServiceFactory.getInstance as jest.Mock).mockReturnValue(mockAIServiceFactory);
    
    // Create the service instance
    aiReviewService = new AIReviewService();
    
    // Set environment variables
    process.env.OPENAI_API_KEY = mockApiKey;
  });
  
  afterEach(() => {
    // Clean up environment variables
    delete process.env.OPENAI_API_KEY;
  });
  
  describe('reviewTranslation', () => {
    it('should throw error if no API key is provided', async () => {
      // Arrange
      delete process.env.OPENAI_API_KEY;
      
      // Act & Assert
      await expect(aiReviewService.reviewTranslation(
        mockOriginalText,
        mockTranslatedText,
        {
          sourceLanguage: 'en',
          targetLanguage: 'zh-CN'
        }
      )).rejects.toThrow('AI审校失败: 未配置API密钥');
    });
    
    it('should use correct default values when minimal options are provided', async () => {
      // Arrange
      const options = {
        sourceLanguage: 'en',
        targetLanguage: 'zh-CN'
      };
      
      // Act
      await aiReviewService.reviewTranslation(
        mockOriginalText,
        mockTranslatedText,
        options
      );
      
      // Assert
      expect(mockAIServiceFactory.createReviewAdapter).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: AIProvider.OPENAI,
          apiKey: mockApiKey,
          model: 'gpt-3.5-turbo',
          temperature: 0.3,
          maxTokens: 4000
        })
      );
      
      expect(mockReviewAdapter.reviewText).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceLanguage: 'en',
          targetLanguage: 'zh-CN',
          originalContent: mockOriginalText,
          translatedContent: mockTranslatedText
        })
      );
      
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Starting AI review using ${AIProvider.OPENAI} model gpt-3.5-turbo`)
      );
    });
    
    it('should use custom values when provided in options', async () => {
      // Arrange
      const options = {
        sourceLanguage: 'en',
        targetLanguage: 'zh-CN',
        provider: AIProvider.BAIDU,
        model: 'ernie-bot',
        apiKey: 'custom-api-key',
        customPrompt: 'Custom review prompt',
        requestedScores: [ReviewScoreType.ACCURACY, ReviewScoreType.FLUENCY],
        checkIssueTypes: [IssueType.TERMINOLOGY, IssueType.GRAMMAR],
        contextSegments: [
          {
            original: 'Context before',
            translation: '上下文之前'
          }
        ]
      };
      
      // Act
      await aiReviewService.reviewTranslation(
        mockOriginalText,
        mockTranslatedText,
        options
      );
      
      // Assert
      expect(mockAIServiceFactory.createReviewAdapter).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: AIProvider.BAIDU,
          apiKey: 'custom-api-key',
          model: 'ernie-bot'
        })
      );
      
      expect(mockReviewAdapter.reviewText).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceLanguage: 'en',
          targetLanguage: 'zh-CN',
          originalContent: mockOriginalText,
          translatedContent: mockTranslatedText,
          customPrompt: 'Custom review prompt',
          requestedScores: [ReviewScoreType.ACCURACY, ReviewScoreType.FLUENCY],
          checkIssueTypes: [IssueType.TERMINOLOGY, IssueType.GRAMMAR],
          contextSegments: [
            {
              original: 'Context before',
              translation: '上下文之前'
            }
          ]
        })
      );
      
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Starting AI review using ${AIProvider.BAIDU} model ernie-bot`)
      );
    });
    
    it('should handle and rethrow review adapter errors with custom message', async () => {
      // Arrange
      mockReviewAdapter.reviewText = jest.fn().mockRejectedValue(
        new Error('Adapter failure')
      );
      
      // Act & Assert
      await expect(aiReviewService.reviewTranslation(
        mockOriginalText,
        mockTranslatedText,
        {
          sourceLanguage: 'en',
          targetLanguage: 'zh-CN'
        }
      )).rejects.toThrow('AI审校失败: Adapter failure');
      
      expect(logger.error).toHaveBeenCalledWith(
        'AI review failed',
        expect.objectContaining({
          error: expect.any(Error)
        })
      );
    });
    
    it('should return the review response on successful review', async () => {
      // Act
      const result = await aiReviewService.reviewTranslation(
        mockOriginalText,
        mockTranslatedText,
        {
          sourceLanguage: 'en',
          targetLanguage: 'zh-CN'
        }
      );
      
      // Assert
      expect(result).toEqual(mockReviewResponse);
      expect(logger.info).toHaveBeenCalledWith(
        'AI review completed successfully'
      );
    });
  });
  
  describe('reviewText', () => {
    it('should call reviewTranslation with the same parameters', async () => {
      // Arrange
      const options = {
        sourceLanguage: 'en',
        targetLanguage: 'zh-CN',
        model: 'gpt-4',
        customPrompt: 'Test prompt'
      };
      
      // Spy on reviewTranslation
      const reviewTranslationSpy = jest.spyOn(
        aiReviewService,
        'reviewTranslation'
      ).mockResolvedValue(mockReviewResponse);
      
      // Act
      const result = await aiReviewService.reviewText(
        mockOriginalText,
        mockTranslatedText,
        options
      );
      
      // Assert
      expect(reviewTranslationSpy).toHaveBeenCalledWith(
        mockOriginalText,
        mockTranslatedText,
        options
      );
      
      expect(result).toEqual(mockReviewResponse);
      
      // Restore the spy
      reviewTranslationSpy.mockRestore();
    });
  });
}); 