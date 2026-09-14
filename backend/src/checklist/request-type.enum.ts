export enum RequestType {
  STUDY_LEAVE = 'study_leave',
  FOREIGN_TRAVEL = 'foreign_travel',
  PERSONAL_TRAVEL = 'personal_travel',
  SABBATICAL_LEAVE = 'sabbatical_leave',
  STUDY_LEAVE_EXTENSION = 'study_leave_extension',
  LOCAL_TRAVEL = 'local_travel',
}

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  [RequestType.STUDY_LEAVE]: 'Study Leave Request',
  [RequestType.FOREIGN_TRAVEL]: 'Foreign Travel Request',
  [RequestType.PERSONAL_TRAVEL]: 'Personal Travel Request',
  [RequestType.SABBATICAL_LEAVE]: 'Sabbatical Leave Request',
  [RequestType.STUDY_LEAVE_EXTENSION]: 'Study Leave Extension Request',
  [RequestType.LOCAL_TRAVEL]: 'Local Travel Request (w/ Funding Requirement)',
};

// Prefix used when generating an application number for each request
// type, e.g. "FT-2026-0001". See ChecklistService.generateApplicationNumber.
export const REQUEST_TYPE_PREFIXES: Record<RequestType, string> = {
  [RequestType.STUDY_LEAVE]: 'SL',
  [RequestType.FOREIGN_TRAVEL]: 'FT',
  [RequestType.PERSONAL_TRAVEL]: 'PT',
  [RequestType.SABBATICAL_LEAVE]: 'SB',
  [RequestType.STUDY_LEAVE_EXTENSION]: 'SLE',
  [RequestType.LOCAL_TRAVEL]: 'LT',
};

// Request types where the employee must declare whether the travel is
// official or personal in nature (see TravelPurpose in submission.entity.ts).
export const TRAVEL_PURPOSE_APPLICABLE_TYPES: RequestType[] = [
  RequestType.LOCAL_TRAVEL,
  RequestType.FOREIGN_TRAVEL,
  RequestType.PERSONAL_TRAVEL,
];