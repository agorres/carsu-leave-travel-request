export interface RequestTypeOption {
  type: string;
  label: string;
}

export interface FlatChecklistItem {
  code: string;
  label: string;
  note?: string;
  groupLabel?: string;
}

export type DocumentReviewStatus = 'pending' | 'approved' | 'rejected';

export interface SubmissionDocument {
  id: string;
  itemCode: string;
  originalFileName: string;
  uploadedAt: string;
  reviewStatus: DocumentReviewStatus;
  reviewComment: string | null;
  reviewedAt: string | null;
}

export type SubmissionStatus =
  | 'in_progress'
  | 'complete'
  | 'submitted'
  | 'returned_for_correction'
  | 'approved';

export interface Submission {
  id: string;
  employeeEmail: string;
  employeeName: string;
  officeAffiliation: string;
  collegeOfficeUnit: string;
  currentPosition: string;
  inclusiveDateFrom: string;
  inclusiveDateTo: string;
  yearsInPosition: number;
  yearsInCsu: number;
  requestType: string;
  isAbroad: boolean;
  status: SubmissionStatus;
  submittedAt: string | null;
  returnedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  documents: SubmissionDocument[];
}

export interface SubmissionProgress {
  submission: Submission;
  requiredItems: FlatChecklistItem[];
  uploadedItemCodes: string[];
  missingItems: FlatChecklistItem[];
  totalRequired: number;
  totalUploaded: number;
  percentComplete: number;
}

export interface CreateSubmissionInput {
  requestType: string;
  isAbroad: boolean;
  employeeName: string;
  employeeEmail: string;
  officeAffiliation: string;
  collegeOfficeUnit: string;
  currentPosition: string;
  inclusiveDateFrom: string;
  inclusiveDateTo: string;
  yearsInPosition: number;
  yearsInCsu: number;
}

export function useChecklist() {
  const config = useRuntimeConfig();
  const base = config.public.apiBase;

  async function listRequestTypes(): Promise<RequestTypeOption[]> {
    return $fetch(`${base}/checklist/types`);
  }

  async function createSubmission(input: CreateSubmissionInput): Promise<Submission> {
    return $fetch(`${base}/checklist/submissions`, {
      method: 'POST',
      body: input,
      credentials: 'include',
    });
  }

 async function getProgress(submissionId: string): Promise<SubmissionProgress> {
  return $fetch(`${base}/checklist/submissions/${submissionId}`, {
    credentials: 'include',
    cache: 'no-store',
  });
}

  async function uploadDocument(submissionId: string, itemCode: string, file: File) {
    const formData = new FormData();
    formData.append('itemCode', itemCode);
    formData.append('file', file);
    return $fetch(`${base}/checklist/submissions/${submissionId}/documents`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
  }

  async function removeDocument(submissionId: string, itemCode: string) {
    return $fetch(`${base}/checklist/submissions/${submissionId}/documents/${itemCode}`, {
      method: 'DELETE',
      credentials: 'include',
    });
  }

  async function submitSubmission(submissionId: string): Promise<Submission> {
    return $fetch(`${base}/checklist/submissions/${submissionId}/submit`, {
      method: 'POST',
      credentials: 'include',
    });
  }

  // Employee — every request they've ever created, across all statuses.
  async function listMySubmissions(email: string): Promise<Submission[]> {
    return $fetch(`${base}/checklist/submissions`, {
      params: { email },
      credentials: 'include',
      cache: 'no-store',
    });
  }

  // HR/admin — every request that has been formally submitted.
  async function listSubmittedSubmissions(): Promise<Submission[]> {
    return $fetch(`${base}/checklist/admin/submitted`, {
      credentials: 'include',
      cache: 'no-store',
    });
  }

  function getDocumentDownloadUrl(submissionId: string, itemCode: string): string {
    return `${base}/checklist/submissions/${submissionId}/documents/${itemCode}/file`;
  }

  // HR/admin — approve or reject a single uploaded document, with an
  // optional (required-if-rejecting) comment for the employee.
  async function reviewDocument(
    submissionId: string,
    itemCode: string,
    status: 'approved' | 'rejected',
    comment?: string,
  ): Promise<SubmissionDocument> {
    return $fetch(`${base}/checklist/submissions/${submissionId}/documents/${itemCode}/review`, {
      method: 'POST',
      body: { status, comment },
      credentials: 'include',
    });
  }

  // HR/admin — send the request back to the employee (requires 1+ rejected doc).
  async function returnForCorrection(submissionId: string): Promise<Submission> {
    return $fetch(`${base}/checklist/submissions/${submissionId}/return-for-correction`, {
      method: 'POST',
      credentials: 'include',
    });
  }

  // HR/admin — final approval, requires every document individually approved.
  async function approveSubmission(submissionId: string): Promise<Submission> {
    return $fetch(`${base}/checklist/submissions/${submissionId}/approve`, {
      method: 'POST',
      credentials: 'include',
    });
  }

  return {
    listRequestTypes,
    createSubmission,
    getProgress,
    uploadDocument,
    removeDocument,
    submitSubmission,
    listSubmittedSubmissions,
    listMySubmissions,
    getDocumentDownloadUrl,
    reviewDocument,
    returnForCorrection,
    approveSubmission,
  };
}