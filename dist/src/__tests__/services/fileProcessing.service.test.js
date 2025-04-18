"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const fileProcessing_service_1 = require("../../services/fileProcessing.service");
const file_model_1 = require("../../models/file.model"); // Types only
const segment_model_1 = require("../../models/segment.model"); // Types only
const fileProcessor_factory_1 = require("../../services/fileProcessing/fileProcessor.factory");
const logger_1 = __importDefault(require("../../utils/logger"));
const globals_1 = require("@jest/globals");
// --- Mock Mongoose Directly (Self-Contained Factory) ---
globals_1.jest.mock('mongoose', () => {
    const originalMongoose = globals_1.jest.requireActual('mongoose');
    // --- Create ALL mocks LOCALLY within the factory ---
    const mockFileFindByIdExec = globals_1.jest.fn();
    const mockSegmentDeleteMany = globals_1.jest.fn();
    const mockSegmentInsertMany = globals_1.jest.fn();
    const mockFileSave = globals_1.jest.fn(); // Create save mock HERE
    // Mock the instance save method directly on the prototype using the LOCAL mock
    originalMongoose.Model.prototype.save = mockFileSave;
    const FileMock = {
        findById: globals_1.jest.fn().mockReturnValue({ exec: mockFileFindByIdExec }),
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
        model: globals_1.jest.fn().mockImplementation(((name) => {
            if (name === 'File')
                return FileMock;
            if (name === 'Segment')
                return SegmentMock;
            return globals_1.jest.fn();
        })),
    };
});
// --- Import the actual models (call to mongoose.model is intercepted) ---
const file_model_2 = require("../../models/file.model");
const segment_model_2 = require("../../models/segment.model");
// --- Mock Other Dependencies ---
globals_1.jest.mock('../../services/fileProcessing/fileProcessor.factory');
globals_1.jest.mock('../../utils/logger');
// --- Mock Variables (Processor related) ---
let mockGetProcessor;
let mockProcessor;
// Helper function remains the same
const createBaseFileProps = (props = {}) => ({
    _id: new mongoose_1.Types.ObjectId(),
    projectId: new mongoose_1.Types.ObjectId(),
    fileName: 'mock.txt',
    originalName: 'mock.txt',
    fileSize: 100,
    mimeType: 'text/plain',
    type: file_model_1.FileType.TXT,
    status: file_model_1.FileStatus.PENDING,
    uploadedBy: new mongoose_1.Types.ObjectId(),
    storageUrl: 'dummy/url',
    path: 'dummy/path',
    filePath: 'dummy/filePath',
    fileType: file_model_1.FileType.TXT,
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
});
// Array to capture state during save calls
let saveCallStates = [];
describe('FileProcessingService', () => {
    let service;
    const mockUserId = new mongoose_1.Types.ObjectId().toString();
    const mockFileId = new mongoose_1.Types.ObjectId().toString();
    // --- Access ALL attached mocks --- 
    const fileFindByIdExecMock = file_model_2.File._findByIdExecMock;
    const segmentDeleteManyMock = segment_model_2.Segment._deleteManyMock;
    const segmentInsertManyMock = segment_model_2.Segment._insertManyMock;
    const fileSaveMock = file_model_2.File._saveMock;
    beforeEach(() => {
        // Clear mocks
        fileFindByIdExecMock.mockClear();
        segmentDeleteManyMock.mockClear();
        segmentInsertManyMock.mockClear();
        fileSaveMock.mockClear();
        saveCallStates = []; // Clear captured states
        // Reset static method mocks
        file_model_2.File.findById.mockClear();
        file_model_2.File.findById.mockReturnValue({ exec: fileFindByIdExecMock });
        segment_model_2.Segment.deleteMany.mockClear();
        segment_model_2.Segment.insertMany.mockClear();
        // Clear other mocks
        logger_1.default.info.mockClear();
        logger_1.default.warn.mockClear();
        logger_1.default.error.mockClear();
        logger_1.default.debug.mockClear();
        fileProcessor_factory_1.FileProcessorFactory.getProcessor.mockClear();
        mockGetProcessor = fileProcessor_factory_1.FileProcessorFactory.getProcessor;
        mockProcessor = {
            extractSegments: globals_1.jest.fn(),
            writeTranslations: globals_1.jest.fn(),
        };
        service = fileProcessing_service_1.fileProcessingService;
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
        fileSaveMock.mockImplementation(async function () {
            saveCallStates.push({ ...this }); // Push a clone of current state
            return this; // Still return 'this' as per Mongoose behavior
        });
    });
    // --- Tests use top-level const mocks --- 
    test('should skip processing if file status is not PENDING or ERROR', async () => {
        const mockFileData = {
            ...createBaseFileProps({ _id: new mongoose_1.Types.ObjectId(mockFileId), status: file_model_1.FileStatus.TRANSLATED }),
        };
        // @ts-expect-error: Suppressing persistent 'never' type error
        fileFindByIdExecMock.mockResolvedValue(mockFileData);
        await service.processFile(mockFileId, mockUserId);
        expect(file_model_2.File.findById).toHaveBeenCalledWith(mockFileId);
        expect(fileFindByIdExecMock).toHaveBeenCalled();
        expect(logger_1.default.warn).toHaveBeenCalledWith(expect.stringContaining('Already processed or in progress'));
        expect(mockGetProcessor).not.toHaveBeenCalled();
        expect(fileSaveMock).not.toHaveBeenCalled(); // Check attached mock
    });
    test('should throw NotFoundError if file not found', async () => {
        // @ts-expect-error: Suppressing persistent 'never' type error
        fileFindByIdExecMock.mockResolvedValue(null);
        expect.assertions(3);
        try {
            await service.processFile(mockFileId, mockUserId);
        }
        catch (error) {
            // Assert error name instead of instance
            expect(error.name).toBe('NotFoundError');
            expect(error.message).toContain('不存在');
            expect(file_model_2.File.findById).toHaveBeenCalledWith(mockFileId);
        }
    });
    test('should throw AppError if file path is missing', async () => {
        const mockFileData = {
            ...createBaseFileProps({
                _id: new mongoose_1.Types.ObjectId(mockFileId),
                status: file_model_1.FileStatus.PENDING,
                filePath: null,
                fileType: file_model_1.FileType.XLIFF
            }),
            save: fileSaveMock
        };
        // @ts-expect-error: Suppressing persistent 'never' type error
        fileFindByIdExecMock.mockResolvedValue(mockFileData);
        expect.assertions(6);
        try {
            await service.processFile(mockFileId, mockUserId);
        }
        catch (error) {
            // Assert error name instead of instance
            expect(error.name).toBe('AppError');
            expect(error.message).toContain('File path is missing');
            expect(file_model_2.File.findById).toHaveBeenCalledWith(mockFileId);
            expect(fileFindByIdExecMock).toHaveBeenCalled(); // Check exec was called before error
            expect(fileSaveMock).toHaveBeenCalledTimes(1); // save should be called once
            expect(saveCallStates[0]?.status).toBe(file_model_1.FileStatus.ERROR); // Check state when save was called
        }
    });
    test('should successfully process an XLIFF file', async () => {
        const mockFileData = {
            ...createBaseFileProps({
                _id: new mongoose_1.Types.ObjectId(mockFileId),
                status: file_model_1.FileStatus.PENDING,
                fileType: file_model_1.FileType.XLIFF,
                filePath: 'dummy/test.xliff',
                originalName: 'test.xliff',
                metadata: null
            }),
            save: fileSaveMock
        };
        const extractedData = [
            { index: 0, sourceText: 'Hello', translation: 'Bonjour', status: segment_model_1.SegmentStatus.TRANSLATED },
            { index: 1, sourceText: 'World', status: segment_model_1.SegmentStatus.PENDING },
        ];
        const extractedMetadata = { sourceLanguage: 'en', targetLanguage: 'fr', original: 'original_from_xliff.txt' };
        // @ts-expect-error: Suppressing persistent 'never' type error
        fileFindByIdExecMock.mockResolvedValue(mockFileData);
        mockProcessor.extractSegments.mockResolvedValue({ segments: extractedData, metadata: extractedMetadata, segmentCount: extractedData.length });
        // @ts-expect-error: Suppressing signature mismatch for mockImplementation
        segmentInsertManyMock.mockImplementation(async (docs) => {
            return docs.map(d => ({ ...d, _id: new mongoose_1.Types.ObjectId() }));
        });
        await service.processFile(mockFileId, mockUserId);
        expect(file_model_2.File.findById).toHaveBeenCalledWith(mockFileId);
        expect(fileFindByIdExecMock).toHaveBeenCalled();
        expect(segment_model_2.Segment.deleteMany).toHaveBeenCalledWith({ fileId: mockFileData._id });
        expect(segment_model_2.Segment.insertMany).toHaveBeenCalledTimes(1);
        const insertManyArgs = segmentInsertManyMock.mock.calls[0]?.[0];
        expect(insertManyArgs).toEqual(expect.arrayContaining([
            expect.objectContaining({ index: 0, sourceText: 'Hello', status: segment_model_1.SegmentStatus.TRANSLATED }),
            expect.objectContaining({ index: 1, sourceText: 'World', status: segment_model_1.SegmentStatus.PENDING }),
        ]));
        expect(fileSaveMock).toHaveBeenCalledTimes(2);
        // Check the captured states for each save call
        expect(saveCallStates.length).toBe(2);
        const firstSaveState = saveCallStates[0];
        const secondSaveState = saveCallStates[1];
        expect(firstSaveState).toBeDefined();
        expect(secondSaveState).toBeDefined();
        expect(firstSaveState.status).toBe(file_model_1.FileStatus.PROCESSING);
        expect(secondSaveState.status).toBe(file_model_1.FileStatus.EXTRACTED);
        expect(secondSaveState.segmentCount).toBe(extractedData.length);
        expect(secondSaveState.processingStartedAt).toBeInstanceOf(Date);
        expect(secondSaveState.processingCompletedAt).toBeInstanceOf(Date);
        expect(secondSaveState.errorDetails).toBeUndefined();
        expect(secondSaveState.metadata).toEqual({ sourceLanguage: 'en', targetLanguage: 'fr', originalFilename: 'original_from_xliff.txt' });
        expect(logger_1.default.info).toHaveBeenCalledWith(expect.stringContaining('Successfully processed file ID'));
        expect(logger_1.default.error).not.toHaveBeenCalled();
    });
    test('should handle file with zero extracted segments', async () => {
        const mockFileData = {
            ...createBaseFileProps({
                _id: new mongoose_1.Types.ObjectId(mockFileId),
                status: file_model_1.FileStatus.PENDING,
                fileType: file_model_1.FileType.XLIFF,
                filePath: 'dummy/empty.xliff'
            }),
            save: fileSaveMock
        };
        // @ts-expect-error: Suppressing persistent 'never' type error
        fileFindByIdExecMock.mockResolvedValue(mockFileData);
        mockProcessor.extractSegments.mockResolvedValue({ segments: [], metadata: {}, segmentCount: 0 });
        await service.processFile(mockFileId, mockUserId);
        expect(file_model_2.File.findById).toHaveBeenCalledWith(mockFileId);
        expect(fileFindByIdExecMock).toHaveBeenCalled();
        expect(fileSaveMock).toHaveBeenCalledTimes(2);
        expect(segment_model_2.Segment.insertMany).not.toHaveBeenCalled();
        // Check captured state of the second save call
        expect(saveCallStates.length).toBe(2);
        const finalFileState = saveCallStates[1];
        expect(finalFileState).toBeDefined();
        expect(finalFileState.status).toBe(file_model_1.FileStatus.EXTRACTED);
        expect(finalFileState.segmentCount).toBe(0);
        expect(finalFileState.processingCompletedAt).toBeInstanceOf(Date);
        // Use the exact string for assertion
        const expectedLogMessage = `[FileProcessingService.processFile] No segments extracted or to save for file ${mockFileId}.`;
        expect(logger_1.default.info).toHaveBeenCalledWith(expectedLogMessage);
    });
    test('should set file status to ERROR if extractSegments fails', async () => {
        const mockFileData = {
            ...createBaseFileProps({
                _id: new mongoose_1.Types.ObjectId(mockFileId),
                status: file_model_1.FileStatus.PENDING,
                fileType: file_model_1.FileType.XLIFF,
                filePath: 'dummy/fail.xliff'
            }),
            save: fileSaveMock
        };
        const extractError = new Error('Processor failed');
        // @ts-expect-error: Suppressing persistent 'never' type error
        fileFindByIdExecMock.mockResolvedValue(mockFileData);
        mockProcessor.extractSegments.mockRejectedValue(extractError);
        expect.assertions(6);
        try {
            await service.processFile(mockFileId, mockUserId);
        }
        catch (error) {
            // Assert error name instead of instance
            expect(error.name).toBe('AppError');
            expect(error.message).toContain('Processor failed');
            expect(file_model_2.File.findById).toHaveBeenCalledWith(mockFileId);
            expect(fileFindByIdExecMock).toHaveBeenCalled(); // Check exec was called before error
            expect(fileSaveMock).toHaveBeenCalledTimes(2); // save called before and in catch
            expect(saveCallStates[1]?.status).toBe(file_model_1.FileStatus.ERROR); // Check state of second save call
        }
    });
});
