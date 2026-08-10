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