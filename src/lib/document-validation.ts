import { z } from 'zod';

// Comprehensive file validation configuration
export const FILE_VALIDATION_CONFIG = {
  maxSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
  ],
  allowedExtensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png'],
  forbiddenFilenameChars: /[<>:"/\\|?*\x00-\x1f]/g,
} as const;

// Document type validation schema
export const documentTypeSchema = z.enum([
  'Business Tax Returns',
  'Personal Tax Returns',
  'P&L and Balance Sheet',
  'Bank Statements',
  'Debt Schedule and Notes',
  'Loan Application & Driver\'s License',
  'AR & AP',
  'Projections, Resume & Business Plan',
  'SBA & Bank Documents',
  'Corp Articles, Operating Agreement & EIN Form',
  'Other',
]);

// File upload validation schema
export const fileUploadSchema = z.object({
  file: z.custom<File>(
    (file) => file instanceof File,
    { message: 'Invalid file' }
  ).refine(
    (file) => file.size <= FILE_VALIDATION_CONFIG.maxSize,
    `File size must be less than ${FILE_VALIDATION_CONFIG.maxSize / (1024 * 1024)}MB`
  ).refine(
    (file) => FILE_VALIDATION_CONFIG.allowedMimeTypes.includes(file.type as any),
    'File type not allowed. Allowed types: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG'
  ).refine(
    (file) => !FILE_VALIDATION_CONFIG.forbiddenFilenameChars.test(file.name),
    'Filename contains invalid characters'
  ),
  documentType: documentTypeSchema,
  notes: z.string().max(500, 'Notes must be less than 500 characters').optional(),
  leadId: z.string().uuid('Invalid lead ID'),
  contactEntityId: z.string().uuid('Invalid contact entity ID'),
});

export type FileUploadInput = z.infer<typeof fileUploadSchema>;
export type DocumentType = z.infer<typeof documentTypeSchema>;

/**
 * Validates a file against security and size requirements
 * @param file - The file to validate
 * @returns Error message if invalid, null if valid
 */
export function validateFile(file: File): string | null {
  // Check file type
  if (!FILE_VALIDATION_CONFIG.allowedMimeTypes.includes(file.type as any)) {
    return `Invalid file type. Allowed: ${FILE_VALIDATION_CONFIG.allowedExtensions.join(', ')}`;
  }

  // Check file size
  if (file.size > FILE_VALIDATION_CONFIG.maxSize) {
    const maxSizeMB = FILE_VALIDATION_CONFIG.maxSize / (1024 * 1024);
    return `File size exceeds ${maxSizeMB}MB limit`;
  }

  // Check filename for dangerous characters
  if (FILE_VALIDATION_CONFIG.forbiddenFilenameChars.test(file.name)) {
    return 'Filename contains invalid characters';
  }

  // Additional security checks
  if (file.name.length > 255) {
    return 'Filename too long (max 255 characters)';
  }

  if (file.size === 0) {
    return 'File is empty';
  }

  return null;
}

/**
 * Sanitizes a filename for safe storage
 * @param filename - The original filename
 * @returns Sanitized filename
 */
export function sanitizeFilename(filename: string): string {
  // Remove path components
  const basename = filename.split(/[/\\]/).pop() || filename;
  
  // Replace invalid characters with underscores
  const sanitized = basename.replace(FILE_VALIDATION_CONFIG.forbiddenFilenameChars, '_');
  
  // Limit length
  if (sanitized.length > 255) {
    const ext = sanitized.split('.').pop() || '';
    const name = sanitized.substring(0, 255 - ext.length - 1);
    return `${name}.${ext}`;
  }
  
  return sanitized;
}

/**
 * Gets file extension from filename
 * @param filename - The filename
 * @returns File extension (lowercase, with dot)
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? `.${parts.pop()?.toLowerCase()}` : '';
}

/**
 * Formats file size for display
 * @param bytes - File size in bytes
 * @returns Formatted file size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
