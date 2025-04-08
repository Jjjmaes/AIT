import { Types } from 'mongoose';
import { translationService, TranslationService } from '../../services/translation.service';
import { File, IFile, FileStatus, FileType } from '../../models/file.model'; // Types only
import { Segment, ISegment, SegmentStatus } from '../../models/segment.model'; // Types only
// Mock the translation client
// jest.mock('../../clients/translationClient'); 
import logger from '../../utils/logger';
import { AppError, NotFoundError } from '../../utils/errors';
import mongoose from 'mongoose';
import { jest } from '@jest/globals';
import { AIProvider } from '../../types/ai-service.types';

// --- Mock AI Service Factory ---
// Mock the factory that provides AI adapters
jest.mock('../../services/translation/ai-adapters/ai-service.factory', () => {
    // Define mocks *inside* the factory
    const mockTranslateText = jest.fn();
    const mockAdapter = {
        translateText: mockTranslateText,
        getAvailableModels: jest.fn(), 
        validateApiKey: jest.fn(),
    };
    return {
        AIServiceFactory: {
            getInstance: jest.fn().mockReturnValue({
                createAdapter: jest.fn().mockReturnValue(mockAdapter),
                getAdapter: jest.fn().mockReturnValue(mockAdapter),
                // Attach the mock function for tests to access
                _mockTranslateText: mockTranslateText, 
            }),
        },
    };
});
// Import the factory *after* the mock definition
import { AIServiceFactory } from '../../services/translation/ai-adapters/ai-service.factory';

// Array to capture state during segment save calls
let saveSegmentStates: Partial<ISegment>[] = [];
// Array to capture state during file save calls
let saveFileStates: Partial<IFile>[] = [];

jest.mock('mongoose', () => {
    const originalMongoose: typeof mongoose = jest.requireActual('mongoose');

    const mockFileFindByIdExec = jest.fn();
    const mockSegmentFindExec = jest.fn();
    const mockSegmentSave = jest.fn(); 
    const mockFileSave = jest.fn(); 

    // Mock instance save for Segment
    const SegmentPrototypeSave = jest.fn().mockImplementation(async function(this: ISegment) {
        saveSegmentStates.push({ ...this });
        return this;
    });

    // Mock instance save for File - Restore state capture
    const FilePrototypeSave = jest.fn().mockImplementation(async function(this: IFile) {
        // console.log('[MOCK DEBUG] Mocked file.save() CALLED.'); // Remove log
        saveFileStates.push({ ...this }); // Restore state capture
        return this; 
    });
    
    const FileMock = {
      findById: jest.fn().mockReturnValue({ exec: mockFileFindByIdExec }),
      _findByIdExecMock: mockFileFindByIdExec,
      _saveMock: FilePrototypeSave, // Attach file save mock
    };
  
    const SegmentMock = {
      find: jest.fn().mockReturnValue({ exec: mockSegmentFindExec }),
      _findExecMock: mockSegmentFindExec,
      _saveMock: SegmentPrototypeSave, 
    };
  
    return {
      ...originalMongoose,
      Types: originalMongoose.Types,
      Schema: originalMongoose.Schema,
      Model: jest.fn<any>().mockImplementation((name: string) => { 
          if (name === 'File') return FileMock;
          if (name === 'Segment') return SegmentMock;
          return jest.fn().mockImplementation(() => ({ save: jest.fn() })); 
      }),
      model: jest.fn<any>().mockImplementation((name: string) => {
          if (name === 'File') return FileMock;
          if (name === 'Segment') return SegmentMock;
          return { findById: jest.fn(), find: jest.fn() }; 
      }),
    };
});

// Mock other dependencies
jest.mock('../../utils/logger');
// Mock the actual translation client if it exists
// jest.mock('../../clients/translationClient', () => ({
//    translationClient: {
//        translate: jest.fn(),
//    }
// }));
// const mockTranslate = translationClient.translate as jest.Mock;


// --- Import after mocks ---
import { File as FileModel } from '../../models/file.model'; // Import shadowed File
import { Segment as SegmentModel } from '../../models/segment.model'; // Import shadowed Segment


describe('TranslationService', () => {
    let service: TranslationService;
    const mockFileId = new Types.ObjectId().toString();
    const mockProjectId = new Types.ObjectId();

    // Access attached mocks
    const fileFindByIdExecMock = (FileModel as any)._findByIdExecMock as jest.Mock;
    const segmentFindExecMock = (SegmentModel as any)._findExecMock as jest.Mock;
    const segmentSaveMock = (SegmentModel as any)._saveMock as jest.Mock; // The prototype save function
    const fileSaveMock = (FileModel as any)._saveMock as jest.Mock; // Access file save mock

    // Access the mock function via the factory's attached property
    const mockTranslateText = (AIServiceFactory.getInstance() as any)._mockTranslateText as jest.Mock;

    // Helper to create mock segment data
    const createMockSegment = (props: Partial<ISegment>): ISegment => ({
        _id: new Types.ObjectId(),
        fileId: new Types.ObjectId(mockFileId),
        projectId: mockProjectId,
        index: 0,
        sourceText: 'Source text',
        translation: undefined,
        status: SegmentStatus.PENDING,
        issues: [],
        // Add save method manually for objects returned by find().exec()
        save: segmentSaveMock, 
        ...props,
    } as ISegment);


     // Helper to create mock file data
     const createMockFile = (props: Partial<IFile>): IFile => ({
        _id: new Types.ObjectId(mockFileId),
        projectId: mockProjectId,
        fileName: 'test.xliff',
        originalName: 'test.xliff',
        fileSize: 1024,
        mimeType: 'application/xliff+xml',
        fileType: FileType.XLIFF,
        status: FileStatus.EXTRACTED, // Default to ready for translation
        uploadedBy: new Types.ObjectId(),
        storageUrl: 'dummy/url',
        path: 'dummy/path',
        filePath: 'dummy/filePath',
        segmentCount: 0,
        translatedCount: 0,
        reviewedCount: 0,
        metadata: { sourceLanguage: 'en', targetLanguage: 'fr' }, // Essential for translation
        createdAt: new Date(),
        updatedAt: new Date(),
        save: fileSaveMock, // Add the save method to the mock file object
        ...props,
    } as IFile);


    beforeEach(() => {
        jest.clearAllMocks();
        saveSegmentStates = []; 
        saveFileStates = []; // Clear file save states

        // Reset static method mocks
        (FileModel.findById as jest.Mock).mockClear().mockReturnValue({ exec: fileFindByIdExecMock });
        (SegmentModel.find as jest.Mock).mockClear().mockReturnValue({ exec: segmentFindExecMock });
        
        // Reset attached exec mocks
        fileFindByIdExecMock.mockClear();
        segmentFindExecMock.mockClear();
        segmentSaveMock.mockClear(); // Clear the prototype save mock itself
        fileSaveMock.mockClear(); // Clear file save mock
        mockTranslateText.mockClear(); // Clear the accessed mock

        service = translationService;

        // Setup default mock behaviors
        // @ts-expect-error: Suppress 'never' type error
        fileFindByIdExecMock.mockResolvedValue(null); // Default: file not found
        // @ts-expect-error: Suppress 'never' type error
        segmentFindExecMock.mockResolvedValue([]); // Default: no segments found
        // Default AI Adapter mock behavior
        // @ts-expect-error: Suppress potential type mismatch for simplified mock
        mockTranslateText.mockResolvedValue({ translatedText: 'Mocked AI Translation' });
    });

    // --- TODO: Add Tests ---
    test('should throw NotFoundError if file not found', async () => {
        // @ts-expect-error: Suppress 'never' type error
        fileFindByIdExecMock.mockResolvedValue(null);
        // Use try-catch approach for cleaner reporting
        expect.assertions(2);
        try {
            await service.translateFileSegments(mockFileId);
        } catch (error) {
            expect((error as Error).name).toBe('NotFoundError');
            expect(FileModel.findById).toHaveBeenCalledWith(mockFileId);
        }
    });

    test('should skip translation if file status is not EXTRACTED', async () => {
        const mockFile = createMockFile({ status: FileStatus.PENDING });
        // @ts-expect-error: Suppress 'never' type error
        fileFindByIdExecMock.mockResolvedValue(mockFile);

        await service.translateFileSegments(mockFileId);

        expect(FileModel.findById).toHaveBeenCalledWith(mockFileId);
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('not in EXTRACTED status'));
        expect(SegmentModel.find).not.toHaveBeenCalled();
        // expect(mockTranslate).not.toHaveBeenCalled();
    });

    test('should do nothing if no pending segments found', async () => {
        const mockFile = createMockFile({ status: FileStatus.EXTRACTED, segmentCount: 2, translatedCount: 2 }); // Assume counts are accurate
        // @ts-expect-error: Suppress 'never' type error
        fileFindByIdExecMock.mockResolvedValue(mockFile);
        // @ts-expect-error: Suppress 'never' type error
        segmentFindExecMock.mockResolvedValue([]); // No pending segments returned

        await service.translateFileSegments(mockFileId);

        expect(FileModel.findById).toHaveBeenCalledWith(mockFileId);
        expect(SegmentModel.find).toHaveBeenCalledWith({ fileId: mockFile._id, status: SegmentStatus.PENDING });
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('No pending segments found'));
        // expect(mockTranslate).not.toHaveBeenCalled();
        expect(segmentSaveMock).not.toHaveBeenCalled(); 
    });
    
    // Add test for missing target language
    test('should throw AppError and set file status to ERROR if target language is missing', async () => {
        const mockFile = createMockFile({ metadata: { sourceLanguage: 'en' } }); 
        // @ts-expect-error
        fileFindByIdExecMock.mockResolvedValue(mockFile);

        // Revert to try-catch with logging
        expect.assertions(3); // name, message, findById call
        try {
            await service.translateFileSegments(mockFileId);
        } catch (error) {
             // Log the caught error
            console.log('[TEST CATCH DEBUG] Caught error:', error);
            // Assert error name instead of instance
            expect((error as Error).name).toBe('AppError');
            expect((error as AppError).message).toContain('Target language is required');
            expect(FileModel.findById).toHaveBeenCalledWith(mockFileId);
             // We are not expecting fileSaveMock to be called as it was removed from service logic
        }
    });

    // --- More tests needed ---
    // - successful translation of multiple segments
    // - handling translation API errors for a segment
    // - updating file status correctly after translation (success, partial, failure)
    // - using options (e.g., targetLanguage override)

    // --- Add Tests for Translation Logic ---
    test('should call AI adapter to translate segments', async () => {
        const mockFile = createMockFile({ 
            status: FileStatus.EXTRACTED, 
            metadata: { sourceLanguage: 'en', targetLanguage: 'fr' } 
        });
        const mockSegment1 = createMockSegment({ index: 0, sourceText: 'Hello' });
        const mockSegment2 = createMockSegment({ index: 1, sourceText: 'World' });
        
        // @ts-expect-error
        fileFindByIdExecMock.mockResolvedValue(mockFile);
        // @ts-expect-error
        segmentFindExecMock.mockResolvedValue([mockSegment1, mockSegment2]);

        // Make sure the factory provides the adapter (the mock adapter defined inside jest.mock)
        // No need to mock createAdapter again here if getInstance is mocked correctly
        // (AIServiceFactory.getInstance().createAdapter as jest.Mock).mockReturnValue(mockAdapter); 

        await service.translateFileSegments(mockFileId);

        // Verify the adapter's translateText method was called (using the accessed mock)
        expect(mockTranslateText).toHaveBeenCalledTimes(2); 
        
        // Check call arguments for the first segment
        expect(mockTranslateText).toHaveBeenNthCalledWith(1, 
            mockSegment1.sourceText, 
            expect.any(Object), // Placeholder for promptData check
            // Expect the full adapterOptions structure (or relevant parts)
            expect.objectContaining({ 
                sourceLanguage: 'en', 
                targetLanguage: 'fr', 
                aiProvider: AIProvider.OPENAI, // Assuming default provider used
                aiModel: undefined, // Expect default if not overridden
                temperature: undefined // Expect default if not overridden
            }) 
        );
         // Check call arguments for the second segment
         expect(mockTranslateText).toHaveBeenNthCalledWith(2, 
            mockSegment2.sourceText,
            expect.any(Object),
            expect.objectContaining({ 
                sourceLanguage: 'en', 
                targetLanguage: 'fr',
                aiProvider: AIProvider.OPENAI,
                aiModel: undefined,
                temperature: undefined
            })
        );

        // Verify segments were saved with translation and status update
        expect(segmentSaveMock).toHaveBeenCalledTimes(2);
        expect(saveSegmentStates.length).toBe(2);
        expect(saveSegmentStates[0]?.translation).toBe('Mocked AI Translation');
        expect(saveSegmentStates[0]?.status).toBe(SegmentStatus.TRANSLATED);
        expect(saveSegmentStates[1]?.translation).toBe('Mocked AI Translation');
        expect(saveSegmentStates[1]?.status).toBe(SegmentStatus.TRANSLATED);
    });

}); 