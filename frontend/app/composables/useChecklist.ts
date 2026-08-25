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
  | 'for_board_deliberation'
  | 'board_approved';

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
  uldcApprovedAt: string | null;
  boardApprovedAt: string | null;
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
  const { token } = useAuth();

  // Every checklist endpoint requires login — attach the bearer token.
  function authHeaders(): Record<string, string> {
    return token.value ? { Authorization: `Bearer ${token.value}` } : {};
  }

  async function listRequestTypes(): Promise<RequestTypeOption[]> {
    return $fetch(`${base}/checklist/types`, { headers: authHeaders() });
  }

  async function createSubmission(input: CreateSubmissionInput): Promise<Submission> {
    return $fetch(`${base}/checklist/submissions`, {
      method: 'POST',
      body: input,
      headers: authHeaders(),
    });
  }

  async function getProgress(submissionId: string): Promise<SubmissionProgress> {
    return $fetch(`${base}/checklist/submissions/${submissionId}`, {
      headers: authHeaders(),
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
      headers: authHeaders(),
    });
  }

  async function removeDocument(submissionId: string, itemCode: string) {
    return $fetch(`${base}/checklist/submissions/${submissionId}/documents/${itemCode}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
  }

  async function submitSubmission(submissionId: string): Promise<Submission> {
    return $fetch(`${base}/checklist/submissions/${submissionId}/submit`, {
      method: 'POST',
      headers: authHeaders(),
    });
  }

  // Employee — every request they've ever created, across all statuses.
  // Identity comes from the logged-in session — no email param needed.
  async function listMySubmissions(): Promise<Submission[]> {
    return $fetch(`${base}/checklist/submissions`, {
      headers: authHeaders(),
      cache: 'no-store',
    });
  }

  // ULDC Sub-Committee — every request that has ever been formally
  // submitted, through its full lifecycle (including after it moves to the Board).
  async function listUldcSubmissions(): Promise<Submission[]> {
    return $fetch(`${base}/checklist/uldc/submitted`, {
      headers: authHeaders(),
      cache: 'no-store',
    });
  }

  // Board — only requests ULDC has already forwarded.
  async function listBoardSubmissions(): Promise<Submission[]> {
    return $fetch(`${base}/checklist/board/submitted`, {
      headers: authHeaders(),
      cache: 'no-store',
    });
  }

  // Document downloads are plain <a>/img src links, which can't carry an
  // Authorization header — append the token as a query param instead.
  // (The backend accepts either; see jwt-auth.guard.ts.)
  function getDocumentDownloadUrl(submissionId: string, itemCode: string): string {
    const qs = token.value ? `?token=${encodeURIComponent(token.value)}` : '';
    return `${base}/checklist/submissions/${submissionId}/documents/${itemCode}/file${qs}`;
  }

  // ULDC Sub-Committee — approve or reject a single uploaded document, with
  // an optional (required-if-rejecting) comment for the employee.
  async function reviewDocument(
    submissionId: string,
    itemCode: string,
    status: 'approved' | 'rejected',
    comment?: string,
  ): Promise<SubmissionDocument> {
    return $fetch(`${base}/checklist/submissions/${submissionId}/documents/${itemCode}/review`, {
      method: 'POST',
      body: { status, comment },
      headers: authHeaders(),
    });
  }

  // ULDC Sub-Committee — send the request back to the employee (requires 1+ rejected doc).
  async function returnForCorrection(submissionId: string): Promise<Submission> {
    return $fetch(`${base}/checklist/submissions/${submissionId}/return-for-correction`, {
      method: 'POST',
      headers: authHeaders(),
    });
  }

  // ULDC Sub-Committee — final screening approval, requires every document
  // individually approved. Forwards the request to the Board.
  async function approveSubmission(submissionId: string): Promise<Submission> {
    return $fetch(`${base}/checklist/submissions/${submissionId}/approve`, {
      method: 'POST',
      headers: authHeaders(),
    });
  }

  // Board — final deliberation action, only valid once ULDC has forwarded
  // the request (status for_board_deliberation).
  async function boardApproveSubmission(submissionId: string): Promise<Submission> {
    return $fetch(`${base}/checklist/submissions/${submissionId}/board-approve`, {
      method: 'POST',
      headers: authHeaders(),
    });
  }

  return {
    listRequestTypes,
    createSubmission,
    getProgress,
    uploadDocument,
    removeDocument,
    submitSubmission,
    listUldcSubmissions,
    listBoardSubmissions,
    listMySubmissions,
    getDocumentDownloadUrl,
    reviewDocument,
    returnForCorrection,
    approveSubmission,
    boardApproveSubmission,
  };
}