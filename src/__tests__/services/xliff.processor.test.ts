import { XliffProcessor } from '../../services/fileProcessing/processors/xliff.processor';
import { ISegment, SegmentStatus } from '../../models/segment.model';
import { readFile, writeFile } from 'fs/promises';
import logger from '../../utils/logger';
import { jest } from '@jest/globals';
import { Types } from 'mongoose';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
// Use the global Node type if necessary, or find the correct import
// If using Node.js built-in types, you might not need an explicit import,
// or it might be part of a different module like 'typescript'.
// For now, let's assume the global Node type is sufficient or will be inferred.

// Mock dependencies (simple version)
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
}));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Add sample content here
const sampleStandardXliff = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file original="test.txt" source-language="en" target-language="fr" datatype="plaintext">
    <body>
      <trans-unit id="1">
        <source>Hello World</source>
        <target state="translated">Bonjour le monde</target>
      </trans-unit>
      <trans-unit id="2">
        <source>This is a test.</source>
        <target state="needs-review-translation">Ceci est un test.</target>
      </trans-unit>
      <trans-unit id="3">
        <source>Another segment.</source>
        <!-- No target yet -->
      </trans-unit>
      <trans-unit id="4">
         <source>Segment with <g id="1">inline</g> tag.</source>
         <target state="final">Segment avec tag <g id="1">inline</g>.</target>
      </trans-unit>
    </body>
  </file>
</xliff>`;

const sampleMemoQXliff = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2" xmlns:m="http://www.memoq.com/memoq/xliff">
 <file m:original="memoq_test.docx" m:source-language="en-US" m:target-language="de-DE" datatype="plaintext">
  <body>
   <m:trans-unit id="1" m:state="Translated">
    <m:source>Source text 1</m:source>
    <m:target state="translated">Zieltext 1</m:target>
   </m:trans-unit>
   <m:trans-unit id="2" m:state="Confirmed">
    <m:source>Source text 2</m:source>
    <m:target state="final">Zieltext 2</m:target>
   </m:trans-unit>
   <m:trans-unit id="3" m:state="NeedsTranslation">
     <m:source>Source text 3</m:source>
     <!-- No target -->
   </m:trans-unit>
  </body>
 </file>
</xliff>`;

const invalidXmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2">
  <file original="bad.txt">
    <body>
      <trans-unit id="1"><source>Valid source</source>
      <target>Unclosed target element
    </body> <!-- Missing closing tags -->
  </file>
</xliff>`;

const sampleXliffNoUnits = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
 <file original="empty.txt" source-language="en" target-language="ja" datatype="plaintext">
  <body>
    <!-- No trans-unit elements here -->
  </body>
 </file>
</xliff>`;

describe('XliffProcessor', () => {
  let processor: XliffProcessor;
  let mockReadFile: jest.Mock<() => Promise<string>>;
  let mockWriteFile: jest.Mock; // Use a general mock type

  beforeEach(() => {
    processor = new XliffProcessor();
    mockReadFile = readFile as unknown as jest.Mock<() => Promise<string>>;
    // Explicitly type mockWriteFile
    mockWriteFile = writeFile as unknown as jest.Mock<(...args: any[]) => Promise<void>>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('extractSegments', () => {
    test('should correctly parse a standard XLIFF 1.2 file', async () => {
      mockReadFile.mockResolvedValue(sampleStandardXliff);
      const filePath = 'dummy/standard.xliff';
      const result = await processor.extractSegments(filePath, { isMemoQ: false });

      expect(mockReadFile).toHaveBeenCalledWith(filePath, 'utf-8');
      expect(result.segmentCount).toBe(4);
      expect(result.metadata).toEqual({
        original: 'test.txt',
        sourceLanguage: 'en',
        targetLanguage: 'fr',
        datatype: 'plaintext',
      });

      // Check segments
      expect(result.segments).toHaveLength(4);
      
      // Segment 1: Translated
      expect(result.segments[0]).toMatchObject({
        index: 0,
        sourceText: 'Hello World',
        translation: 'Bonjour le monde',
        status: SegmentStatus.TRANSLATED,
        sourceLength: 11,
        translatedLength: 16,
        metadata: { 
          xliffId: '1',
          xliffState: 'translated'
        }
      });

      // Segment 2: Needs review (maps to TRANSLATED)
      expect(result.segments[1]).toMatchObject({
        index: 1,
        sourceText: 'This is a test.',
        translation: 'Ceci est un test.',
        status: SegmentStatus.TRANSLATED,
        metadata: { 
          xliffId: '2',
          xliffState: 'needs-review-translation' 
        }
      });

      // Segment 3: No target (maps to PENDING)
      expect(result.segments[2]).toMatchObject({
        index: 2,
        sourceText: 'Another segment.',
        translation: '', // No target text
        status: SegmentStatus.PENDING, 
        metadata: { 
          xliffId: '3',
          xliffState: null
        }
      });

      // Segment 4: Final (maps to COMPLETED), includes inline tag
      expect(result.segments[3]).toMatchObject({
        index: 3,
        sourceText: 'Segment with <g id="1" xmlns="urn:oasis:names:tc:xliff:document:1.2">inline</g> tag.',
        translation: 'Segment avec tag <g id="1" xmlns="urn:oasis:names:tc:xliff:document:1.2">inline</g>.',
        status: SegmentStatus.COMPLETED,
        metadata: { 
          xliffId: '4',
          xliffState: 'final' 
        }
      });
    });

    test('should correctly parse a MemoQ XLIFF file', async () => {
      mockReadFile.mockResolvedValue(sampleMemoQXliff);
      const filePath = 'dummy/memoq.mqxliff';
      
      // Pass isMemoQ: true option
      const result = await processor.extractSegments(filePath, { isMemoQ: true });

      expect(mockReadFile).toHaveBeenCalledWith(filePath, 'utf-8');
      expect(result.segmentCount).toBe(3);
      expect(result.metadata).toEqual({
        original: 'memoq_test.docx',
        sourceLanguage: 'en-US',
        targetLanguage: 'de-DE',
        datatype: 'plaintext',
      });

      expect(result.segments).toHaveLength(3);

      // Segment 1: Translated
      expect(result.segments[0]).toMatchObject({
        index: 0,
        sourceText: 'Source text 1',
        translation: 'Zieltext 1',
        status: SegmentStatus.TRANSLATED, // Maps from 'Translated' m:state and 'translated' state
        metadata: { 
          xliffId: '1',
          memoqState: 'Translated' // Check memoq specific state was stored
        }
      });

      // Segment 2: Confirmed (maps to COMPLETED based on target state 'final')
      expect(result.segments[1]).toMatchObject({
        index: 1,
        sourceText: 'Source text 2',
        translation: 'Zieltext 2',
        status: SegmentStatus.COMPLETED, // Maps from 'final' target state
        metadata: { 
          xliffId: '2',
          memoqState: 'Confirmed' // Check memoq specific state was stored
        }
      });

      // Segment 3: NeedsTranslation (maps to PENDING)
      expect(result.segments[2]).toMatchObject({
        index: 2,
        sourceText: 'Source text 3',
        translation: '', // No target
        status: SegmentStatus.PENDING,
        metadata: { 
          xliffId: '3',
          memoqState: 'NeedsTranslation' // Check memoq specific state was stored
        }
      });
    });

    test('should throw an error if readFile fails', async () => {
      const readError = new Error('File system error: ENOENT');
      mockReadFile.mockRejectedValue(readError);
      const filePath = 'nonexistent/file.xliff';

      // Expect the call to reject and check the error message
      await expect(processor.extractSegments(filePath, { isMemoQ: false }))
        .rejects
        .toThrow(`Failed to process XLIFF file ${filePath}: ${readError.message}`);

      // Ensure logger.error was called
      expect(logger.error).toHaveBeenCalledWith(`Error processing XLIFF file ${filePath}:`, readError);
    });

    test('should throw an error for invalid XML content', async () => {
      mockReadFile.mockResolvedValue(invalidXmlContent);
      const filePath = 'dummy/invalid.xliff';

      // Expect the call to reject. The specific error message might vary based on the parser.
      await expect(processor.extractSegments(filePath, { isMemoQ: false }))
        .rejects
        .toThrow(/Failed to process XLIFF file/); // Check for our wrapper message

      // We might also check if logger.error was called, 
      // though the exact error object from the parser might be complex to match.
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(`Error processing XLIFF file ${filePath}`), expect.any(Error));
    });

    test('should return empty results for a file with no trans-units', async () => {
      mockReadFile.mockResolvedValue(sampleXliffNoUnits);
      const filePath = 'dummy/no_units.xliff';

      const result = await processor.extractSegments(filePath, { isMemoQ: false });

      expect(mockReadFile).toHaveBeenCalledWith(filePath, 'utf-8');
      // Check metadata is still parsed
      expect(result.metadata).toEqual({
        original: 'empty.txt',
        sourceLanguage: 'en',
        targetLanguage: 'ja',
        datatype: 'plaintext',
      });
      // Check for empty results
      expect(result.segmentCount).toBe(0);
      expect(result.segments).toHaveLength(0);
      // Check logger wasn't called for errors, maybe for info/warn about no units
      expect(logger.error).not.toHaveBeenCalled();
      // Expect warn to be called with the specific message and an empty array
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`No trans-unit elements found or xpath returned empty array in ${filePath}`),
        [] // Expect an empty array as the second argument now
      );
    });

  });

  describe('writeTranslations', () => {
    // Helper function to remove whitespace-only text nodes from DOM
    const removeWhitespaceNodes = (node: Node): void => { 
      if (!node || !node.childNodes) return;
      for (let i = node.childNodes.length - 1; i >= 0; i--) {
        const child = node.childNodes[i];
        if (child.nodeType === 3) { // TEXT_NODE
          if (!child.nodeValue || child.nodeValue.trim() === '') {
            node.removeChild(child);
          }
        } else if (child.nodeType === 1) { // ELEMENT_NODE
          removeWhitespaceNodes(child); // Recurse
        }
      }
    };

    test('should correctly write translations to a standard XLIFF file', async () => {
      const mockSegments: ISegment[] = [
        // Segment 1: Update translation and status
        { 
          _id: new Types.ObjectId(),
          index: 0,
          sourceText: 'Hello World',
          translation: 'Bonjour le monde Changed',
          finalText: 'Bonjour le monde Final',
          status: SegmentStatus.COMPLETED, 
          metadata: { xliffId: '1' }
        } as unknown as ISegment, // Cast to unknown first
        // Segment 2: No final text, status is REVIEW_COMPLETED
        { 
          _id: new Types.ObjectId(),
          index: 1,
          sourceText: 'This is a test.',
          translation: 'Ceci est un test.',
          finalText: undefined, 
          status: SegmentStatus.REVIEW_COMPLETED, 
          metadata: { xliffId: '2' }
        } as unknown as ISegment, // Cast to unknown first
        // Segment 3: New translation added
        { 
          _id: new Types.ObjectId(),
          index: 2,
          sourceText: 'Another segment.',
          translation: 'Un autre segment.',
          finalText: 'Un autre segment.',
          status: SegmentStatus.TRANSLATED, 
          metadata: { xliffId: '3' }
        } as unknown as ISegment, // Cast to unknown first
         // Segment 4: No change in text, status updated
         { 
          _id: new Types.ObjectId(),
          index: 3,
          sourceText: 'Segment with <g id="1" xmlns="urn:oasis:names:tc:xliff:document:1.2">inline</g> tag.',
          translation: 'Segment avec tag <g id="1" xmlns="urn:oasis:names:tc:xliff:document:1.2">inline</g>.',
          finalText: 'Segment avec tag <g id="1" xmlns="urn:oasis:names:tc:xliff:document:1.2">inline</g>.',
          status: SegmentStatus.REVIEW_COMPLETED, 
          metadata: { xliffId: '4' } 
        } as unknown as ISegment, // Cast to unknown first
        // Segment with missing xliffId in metadata (should be skipped)
        { 
          _id: new Types.ObjectId(), 
          index: 4, 
          sourceText: 'Skipped', 
          translation: 'Skipped', 
          status: SegmentStatus.COMPLETED, 
          metadata: {} 
        } as unknown as ISegment, // Cast to unknown first
      ];

      // Define the expected output XML based on mockSegments
      // Use the correct whitespace-free structure for comparison after cleaning
      const expectedOutputXml = `<?xml version="1.0" encoding="UTF-8"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2"><file original="test.txt" source-language="en" target-language="fr" datatype="plaintext"><body><trans-unit id="1" state="final"><source>Hello World</source><target state="final">Bonjour le monde Final</target></trans-unit><trans-unit id="2" state="reviewed"><source>This is a test.</source><target state="reviewed">Ceci est un test.</target></trans-unit><trans-unit id="3" state="translated"><source>Another segment.</source><target state="translated">Un autre segment.</target></trans-unit><trans-unit id="4" state="reviewed"><source>Segment with <g id="1">inline</g> tag.</source><target state="reviewed">Segment avec tag <g id="1" xmlns="urn:oasis:names:tc:xliff:document:1.2">inline</g>.</target></trans-unit></body></file></xliff>`;

      mockReadFile.mockResolvedValue(sampleStandardXliff);
      const originalFilePath = 'dummy/standard.xliff';
      const targetFilePath = 'dummy/output.xliff';

      await processor.writeTranslations(mockSegments as any, originalFilePath, targetFilePath);

      expect(mockReadFile).toHaveBeenCalledWith(originalFilePath, 'utf-8');
      expect(mockWriteFile).toHaveBeenCalledTimes(1);

      // Get the arguments passed to writeFile
      expect(mockWriteFile.mock.calls.length).toBeGreaterThan(0);
      const writeArgs = mockWriteFile.mock.calls[0];
      expect(writeArgs.length).toBeGreaterThanOrEqual(3);
      const writtenPath = writeArgs[0];
      const writtenContent = (writeArgs[1] as string | undefined) ?? ''; 
      const writtenEncoding = writeArgs[2];

      // Compare path and encoding directly
      expect(writtenPath).toBe(targetFilePath);
      expect(writtenEncoding).toBe('utf-8');
      
      // Parse both expected and actual XML content into DOM objects
      const parser = new DOMParser();
      const expectedDoc = parser.parseFromString(expectedOutputXml, 'text/xml');
      const actualDoc = parser.parseFromString(writtenContent, 'text/xml');

      // Remove whitespace-only text nodes before comparison
      removeWhitespaceNodes(expectedDoc);
      removeWhitespaceNodes(actualDoc);

      // Serialize the *cleaned* documents and compare the resulting strings
      const serializer = new XMLSerializer();
      const finalExpectedString = serializer.serializeToString(expectedDoc);
      const finalActualString = serializer.serializeToString(actualDoc);
      
      expect(finalActualString).toBe(finalExpectedString);

      // Check that the segment with missing xliffId was skipped (logged warning)
      const warnMock = logger.warn as jest.Mock;
      expect(warnMock).toHaveBeenCalled(); 
      expect(warnMock.mock.calls.length).toBeGreaterThan(0); 
      expect(warnMock.mock.calls[0][0]).toEqual(expect.stringContaining('Skipping segment with invalid, missing, or potentially unsafe xliffId'));
    });

    test('should correctly write translations to a MemoQ XLIFF file', async () => {
      const mockSegments: ISegment[] = [
        // Segment 1: Status COMPLETED -> m:state="Confirmed", state="final"
        { 
          _id: new Types.ObjectId(), index: 0, sourceText: 'Source text 1', 
          finalText: 'Zieltext 1 Final', status: SegmentStatus.COMPLETED, 
          metadata: { xliffId: '1' } 
        } as unknown as ISegment,
        // Segment 2: Status REVIEW_COMPLETED -> m:state="Confirmed", state="reviewed"
        { 
          _id: new Types.ObjectId(), index: 1, sourceText: 'Source text 2', 
          finalText: 'Zieltext 2 Reviewed', status: SegmentStatus.REVIEW_COMPLETED, 
          metadata: { xliffId: '2' } 
        } as unknown as ISegment,
        // Segment 3: Status TRANSLATED -> m:state="Translated", state="translated" (New target)
        { 
          _id: new Types.ObjectId(), index: 2, sourceText: 'Source text 3', 
          finalText: 'Zieltext 3 Translated', status: SegmentStatus.TRANSLATED, 
          metadata: { xliffId: '3' } 
        } as unknown as ISegment,
         // Segment with missing xliffId (should be skipped)
         { 
          _id: new Types.ObjectId(), index: 3, sourceText: 'Skipped', 
          finalText: 'Skipped', status: SegmentStatus.COMPLETED, 
          metadata: {} 
        } as unknown as ISegment,
      ];

      // Expected MemoQ XLIFF output (whitespace-free for comparison)
      const expectedOutputXml = `<?xml version="1.0" encoding="UTF-8"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2" xmlns:m="http://www.memoq.com/memoq/xliff"><file m:original="memoq_test.docx" m:source-language="en-US" m:target-language="de-DE" datatype="plaintext"><body><m:trans-unit id="1" m:state="Confirmed"><m:source>Source text 1</m:source><m:target state="final">Zieltext 1 Final</m:target></m:trans-unit><m:trans-unit id="2" m:state="Confirmed"><m:source>Source text 2</m:source><m:target state="reviewed">Zieltext 2 Reviewed</m:target></m:trans-unit><m:trans-unit id="3" m:state="Translated"><m:source>Source text 3</m:source><m:target state="translated">Zieltext 3 Translated</m:target></m:trans-unit></body></file></xliff>`;

      mockReadFile.mockResolvedValue(sampleMemoQXliff); // Use MemoQ sample as input
      const originalFilePath = 'dummy/memoq.mqxliff';
      const targetFilePath = 'dummy/output.mqxliff';

      // Call writeTranslations with isMemoQ: true
      await processor.writeTranslations(mockSegments as any, originalFilePath, targetFilePath, { isMemoQ: true });

      expect(mockReadFile).toHaveBeenCalledWith(originalFilePath, 'utf-8');
      expect(mockWriteFile).toHaveBeenCalledTimes(1);

      // Get written content
      expect(mockWriteFile.mock.calls.length).toBeGreaterThan(0);
      const writeArgs = mockWriteFile.mock.calls[0];
      expect(writeArgs.length).toBeGreaterThanOrEqual(3);
      const writtenPath = writeArgs[0];
      const writtenContent = (writeArgs[1] as string | undefined) ?? ''; 
      const writtenEncoding = writeArgs[2];

      // Assert path and encoding
      expect(writtenPath).toBe(targetFilePath);
      expect(writtenEncoding).toBe('utf-8');
      
      // Parse, clean, re-serialize, compare
      const parser = new DOMParser();
      const expectedDoc = parser.parseFromString(expectedOutputXml, 'text/xml');
      const actualDoc = parser.parseFromString(writtenContent, 'text/xml');

      removeWhitespaceNodes(expectedDoc);
      removeWhitespaceNodes(actualDoc);

      const serializer = new XMLSerializer();
      const finalExpectedString = serializer.serializeToString(expectedDoc);
      const finalActualString = serializer.serializeToString(actualDoc);
      
      expect(finalActualString).toBe(finalExpectedString);

      // Check skip warning
      const warnMock = logger.warn as jest.Mock;
      expect(warnMock).toHaveBeenCalled(); 
      expect(warnMock.mock.calls.length).toBeGreaterThan(0); 
      expect(warnMock.mock.calls[0][0]).toEqual(expect.stringContaining('Skipping segment with invalid, missing, or potentially unsafe xliffId'));
    });

    test('should throw an error if readFile fails', async () => {
      const readError = new Error('Simulated read error');
      mockReadFile.mockRejectedValue(readError);
      const originalFilePath = 'dummy/read_error.xliff';
      const targetFilePath = 'dummy/output_read_error.xliff';
      const mockSegments: ISegment[] = [
         // Use unknown cast for minimal data
        { _id: new Types.ObjectId(), index: 0, metadata: { xliffId: '1'} } as unknown as ISegment
      ];

      await expect(processor.writeTranslations(mockSegments, originalFilePath, targetFilePath))
        .rejects
        .toThrow(`Failed to process XLIFF file ${originalFilePath}: ${readError.message}`);

      expect(logger.error).toHaveBeenCalledWith(`Error processing XLIFF file ${originalFilePath}:`, readError);
      expect(mockWriteFile).not.toHaveBeenCalled(); // writeFile should not be called
    });

    test('should throw an error if writeFile fails', async () => {
      const writeError = new Error('Simulated write error');
      mockReadFile.mockResolvedValue(sampleStandardXliff); // readFile succeeds
       // Use unknown cast for minimal data
      mockWriteFile.mockRejectedValue(writeError as never);       // Cast to never to satisfy mock

      const originalFilePath = 'dummy/write_error_input.xliff';
      const targetFilePath = 'dummy/write_error_output.xliff';
      const mockSegments: ISegment[] = [
        // Minimal segment data needed to pass initial checks
        { 
          _id: new Types.ObjectId(), index: 0, sourceText: 'Hello World', 
          finalText: 'Bonjour Final', status: SegmentStatus.COMPLETED, 
          metadata: { xliffId: '1' } 
        } as unknown as ISegment,
      ];

      await expect(processor.writeTranslations(mockSegments, originalFilePath, targetFilePath))
        .rejects
        .toThrow(`Failed to process XLIFF file ${originalFilePath}: ${writeError.message}`);
      
      expect(mockReadFile).toHaveBeenCalledWith(originalFilePath, 'utf-8'); // Ensure read was attempted
      expect(logger.error).toHaveBeenCalledWith(`Error processing XLIFF file ${originalFilePath}:`, writeError);
    });

  }); // End of describe('writeTranslations')

  // Maybe add tests for private helper methods if needed,
  // though often it's better to test them via the public methods.

}); 