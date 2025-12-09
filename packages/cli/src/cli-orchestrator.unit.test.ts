import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create hoisted mock instances (vitest 4 requirement)
const {
  mockArgumentParser,
  mockFileProcessor,
  mockOutputHandler,
  MockCLIArgumentError,
  MockFileProcessorError,
} = vi.hoisted(() => ({
  mockArgumentParser: {
    parse: vi.fn(),
    printHelp: vi.fn(),
  },
  mockFileProcessor: {
    findFiles: vi.fn(),
    processFiles: vi.fn(),
  },
  mockOutputHandler: {
    formatAndOutput: vi.fn(),
  },
  MockCLIArgumentError: class extends Error {
    name = 'CLIArgumentError';
  },
  MockFileProcessorError: class extends Error {
    name = 'FileProcessorError';
  },
}));

// Mock the CLI components before importing - use function syntax for constructors
vi.mock('./cli-argument-parser.js', () => ({
  CLIArgumentParser: vi.fn().mockImplementation(function (this: any) {
    Object.assign(this, mockArgumentParser);
  }),
  CLIArgumentError: MockCLIArgumentError,
}));

vi.mock('./file-processor.js', () => ({
  FileProcessor: vi.fn().mockImplementation(function (this: any) {
    Object.assign(this, mockFileProcessor);
  }),
  FileProcessorError: MockFileProcessorError,
}));

vi.mock('./cli-output-handler.js', () => ({
  CLIOutputHandler: vi.fn().mockImplementation(function (this: any) {
    Object.assign(this, mockOutputHandler);
  }),
}));

// Mock console methods
const mockConsoleError = vi
  .spyOn(console, 'error')
  .mockImplementation(() => {});

// Import after mocking
import { CLIOrchestrator } from './cli-orchestrator.js';
import { CLIArgumentParser, CLIArgumentError } from './cli-argument-parser.js';
import { FileProcessor, FileProcessorError } from './file-processor.js';
import { CLIOutputHandler } from './cli-output-handler.js';

describe('CLIOrchestrator', () => {
  let orchestrator: CLIOrchestrator;

  beforeEach(() => {
    // Reset mock implementations
    mockArgumentParser.parse.mockReset();
    mockArgumentParser.printHelp.mockReset();
    mockFileProcessor.findFiles.mockReset();
    mockFileProcessor.processFiles.mockReset();
    mockOutputHandler.formatAndOutput.mockReset();

    orchestrator = new CLIOrchestrator();
    vi.clearAllMocks();

    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  describe('run', () => {
    it('should orchestrate the entire CLI flow successfully', async () => {
      const mockOptions = {
        format: 'json' as const,
        depth: 5,
        namedOnly: true,
        llmtext: false,
        help: false,
        version: false,
      };
      const mockPattern = 'src/**/*.ts';
      const mockFiles = ['/path/file1.ts', '/path/file2.ts'];
      const mockResults = [
        { file: '/path/file1.ts', outline: { type: 'program' } },
        { file: '/path/file2.ts', outline: { type: 'program' } },
      ];

      mockArgumentParser.parse.mockReturnValue({
        options: mockOptions,
        pattern: mockPattern,
      });
      mockFileProcessor.findFiles.mockResolvedValue(mockFiles);
      mockFileProcessor.processFiles.mockResolvedValue(mockResults);

      await orchestrator.run();

      expect(mockArgumentParser.parse).toHaveBeenCalled();
      expect(mockFileProcessor.findFiles).toHaveBeenCalledWith(mockPattern);
      expect(mockFileProcessor.processFiles).toHaveBeenCalledWith(
        mockFiles,
        mockOptions.depth,
        mockOptions.namedOnly
      );
      expect(CLIOutputHandler).toHaveBeenCalledWith(
        mockOptions.format,
        mockOptions.llmtext
      );
      expect(mockOutputHandler.formatAndOutput).toHaveBeenCalledWith(
        mockResults
      );
    });

    it('should handle CLIArgumentError', async () => {
      mockArgumentParser.parse.mockImplementation(() => {
        throw new MockCLIArgumentError('Invalid arguments');
      });

      await orchestrator.run();

      expect(mockConsoleError).toHaveBeenCalledWith('Error: Invalid arguments');
      expect(mockArgumentParser.printHelp).toHaveBeenCalled();

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle FileProcessorError', async () => {
      mockArgumentParser.parse.mockReturnValue({
        options: {
          format: 'json' as const,
          depth: 5,
          namedOnly: true,
          help: false,
          version: false,
        },
        pattern: 'invalid/**/*.js',
      });

      mockFileProcessor.findFiles.mockImplementation(() => {
        throw new MockFileProcessorError('No files found');
      });

      await orchestrator.run();

      expect(mockConsoleError).toHaveBeenCalledWith('No files found');

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should re-throw unexpected errors', async () => {
      const unexpectedError = new Error('Unexpected error');

      mockArgumentParser.parse.mockImplementation(() => {
        throw unexpectedError;
      });

      await expect(orchestrator.run()).rejects.toThrow('Unexpected error');
    });

    it('should handle async file processing errors', async () => {
      mockArgumentParser.parse.mockReturnValue({
        options: {
          format: 'json' as const,
          depth: 5,
          namedOnly: true,
          help: false,
          version: false,
        },
        pattern: 'src/**/*.js',
      });

      mockFileProcessor.findFiles.mockResolvedValue(['/path/file1.js']);
      mockFileProcessor.processFiles.mockImplementation(() => {
        throw new MockFileProcessorError('Processing failed');
      });

      await orchestrator.run();

      expect(mockConsoleError).toHaveBeenCalledWith('Processing failed');

      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});
