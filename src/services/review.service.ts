import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { File, FileStatus, IFile } from '../models/file.model';
import { Segment, SegmentStatus, ISegment, IIssue, IssueSeverity, IssueType, IssueStatus } from '../models/segment.model';
import { Project, IProject } from '../models/project.model';
import { PromptTemplate, IPromptTemplate, PromptTemplateType } from '../models/promptTemplate.model';
import { PromptProcessor, PromptBuildContext } from '../utils/promptProcessor';
import { AIProviderConfig, IAIProviderConfig } from '../models/aiConfig.model';
import { FileReviewJobData } from '../types/job-data.types';
import { AIProviderManager } from './ai-provider.manager';
import { IssueType as ReviewIssueType } from '../types/review.types';
import logger from '../utils/logger';

// Local interface definition for parsed AI issues
interface ParsedReviewIssue {
	type: ReviewIssueType;
	severity: 'LOW' | 'MEDIUM' | 'HIGH';
	description: string;
	suggestion?: string;
}

// Local interface for the result of processing a segment review
interface SegmentReviewResult {
	segmentId: string;
	issues: ParsedReviewIssue[];
	status: 'needs_revision' | 'reviewed' | 'failed';
	error?: string;
}

// Configuration for batching - could be moved to config service
const MAX_SEGMENTS_PER_BATCH = 50; // Example: Limit by number of segments
const MAX_TOKENS_PER_BATCH = 4000; // Example: Limit by estimated tokens

@Injectable()
export class ReviewService {
	private readonly logger = new Logger(ReviewService.name);

	constructor(
		@InjectModel(File.name) private readonly fileModel: Model<IFile>,
		@InjectModel(Segment.name) private readonly segmentModel: Model<ISegment>,
		@InjectModel(Project.name) private readonly projectModel: Model<IProject>,
		@InjectModel(PromptTemplate.name) private readonly promptTemplateModel: Model<IPromptTemplate>,
		@InjectModel(AIProviderConfig.name) private readonly aiConfigModel: Model<IAIProviderConfig>,
		private readonly promptProcessor: PromptProcessor,
	) {}

	async queueFileReviewJob(jobData: FileReviewJobData): Promise<void> {
		this.logger.log(`Queueing file review job for file ${jobData.fileId}`);
		try {
			await this.processFileReviewJob(jobData);
		} catch (error: any) {
			this.logger.error(`Error processing file review job for file ${jobData.fileId} immediately: ${error.message}`, error.stack);
			if (!(error instanceof NotFoundException) && !error.message.includes('already under review') && !error.message.includes('No segments found')) {
				await this.updateFileStatus(new Types.ObjectId(jobData.fileId), FileStatus.ERROR);
			}
		}
	}

	private async validateAndFetchReviewData(jobData: FileReviewJobData): Promise<{ file: IFile, project: IProject, segments: ISegment[], reviewTemplate: IPromptTemplate, aiConfig: IAIProviderConfig }> {
		this.logger.debug(`Validating and fetching data for job: ${JSON.stringify(jobData)}`);

		// Destructure all required IDs directly from jobData
		// Acknowledge FileReviewJobData type might be missing them, but service expects them
		const { fileId: fileIdStr, projectId: projectIdStr, aiConfigId: aiConfigIdStr, reviewPromptTemplateId: reviewPromptTemplateIdStr } = jobData as any;

		if (!Types.ObjectId.isValid(fileIdStr) || !Types.ObjectId.isValid(projectIdStr) || !Types.ObjectId.isValid(aiConfigIdStr) || !Types.ObjectId.isValid(reviewPromptTemplateIdStr)) {
			throw new BadRequestException('Invalid IDs provided.');
		}

		const fileId = new Types.ObjectId(fileIdStr);
		const projectId = new Types.ObjectId(projectIdStr);
		const aiConfigId = new Types.ObjectId(aiConfigIdStr);
		const reviewPromptTemplateId = new Types.ObjectId(reviewPromptTemplateIdStr);

		// Fetch file first
		const file = await this.fileModel.findById(fileId).exec();
		if (!file) throw new NotFoundException(`File with ID ${fileIdStr} not found.`);

		// Validate file project ID matches job project ID
		if (file.projectId.toString() !== projectIdStr) {
			throw new BadRequestException(`File ${fileIdStr} does not belong to project ${projectIdStr}.`);
		}

		// Fetch project, review template, AI config in parallel
		const [project, reviewTemplate, aiConfig] = await Promise.all([
			this.projectModel.findById(projectId).exec(),
			this.promptTemplateModel.findById(reviewPromptTemplateId).exec(),
			this.aiConfigModel.findById(aiConfigId).exec()
		]);

		// Validate the rest
		if (!project) throw new NotFoundException(`Project with ID ${projectIdStr} not found.`);
		if (file.status === FileStatus.REVIEWING) {
			this.logger.warn(`File ${fileIdStr} is already under review. Skipping.`);
			throw new Error(`File ${fileIdStr} is already under review.`);
		}
		if (!reviewTemplate) throw new NotFoundException(`Review prompt template with ID ${reviewPromptTemplateIdStr} not found.`);
		if (reviewTemplate.type !== PromptTemplateType.REVIEW) {
			throw new BadRequestException(`Prompt template ${reviewPromptTemplateIdStr} is not a REVIEW template.`);
		}
		if (!aiConfig) throw new NotFoundException(`AI Config with ID ${aiConfigIdStr} not found.`);

		const segments = await this.segmentModel.find({ fileId: fileId }).sort({ index: 1 }).exec();
		if (!segments || segments.length === 0) {
			this.logger.warn(`No segments found for file ${fileIdStr}. Marking review as completed (empty).`);
			await this.updateFileStatus(fileId, FileStatus.REVIEW_COMPLETED);
			throw new Error(`No segments found for file ${fileIdStr}.`);
		}

		this.logger.debug(`Validation successful for file ${fileIdStr}. Found ${segments.length} segments.`);
		return { file, project, segments, reviewTemplate, aiConfig };
	}

	async processFileReviewJob(jobData: FileReviewJobData): Promise<void> {
		const fileId = new Types.ObjectId(jobData.fileId);
		this.logger.log(`Starting AI review process for file ${fileId}`);

		let validationResult;
		try {
			await this.updateFileStatus(fileId, FileStatus.REVIEWING);
			validationResult = await this.validateAndFetchReviewData(jobData);
		} catch (error: any) {
			this.logger.error(`Validation failed for file review job ${fileId}: ${error.message}`, error.stack);
			return;
		}

		const { file, project, segments, reviewTemplate, aiConfig } = validationResult;

		const aiProviderService = new AIProviderManager();

		const segmentBatches: ISegment[][] = [segments];
		this.logger.debug(`Processing ${segments.length} segments in ${segmentBatches.length} batch(es).`);

		let allSegmentsReviewedSuccessfully = true;
		let reviewFailed = false;

		try {
			for (const batch of segmentBatches) {
				this.logger.log(`Processing batch of ${batch.length} segments for file ${fileId}...`);
				const batchResults = await this.processSingleBatchReview(
					batch,
					project,
					reviewTemplate,
					aiConfig,
					aiProviderService
				);

				this.logger.debug(`Updating ${Object.keys(batchResults).length} segments in the database...`);
				const bulkOps = [];
				for (const segment of batch) {
					const result = batchResults[segment._id.toString()];
					let segmentStatus: SegmentStatus;

					if (!result) {
						this.logger.error(`Result missing for segment ${segment._id} in batch processing.`);
						segmentStatus = SegmentStatus.REVIEW_FAILED;
						allSegmentsReviewedSuccessfully = false;
						reviewFailed = true;
						continue;
					}

					const issuesToEmbed: IIssue[] = [];

					if (result.error) {
						this.logger.error(`Error reviewing segment ${segment._id}: ${result.error}`);
						segmentStatus = SegmentStatus.REVIEW_FAILED;
						allSegmentsReviewedSuccessfully = false;
					} else if (result.issues && result.issues.length > 0) {
						this.logger.log(`Segment ${segment._id} has ${result.issues.length} issues.`);
						segmentStatus = SegmentStatus.NEEDS_MANUAL_REVIEW;
						issuesToEmbed.push(...result.issues.map((parsedIssue: ParsedReviewIssue): IIssue => {
							const severityMap: { [key: string]: IssueSeverity } = {
								LOW: IssueSeverity.LOW,
								MEDIUM: IssueSeverity.MEDIUM,
								HIGH: IssueSeverity.HIGH,
							};
							const typeMap: { [key: string]: IssueType } = {
								GRAMMAR: IssueType.GRAMMAR,
								TERMINOLOGY: IssueType.TERMINOLOGY,
								STYLE: IssueType.STYLE,
								ACCURACY: IssueType.ACCURACY,
								FORMATTING: IssueType.FORMATTING,
								CONSISTENCY: IssueType.CONSISTENCY,
								OMISSION: IssueType.OMISSION,
								ADDITION: IssueType.ADDITION,
								OTHER: IssueType.OTHER,
								SPELLING: IssueType.OTHER,
								PUNCTUATION: IssueType.OTHER,
								CULTURAL: IssueType.OTHER,
							};

							return {
								type: typeMap[parsedIssue.type] || IssueType.OTHER,
								severity: severityMap[parsedIssue.severity] || IssueSeverity.LOW,
								description: parsedIssue.description,
								suggestion: parsedIssue.suggestion,
								status: IssueStatus.OPEN,
							};
						}));
					} else {
						this.logger.debug(`Segment ${segment._id} reviewed successfully with no issues.`);
						segmentStatus = SegmentStatus.REVIEW_COMPLETED;
					}

					bulkOps.push({
						updateOne: {
							filter: { _id: segment._id },
							update: {
								$set: {
									status: segmentStatus,
									issues: issuesToEmbed,
									reviewedAt: new Date(),
									errorDetails: result.error || undefined,
								}
							}
						}
					});
				}

				if (bulkOps.length > 0) {
					await this.segmentModel.bulkWrite(bulkOps);
					this.logger.log(`Successfully updated ${bulkOps.length} segments for file ${fileId}.`);
				}
			}
		} catch (error: any) {
			this.logger.error(`An error occurred during batch processing for file ${fileId}: ${error.message}`, error.stack);
			reviewFailed = true;
			allSegmentsReviewedSuccessfully = false;
		}

		let finalStatus: FileStatus;
		if (reviewFailed) {
			finalStatus = FileStatus.ERROR;
		} else {
			const needsRevisionCount = await this.segmentModel.countDocuments({ fileId: fileId, status: SegmentStatus.NEEDS_MANUAL_REVIEW });
			if (needsRevisionCount > 0) {
				finalStatus = FileStatus.ERROR;
			} else {
				const failedCount = await this.segmentModel.countDocuments({ fileId: fileId, status: SegmentStatus.REVIEW_FAILED });
				finalStatus = failedCount > 0 ? FileStatus.ERROR : FileStatus.REVIEW_COMPLETED;
			}
		}

		this.logger.log(`AI Review for file ${fileId} completed. Final status: ${finalStatus}`);
		await this.updateFileStatus(fileId, finalStatus);
	}

	private async processSingleBatchReview(
		batch: ISegment[],
		project: IProject,
		reviewTemplate: IPromptTemplate,
		aiConfig: IAIProviderConfig,
		aiProviderService: AIProviderManager
	): Promise<{ [segmentId: string]: SegmentReviewResult }> {
		const results: { [segmentId: string]: SegmentReviewResult } = {};

		for (const segment of batch) {
			const segmentIdStr = segment._id.toString();
			try {
				this.logger.debug(`Processing segment ${segment._id} (Seq: ${segment.index})`);

				const promptContext: PromptBuildContext = {
					promptTemplateId: reviewTemplate._id,
					sourceLanguage: project.languagePairs[0]?.source,
					targetLanguage: project.languagePairs[0]?.target,
					domain: project.domain,
				};
				const processedPrompt = await this.promptProcessor.buildReviewPrompt(
					segment.sourceText,
					segment.translation || '',
					promptContext
				);

				this.logger.debug(`Generated prompt for segment ${segment._id}: User: ${processedPrompt.userPrompt.substring(0, 100)}...`);

				this.logger.warn(`Placeholder: AIProviderManager.generateReview not called for segment ${segment._id}`);
				const aiResponse: any = { issues: [] };

				const parsedIssues: ParsedReviewIssue[] = this.parseAIReviewResponse(aiResponse);

				results[segmentIdStr] = {
					segmentId: segmentIdStr,
					issues: parsedIssues,
					status: parsedIssues.length > 0 ? 'needs_revision' : 'reviewed',
				};

			} catch (error: any) {
				this.logger.error(`Failed to review segment ${segment._id}: ${error.message}`, error.stack);
				results[segmentIdStr] = {
					segmentId: segmentIdStr,
					issues: [],
					status: 'failed',
					error: error.message,
				};
			}
		}
		return results;
	}

	private parseAIReviewResponse(aiResponse: any): ParsedReviewIssue[] {
		this.logger.debug(`Parsing AI response: ${JSON.stringify(aiResponse)}`);
		let issues: any[] = [];

		if (aiResponse && Array.isArray(aiResponse)) {
			issues = aiResponse;
		} else if (aiResponse && Array.isArray(aiResponse.issues)) {
			issues = aiResponse.issues;
		} else if (aiResponse && Array.isArray(aiResponse.review_issues)) {
			issues = aiResponse.review_issues;
		} else if (aiResponse && aiResponse.reviewResult && Array.isArray(aiResponse.reviewResult.issues)) {
			issues = aiResponse.reviewResult.issues;
		} else if (aiResponse && typeof aiResponse.analysis === 'string') {
			try {
				const parsed = JSON.parse(aiResponse.analysis);
				if (Array.isArray(parsed)) issues = parsed;
				else if (parsed && Array.isArray(parsed.issues)) issues = parsed.issues;
				else if (parsed && Array.isArray(parsed.review_issues)) issues = parsed.review_issues;
				else if (parsed && parsed.reviewResult && Array.isArray(parsed.reviewResult.issues)) issues = parsed.reviewResult.issues;
			} catch (e: any) {
				this.logger.warn(`Failed to parse stringified JSON from AI analysis: ${aiResponse.analysis}`, e);
			}
		}

		const parsedIssues: ParsedReviewIssue[] = issues
			.filter(issue => issue && issue.type && issue.severity && issue.description)
			.map(issue => ({
				type: issue.type as ReviewIssueType,
				severity: issue.severity as 'LOW' | 'MEDIUM' | 'HIGH',
				description: issue.description as string,
				suggestion: issue.suggestion as string | undefined,
			}))
			.filter(issue => Object.values(ReviewIssueType).includes(issue.type) && ['LOW', 'MEDIUM', 'HIGH'].includes(issue.severity));

		if (issues.length > 0 && parsedIssues.length === 0) {
			this.logger.warn(`Potential issues found in response but failed structural validation/mapping: ${JSON.stringify(issues)}`);
		}
		if (parsedIssues.length === 0 && issues.length === 0) {
			this.logger.debug('No issues found or parsed from AI response.');
		}

		return parsedIssues;
	}

	private async updateFileStatus(fileId: Types.ObjectId, status: FileStatus): Promise<void> {
		try {
			await this.fileModel.updateOne({ _id: fileId }, { $set: { status: status, updatedAt: new Date() } }).exec();
			this.logger.log(`Updated status for file ${fileId} to ${status}`);
		} catch (error: any) {
			this.logger.error(`Failed to update status for file ${fileId} to ${status}: ${error.message}`, error.stack);
		}
	}
}