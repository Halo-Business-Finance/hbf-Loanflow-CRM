/**
 * Centralized Loan Stage Management
 * 
 * This file provides a single source of truth for all loan stages used across the CRM.
 * All dashboards and components should import from here to ensure consistency.
 * 
 * IMPORTANT: These stages match the database loan_stages table exactly.
 */

// Master list of all stages in order of the loan lifecycle (matching database)
export const LOAN_STAGES = [
  'New Lead',
  'Qualification',
  'Application',
  'Documentation',
  'Underwriting',
  'Approval',
  'Closing',
  'Funded',
  'Closed Lost'
] as const;

export type LoanStage = typeof LOAN_STAGES[number];

// Stages relevant to Loan Originators (lead generation & initial contact)
export const ORIGINATOR_STAGES: LoanStage[] = [
  'New Lead',
  'Qualification',
  'Application'
];

// Stages relevant to Loan Processors (document collection & processing)
export const PROCESSOR_STAGES: LoanStage[] = [
  'Application',
  'Documentation'
];

// Stages relevant to Underwriters (review & approval)
export const UNDERWRITER_STAGES: LoanStage[] = [
  'Documentation',
  'Underwriting',
  'Approval'
];

// Stages relevant to Loan Closers/Funders (closing & funding)
export const CLOSER_STAGES: LoanStage[] = [
  'Approval',
  'Closing',
  'Funded'
];

// Stage groups for common queries
export const ACTIVE_STAGES: LoanStage[] = [
  'New Lead',
  'Qualification',
  'Application',
  'Documentation',
  'Underwriting',
  'Approval',
  'Closing'
];

export const COMPLETED_STAGES: LoanStage[] = [
  'Funded',
  'Closed Lost'
];

// Helper functions
export function isActiveStage(stage: string): boolean {
  return ACTIVE_STAGES.includes(stage as LoanStage);
}

export function isCompletedStage(stage: string): boolean {
  return COMPLETED_STAGES.includes(stage as LoanStage);
}

export function getStageIndex(stage: string): number {
  return LOAN_STAGES.indexOf(stage as LoanStage);
}

export function getNextStage(currentStage: string): LoanStage | null {
  const currentIndex = getStageIndex(currentStage);
  if (currentIndex === -1 || currentIndex >= LOAN_STAGES.length - 1) {
    return null;
  }
  return LOAN_STAGES[currentIndex + 1];
}

export function getPreviousStage(currentStage: string): LoanStage | null {
  const currentIndex = getStageIndex(currentStage);
  if (currentIndex <= 0) {
    return null;
  }
  return LOAN_STAGES[currentIndex - 1];
}

// Stage display colors for badges and UI
export function getStageColor(stage: string): string {
  switch (stage) {
    case 'New Lead':
      return 'bg-gray-500';
    case 'Qualification':
      return 'bg-blue-500';
    case 'Application':
      return 'bg-cyan-500';
    case 'Documentation':
      return 'bg-yellow-500';
    case 'Underwriting':
      return 'bg-orange-500';
    case 'Approval':
      return 'bg-green-500';
    case 'Closing':
      return 'bg-indigo-500';
    case 'Funded':
      return 'bg-emerald-600';
    case 'Closed Lost':
      return 'bg-red-500';
    default:
      return 'bg-gray-400';
  }
}
