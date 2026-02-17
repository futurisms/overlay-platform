/**
 * DOCX Parser for Overlay Import
 * Extracts overlay metadata and evaluation criteria from structured DOCX files
 */

import mammoth from 'mammoth';

export interface ParsedOverlay {
  name: string;
  description: string;
  document_type: string;
  document_purpose?: string;
  when_used?: string;
  process_context?: string;
  target_audience?: string;
}

export interface ParsedCriterion {
  name: string;
  criterion_type: string;
  description: string; // Full criteria text including scoring rubric
  weight: number;
  max_score: number;
}

export interface ParsedOverlayData {
  overlay: ParsedOverlay;
  criteria: ParsedCriterion[];
}

/**
 * Parse DOCX file and extract overlay + criteria data
 */
export async function parseOverlayDocx(file: File): Promise<ParsedOverlayData> {
  // Extract text from DOCX
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = result.value;

  console.log('Extracted text length:', text.length);
  console.log('First 1000 chars:', text.substring(0, 1000));

  // Parse overlay metadata using extractFieldBetween to stop at next field
  const overlay: ParsedOverlay = {
    name: extractFieldBetween(text, 'Overlay Name:', [
      'Description:', 'Document Type:', 'EVALUATION CRITERIA'
    ]) || '',
    description: extractFieldBetween(text, 'Description:', [
      'Document Type:', 'Document Purpose:', 'EVALUATION CRITERIA'
    ]) || '',
    document_type: extractFieldBetween(text, 'Document Type:', [
      'Document Purpose:', 'When Used:', 'Process Context:', 'Target Audience:', 'EVALUATION CRITERIA'
    ]) || '',
    document_purpose: extractFieldBetween(text, 'Document Purpose:', [
      'When Used:', 'Process Context:', 'Target Audience:', 'EVALUATION CRITERIA'
    ]) || undefined,
    when_used: extractFieldBetween(text, 'When Used:', [
      'Process Context:', 'Target Audience:', 'EVALUATION CRITERIA'
    ]) || undefined,
    process_context: extractFieldBetween(text, 'Process Context:', [
      'Target Audience:', 'EVALUATION CRITERIA'
    ]) || undefined,
    target_audience: extractFieldBetween(text, 'Target Audience:', [
      'EVALUATION CRITERIA', 'Title:', 'Type:'
    ]) || undefined,
  };

  // Parse criteria
  const criteria: ParsedCriterion[] = [];

  // Extract criterion metadata
  const criterionName = extractFieldBetween(text, 'Title:', ['Type:', 'SECTION TO EVALUATE']) || '';
  const criterionType = extractFieldBetween(text, 'Type:', ['SECTION TO EVALUATE', 'Weight:']) || 'general';
  const weight = parseFloat(extractFieldBetween(text, 'Weight:', ['Max Score:']) || '1') || 1;
  const maxScore = parseFloat(extractFieldBetween(text, 'Max Score:', ['NOTES FOR TESTING', '---']) || '1') || 1;

  // Extract full criteria description (everything from SECTION TO EVALUATE through SCORING RUBRIC)
  const criteriaDescription = extractCriteriaBody(text);

  if (criterionName) {
    criteria.push({
      name: criterionName,
      criterion_type: criterionType,
      description: criteriaDescription,
      weight,
      max_score: maxScore,
    });
  }

  console.log('Parsed overlay:', overlay);
  console.log('Parsed criteria count:', criteria.length);

  return { overlay, criteria };
}

/**
 * Extract field value between current label and next labels
 * Stops at whichever next label appears first
 */
function extractFieldBetween(text: string, fieldLabel: string, nextLabels: string[]): string {
  // Find start of this field (supports both bold **Field:** and plain Field:)
  let startIndex = -1;

  // Try bold format first
  const boldPattern = `**${fieldLabel}**`;
  startIndex = text.indexOf(boldPattern);

  if (startIndex !== -1) {
    startIndex += boldPattern.length;
  } else {
    // Try plain format
    startIndex = text.indexOf(fieldLabel);
    if (startIndex !== -1) {
      startIndex += fieldLabel.length;
    }
  }

  if (startIndex === -1) {
    return '';
  }

  // Find the earliest occurrence of any next label
  let endIndex = text.length;
  for (const nextLabel of nextLabels) {
    // Check for both bold and plain formats
    const boldIdx = text.indexOf(`**${nextLabel}**`, startIndex);
    const plainIdx = text.indexOf(nextLabel, startIndex);

    // Use whichever is found and earliest
    if (boldIdx !== -1 && boldIdx < endIndex) {
      endIndex = boldIdx;
    }
    if (plainIdx !== -1 && plainIdx < endIndex) {
      endIndex = plainIdx;
    }
  }

  // Extract and clean
  const value = text.substring(startIndex, endIndex).trim();

  // Remove any leading asterisks or whitespace
  return value.replace(/^\*\*|\*\*$/g, '').trim();
}

/**
 * Extract full criteria body (SECTION TO EVALUATE through SCORING RUBRIC)
 */
function extractCriteriaBody(text: string): string {
  // Find start: "SECTION TO EVALUATE" or "EVALUATION CRITERIA" section
  const startMarkers = ['SECTION TO EVALUATE', 'EVALUATION CRITERIA'];
  const endMarkers = ['Weight:', 'Max Score:'];

  let startIndex = -1;
  for (const marker of startMarkers) {
    const index = text.indexOf(marker);
    if (index !== -1 && (startIndex === -1 || index < startIndex)) {
      startIndex = index;
    }
  }

  if (startIndex === -1) {
    return '';
  }

  // Find end: just before "Weight:" field
  let endIndex = text.length;
  for (const marker of endMarkers) {
    const index = text.indexOf(marker, startIndex);
    if (index !== -1 && index < endIndex) {
      endIndex = index;
    }
  }

  // Extract and clean the criteria body
  let criteriaBody = text.substring(startIndex, endIndex).trim();

  // Clean up extra whitespace and normalize line breaks
  criteriaBody = criteriaBody
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return criteriaBody;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validate parsed data
 */
export function validateParsedData(data: ParsedOverlayData): string[] {
  const errors: string[] = [];

  if (!data.overlay.name) {
    errors.push('Overlay name is required');
  }

  if (!data.overlay.document_type) {
    errors.push('Document type is required');
  }

  if (data.criteria.length === 0) {
    errors.push('At least one evaluation criterion is required');
  }

  for (let i = 0; i < data.criteria.length; i++) {
    const c = data.criteria[i];
    if (!c.name) {
      errors.push(`Criterion ${i + 1}: Name is required`);
    }
    if (!c.description) {
      errors.push(`Criterion ${i + 1}: Description is required`);
    }
    if (c.weight <= 0) {
      errors.push(`Criterion ${i + 1}: Weight must be greater than 0`);
    }
    if (c.max_score <= 0) {
      errors.push(`Criterion ${i + 1}: Max score must be greater than 0`);
    }
  }

  return errors;
}
