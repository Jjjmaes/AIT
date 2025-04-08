import { Types, Document } from 'mongoose';
import { FileProcessingService, fileProcessingService } from '../../services/fileProcessing.service';
import { IFile, FileStatus, FileType } from '../../models/file.model'; // Types only
import { ISegment, SegmentStatus } from '../../models/segment.model'; // Types only
import { FileProcessorFactory, SupportedFileType } from '../../services/fileProcessing/fileProcessor.factory';
import { IFileProcessor, ExtractedSegmentData } from '../../services/fileProcessing/types';
import logger from '../../utils/logger';
import { jest } from '@jest/globals';
import { AppError, NotFoundError } from '../../utils/errors';
import mongoose from 'mongoose'; // Import mongoose to mock it

// --- Mock Mongoose Directly (Self-Contained Factory) ---
jest.mock('mongoose', () => {
  const originalMongoose: typeof mongoose = jest.requireActual('mongoose');

  // --- Create ALL mocks LOCALLY within the factory ---
  const mockFileFindByIdExec = jest.fn();
  const mockSegmentDeleteMany = jest.fn();
  const mockSegmentInsertMany = jest.fn();
  const mockFileSave = jest.fn(); // Create save mock HERE

  // Mock the instance save method directly on the prototype using the LOCAL mock
  originalMongoose.Model.prototype.save = mockFileSave;

  const FileMock = {
    findById: jest.fn().mockReturnValue({ exec: mockFileFindByIdExec }),
    // Attach mocks for control
    _findByIdExecMock: mockFileFindByIdExec,
    _saveMock: mockFileSave, // Attach the save mock
  };

  const SegmentMock = {
    deleteMany: mockSegmentDeleteMany,
    insertMany: mockSegmentInsertMany,
    // Attach mocks for control
    _deleteManyMock: mockSegmentDeleteMany,
    _insertManyMock: mockSegmentInsertMany,
  };

  return {
    ...originalMongoose,
    Types: originalMongoose.Types,
    Schema: originalMongoose.Schema,
    Model: originalMongoose.Model,
    model: jest.fn().mockImplementation(((name: string) => {
      if (name === 'File') return FileMock;
      if (name === 'Segment') return SegmentMock;
      return jest.fn();
    }) as any),
  };
});

// --- Import the actual models (call to mongoose.model is intercepted) ---
import { File } from '../../models/file.model';
import { Segment } from '../../models/segment.model';

// --- Mock Other Dependencies ---
jest.mock('../../services/fileProcessing/fileProcessor.factory');
jest.mock('../../utils/logger');

// --- Mock Variables (Processor related) ---
let mockGetProcessor: jest.Mock;
let mockProcessor: jest.Mocked<IFileProcessor>;

// Helper function remains the same
const createBaseFileProps = (props: Partial<IFile> = {}): Omit<IFile, 'save'> => ({
    _id: new Types.ObjectId(),
    projectId: new Types.ObjectId(),
    fileName: 'mock.txt',
    originalName: 'mock.txt',
    fileSize: 100,
    mimeType: 'text/plain',
    type: FileType.TXT,
    status: FileStatus.PENDING,
    uploadedBy: new Types.ObjectId(),
    storageUrl: 'dummy/url',
    path: 'dummy/path',
    filePath: 'dummy/filePath',
    fileType: FileType.TXT,
    segmentCount: 0,
    translatedCount: 0,
    reviewedCount: 0,
    errorDetails: undefined,
    metadata: undefined,
    processingStartedAt: undefined,
    processingCompletedAt: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...props,
} as Omit<IFile, 'save'>);

// Array to capture state during save calls
let saveCallStates: Partial<IFile>[] = [];

describe('FileProcessingService', () => {
  let service: FileProcessingService;
  const mockUserId = new Types.ObjectId().toString();
  const mockFileId = new Types.ObjectId().toString();

  // --- Access ALL attached mocks --- 
  const fileFindByIdExecMock = (File as any)._findByIdExecMock as jest.Mock;
  const segmentDeleteManyMock = (Segment as any)._deleteManyMock as jest.Mock;
  const segmentInsertManyMock = (Segment as any)._insertManyMock as jest.Mock;
  const fileSaveMock = (File as any)._saveMock as jest.Mock;

  beforeEach(() => {
    // Clear mocks
    fileFindByIdExecMock.mockClear();
    segmentDeleteManyMock.mockClear();
    segmentInsertManyMock.mockClear();
    fileSaveMock.mockClear();
    saveCallStates = []; // Clear captured states
    // Reset static method mocks
    (File.findById as jest.Mock).mockClear();
    (File.findById as jest.Mock).mockReturnValue({ exec: fileFindByIdExecMock });
    (Segment.deleteMany as jest.Mock).mockClear();
    (Segment.insertMany as jest.Mock).mockClear();

    // Clear other mocks
    (logger.info as jest.Mock).mockClear();
    (logger.warn as jest.Mock).mockClear();
    (logger.error as jest.Mock).mockClear();
    (logger.debug as jest.Mock).mockClear();
    (FileProcessorFactory.getProcessor as jest.Mock).mockClear();

    mockGetProcessor = FileProcessorFactory.getProcessor as jest.Mock;
    mockProcessor = {
      extractSegments: jest.fn(),
      writeTranslations: jest.fn<() => Promise<void>>(),
    };

    service = fileProcessingService;

    // Setup default mock behaviors
    // @ts-expect-error: Suppressing persistent 'never' type error
    fileFindByIdExecMock.mockResolvedValue(null);
    mockGetProcessor.mockReturnValue(mockProcessor);
    mockProcessor.extractSegments.mockResolvedValue({ segments: [], metadata: {}, segmentCount: 0 });
    // @ts-expect-error: Suppressing persistent 'never' type error
    segmentDeleteManyMock.mockResolvedValue({ acknowledged: true, deletedCount: 0 });
    // @ts-expect-error: Suppressing persistent 'never' type error
    segmentInsertManyMock.mockResolvedValue([]);
    // Save mock captures state into saveCallStates
    fileSaveMock.mockImplementation(async function(this: IFile) { 
      saveCallStates.push({ ...this }); // Push a clone of current state
      return this; // Still return 'this' as per Mongoose behavior
    }); 
  });

  // --- Tests use top-level const mocks --- 

  test('should skip processing if file status is not PENDING or ERROR', async () => {
    const mockFileData = {
        ...createBaseFileProps({ _id: new Types.ObjectId(mockFileId), status: FileStatus.TRANSLATED }),
    };
    // @ts-expect-error: Suppressing persistent 'never' type error
    fileFindByIdExecMock.mockResolvedValue(mockFileData as IFile);

    await service.processFile(mockFileId, mockUserId);

    expect(File.findById).toHaveBeenCalledWith(mockFileId);
    expect(fileFindByIdExecMock).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Already processed or in progress'));
    expect(mockGetProcessor).not.toHaveBeenCalled();
    expect(fileSaveMock).not.toHaveBeenCalled(); // Check attached mock
  });

   test('should throw NotFoundError if file not found', async () => {
    // @ts-expect-error: Suppressing persistent 'never' type error
    fileFindByIdExecMock.mockResolvedValue(null);
    expect.assertions(3); 
    try {
      await service.processFile(mockFileId, mockUserId);
    } catch (error) {
      // Assert error name instead of instance
      expect((error as Error).name).toBe('NotFoundError');
      expect((error as NotFoundError).message).toContain('不存在'); 
      expect(File.findById).toHaveBeenCalledWith(mockFileId);
    }
   });

   test('should throw AppError if file path is missing', async () => {
      const mockFileData = {
        ...createBaseFileProps({
          _id: new Types.ObjectId(mockFileId),
           status: FileStatus.PENDING,
          filePath: null as any,
          fileType: FileType.XLIFF
        }),
        save: fileSaveMock 
      };
      // @ts-expect-error: Suppressing persistent 'never' type error
      fileFindByIdExecMock.mockResolvedValue(mockFileData as IFile);

      expect.assertions(6);
      try {
        await service.processFile(mockFileId, mockUserId);
      } catch (error) {
          // Assert error name instead of instance
          expect((error as Error).name).toBe('AppError');
          expect((error as AppError).message).toContain('File path is missing');
          expect(File.findById).toHaveBeenCalledWith(mockFileId);
          expect(fileFindByIdExecMock).toHaveBeenCalled(); // Check exec was called before error
          expect(fileSaveMock).toHaveBeenCalledTimes(1); // save should be called once
          expect(saveCallStates[0]?.status).toBe(FileStatus.ERROR); // Check state when save was called
      }
  });

  test('should successfully process an XLIFF file', async () => {
    const mockFileData = {
        ...createBaseFileProps({
      _id: new Types.ObjectId(mockFileId),
      status: FileStatus.PENDING,
            fileType: FileType.XLIFF,
      filePath: 'dummy/test.xliff',
      originalName: 'test.xliff',
            metadata: null as any
        }),
       save: fileSaveMock 
    };

    const extractedData: ExtractedSegmentData[] = [
      { index: 0, sourceText: 'Hello', translation: 'Bonjour', status: SegmentStatus.TRANSLATED },
      { index: 1, sourceText: 'World', status: SegmentStatus.PENDING },
    ];
    const extractedMetadata = { sourceLanguage: 'en', targetLanguage: 'fr', original: 'original_from_xliff.txt' };

    // @ts-expect-error: Suppressing persistent 'never' type error
    fileFindByIdExecMock.mockResolvedValue(mockFileData as IFile);
    mockProcessor.extractSegments.mockResolvedValue({ segments: extractedData, metadata: extractedMetadata, segmentCount: extractedData.length });
    // @ts-expect-error: Suppressing signature mismatch for mockImplementation
    segmentInsertManyMock.mockImplementation(async (docs: any[]) => {
        return docs.map(d => ({ ...d, _id: new Types.ObjectId() })) as ISegment[];
    });

    await service.processFile(mockFileId, mockUserId);

    expect(File.findById).toHaveBeenCalledWith(mockFileId);
    expect(fileFindByIdExecMock).toHaveBeenCalled();
    expect(Segment.deleteMany).toHaveBeenCalledWith({ fileId: mockFileData._id });
    expect(Segment.insertMany).toHaveBeenCalledTimes(1);

    const insertManyArgs = segmentInsertManyMock.mock.calls[0]?.[0];
    expect(insertManyArgs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ index: 0, sourceText: 'Hello', status: SegmentStatus.TRANSLATED }),
        expect.objectContaining({ index: 1, sourceText: 'World', status: SegmentStatus.PENDING }),
      ])
    );

    expect(fileSaveMock).toHaveBeenCalledTimes(2);
    // Check the captured states for each save call
    expect(saveCallStates.length).toBe(2);
    const firstSaveState = saveCallStates[0];
    const secondSaveState = saveCallStates[1];
    expect(firstSaveState).toBeDefined();
    expect(secondSaveState).toBeDefined();
    expect(firstSaveState.status).toBe(FileStatus.PROCESSING);
    expect(secondSaveState.status).toBe(FileStatus.EXTRACTED);
    expect(secondSaveState.segmentCount).toBe(extractedData.length);
    expect(secondSaveState.processingStartedAt).toBeInstanceOf(Date);
    expect(secondSaveState.processingCompletedAt).toBeInstanceOf(Date);
    expect(secondSaveState.errorDetails).toBeUndefined();
    expect(secondSaveState.metadata).toEqual({ sourceLanguage: 'en', targetLanguage: 'fr', originalFilename: 'original_from_xliff.txt' });

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Successfully processed file ID'));
    expect(logger.error).not.toHaveBeenCalled();
  });

  test('should handle file with zero extracted segments', async () => {
     const mockFileData = {
        ...createBaseFileProps({
       _id: new Types.ObjectId(mockFileId),
       status: FileStatus.PENDING,
            fileType: FileType.XLIFF,
            filePath: 'dummy/empty.xliff'
        }),
        save: fileSaveMock 
    };
     // @ts-expect-error: Suppressing persistent 'never' type error
     fileFindByIdExecMock.mockResolvedValue(mockFileData as IFile);
     mockProcessor.extractSegments.mockResolvedValue({ segments: [], metadata: {}, segmentCount: 0 });

     await service.processFile(mockFileId, mockUserId);

     expect(File.findById).toHaveBeenCalledWith(mockFileId);
     expect(fileFindByIdExecMock).toHaveBeenCalled();
     expect(fileSaveMock).toHaveBeenCalledTimes(2);
     expect(Segment.insertMany).not.toHaveBeenCalled();

     // Check captured state of the second save call
     expect(saveCallStates.length).toBe(2);
     const finalFileState = saveCallStates[1]; 
     expect(finalFileState).toBeDefined();
     expect(finalFileState.status).toBe(FileStatus.EXTRACTED);
     expect(finalFileState.segmentCount).toBe(0);
     expect(finalFileState.processingCompletedAt).toBeInstanceOf(Date);

     // Use the exact string for assertion
     const expectedLogMessage = `[FileProcessingService.processFile] No segments extracted or to save for file ${mockFileId}.`;
     expect(logger.info).toHaveBeenCalledWith(expectedLogMessage);
   });

  test('should set file status to ERROR if extractSegments fails', async () => {
    const mockFileData = {
        ...createBaseFileProps({
      _id: new Types.ObjectId(mockFileId),
      status: FileStatus.PENDING,
            fileType: FileType.XLIFF,
            filePath: 'dummy/fail.xliff'
        }),
        save: fileSaveMock 
    };
    const extractError = new Error('Processor failed');

    // @ts-expect-error: Suppressing persistent 'never' type error
    fileFindByIdExecMock.mockResolvedValue(mockFileData as IFile);
    mockProcessor.extractSegments.mockRejectedValue(extractError);

    expect.assertions(6); 
    try {
        await service.processFile(mockFileId, mockUserId);
    } catch (error) {
        // Assert error name instead of instance
        expect((error as Error).name).toBe('AppError');
        expect((error as AppError).message).toContain('Processor failed');
        expect(File.findById).toHaveBeenCalledWith(mockFileId);
        expect(fileFindByIdExecMock).toHaveBeenCalled(); // Check exec was called before error
        expect(fileSaveMock).toHaveBeenCalledTimes(2); // save called before and in catch
        expect(saveCallStates[1]?.status).toBe(FileStatus.ERROR); // Check state of second save call
    }
  });
});