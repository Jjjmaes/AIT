export enum ReviewScoreType {
  ACCURACY = 'ACCURACY',
  NATURALNESS = 'NATURALNESS',
  CULTURAL_APPROPRIATENESS = 'CULTURAL_APPROPRIATENESS',
  OVERALL = 'OVERALL'
}

export enum IssueType {
  GRAMMAR = 'GRAMMAR',
  SPELLING = 'SPELLING',
  PUNCTUATION = 'PUNCTUATION',
  STYLE = 'STYLE',
  CULTURAL = 'CULTURAL',
  TERMINOLOGY = 'TERMINOLOGY',
  FORMATTING = 'FORMATTING',
  OTHER = 'OTHER'
}

export interface ReviewResult {
  finalTranslation: string;
  acceptedChanges: boolean;
  modificationDegree: 'NONE' | 'MINOR' | 'MODERATE' | 'MAJOR';
  scores: {
    [key in ReviewScoreType]: number;
  };
  issues: {
    type: IssueType;
    description: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    suggestion?: string;
  }[];
}

export interface AIReviewResponse {
  translatedText: string;
  metadata: {
    provider: string;
    model: string;
    processingTime: number;
    confidence: number;
    wordCount: number;
    characterCount: number;
    tokens: {
      input: number;
      output: number;
    };
  };
  reviewResult?: ReviewResult;
}
