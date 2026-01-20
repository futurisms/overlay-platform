export interface Document {
  documentId: string;
  timestamp: number;
  status: DocumentStatus;
  fileName: string;
  fileSize: number;
  s3Key: string;
  uploadedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export enum DocumentStatus {
  UPLOADED = 'UPLOADED',
  PROCESSING = 'PROCESSING',
  REVIEWED = 'REVIEWED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  ERROR = 'ERROR',
}

export interface DocumentMetadata {
  documentId: string;
  contentType: string;
  tags?: string[];
  customFields?: Record<string, any>;
}

export interface ReviewResult {
  documentId: string;
  reviewedAt: string;
  reviewedBy: string;
  status: DocumentStatus;
  comments?: string;
  aiAnalysis?: AIAnalysisResult;
}

export interface AIAnalysisResult {
  confidence: number;
  findings: string[];
  recommendations: string[];
  processedAt: string;
}
