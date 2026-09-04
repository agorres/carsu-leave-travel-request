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

export type DocumentReviewStatus = 'pending' | 'approved' | 'rejected' | 'acknowledged';

export interface SubmissionDocument {
  id: string;
  itemCode: string;
  isNotApplicable: boolean;
  originalFileName: string | null;
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
  // standard flow (every request type except Foreign Travel)
  | 'for_board_deliberation'
  // Foreign Travel + IMP only
  | 'uldc_deliberation'
  | 'for_president_reference'
  | 'for_president_approval'
  | 'president_approved'
  | 'for_board_confirmation'
  | 'board_confirmed'
  // Foreign Travel + non-IMP only
  | 'for_president_endorsement'
  | 'for_board_approval'
  // Foreign Travel only (either IMP or not)
  | 'for_admin_council'
  // final for standard flow AND Foreign Travel + non-IMP
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
  isImp: boolean;
  status: SubmissionStatus;
  submittedAt: string | null;
  returnedAt: string | null;
  returnedBy: string | null;
  uldcApprovedAt: string | null;
  uldcDeliberationAt: string | null;
  presidentReferencedAt: string | null;
  referenceSlipOriginalFileName: string | null;
  certificationOriginalFileName: string | null;
  adminCouncilEndorsedAt: string | null;
  boardConfirmedAt: string | null;
  presidentApprovedAt: string | null;
  presidentEndorsedAt: string | null;
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
  isImp: boolean;
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

  // Employee marks a required item as Not Applicable instead of uploading
  // a file. Same locking/gating rules as uploadDocument on the backend.
  async function markNotApplicable(submissionId: string, itemCode: string): Promise<SubmissionDocument> {
    return $fetch(`${base}/checklist/submissions/${submissionId}/documents/${itemCode}/na`, {
      method: 'POST',
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
  async function listUldcSubcommitteeSubmissions(): Promise<Submission[]> {
    return $fetch(`${base}/checklist/uldc-subcommittee/submitted`, {
      headers: authHeaders(),
      cache: 'no-store',
    });
  }

  // ULDC Committee (Foreign Travel + IMP only) — requests under full-body
  // deliberation, plus anything already forwarded further downstream.
  async function listUldcCommitteeSubmissions(): Promise<Submission[]> {
    return $fetch(`${base}/checklist/uldc-committee/submitted`, {
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

  // Admin Council (Foreign Travel only) — requests ULDC has forwarded for endorsement.
  async function listAdminCouncilSubmissions(): Promise<Submission[]> {
    return $fetch(`${base}/checklist/admin-council/submitted`, {
      headers: authHeaders(),
      cache: 'no-store',
    });
  }

  // President (Foreign Travel only) — requests awaiting endorsement or final approval.
  async function listPresidentSubmissions(): Promise<Submission[]> {
    return $fetch(`${base}/checklist/president/submitted`, {
      headers: authHeaders(),
      cache: 'no-store',
    });
  }

  // Document downloads are plain <a>/img src links, which can't carry an
  // Authorization header — append the token as a query param instead.
  // (The backend accepts either; see jwt-auth.guard.ts.)
  function getDocumentDownloadUrl(
    submissionId: string,
    itemCode: string,
    opts?: { download?: boolean },
  ): string {
    const params = new URLSearchParams();
    if (token.value) params.set('token', token.value);
    if (opts?.download) params.set('download', '1');
    const qs = params.toString() ? `?${params.toString()}` : '';
    return `${base}/checklist/submissions/${submissionId}/documents/${itemCode}/file${qs}`;
  }

  // ULDC Sub-Committee or ULDC Committee (role is read from the JWT
  // server-side) — approve or reject a single uploaded document, with an
  // optional (required-if-rejecting) comment for the employee.
  async function reviewDocument(
    submissionId: string,
    itemCode: string,
    status: 'approved' | 'rejected' | 'acknowledged',
    comment?: string,
  ): Promise<SubmissionDocument> {
    return $fetch(`${base}/checklist/submissions/${submissionId}/documents/${itemCode}/review`, {
      method: 'POST',
      body: { status, comment },
      headers: authHeaders(),
    });
  }

  // ULDC Sub-Committee or ULDC Committee — send the request back to the
  // employee (requires 1+ rejected doc at whichever stage is calling).
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

  // Board — final approval action, valid from either the standard flow
  // (for_board_deliberation) or Foreign Travel + non-IMP (for_board_approval).
  async function boardApproveSubmission(submissionId: string): Promise<Submission> {
    return $fetch(`${base}/checklist/submissions/${submissionId}/board-approve`, {
      method: 'POST',
      headers: authHeaders(),
    });
  }

  // Foreign Travel + IMP only — ULDC Committee concludes full-body
  // deliberation, forwards to Admin Council.
  async function concludeUldcDeliberation(submissionId: string): Promise<Submission> {
    return $fetch(`${base}/checklist/submissions/${submissionId}/conclude-uldc-deliberation`, {
      method: 'POST',
      headers: authHeaders(),
    });
  }

    // Foreign Travel only — Admin Council endorses (forwards to Board
  // confirmation if IMP, or President endorsement if not). Requires a
  // certification file attached in the same action.
  async function adminCouncilEndorse(submissionId: string, file: File): Promise<Submission> {
    const formData = new FormData();
    formData.append('file', file);
    return $fetch(`${base}/checklist/submissions/${submissionId}/admin-council-endorse`, {
      method: 'POST',
      body: formData,
      headers: authHeaders(),
    });
  }

  // Certification download — same pattern as getReferenceSlipDownloadUrl.
  function getCertificationDownloadUrl(submissionId: string, opts?: { download?: boolean }): string {
    const params = new URLSearchParams();
    if (token.value) params.set('token', token.value);
    if (opts?.download) params.set('download', '1');
    const qs = params.toString() ? `?${params.toString()}` : '';
    return `${base}/checklist/submissions/${submissionId}/certification/file${qs}`;
  }

  // Foreign Travel + IMP only — Board's confirmation, the final step in this path.
  async function boardConfirm(submissionId: string): Promise<Submission> {
    return $fetch(`${base}/checklist/submissions/${submissionId}/board-confirm`, {
      method: 'POST',
      headers: authHeaders(),
    });
  }

  // Foreign Travel + IMP only — President uploads the signed reference
  // slip, referring the request onward to Admin Council. Sits between
  // concludeUldcDeliberation and adminCouncilEndorse.
  async function submitPresidentReference(submissionId: string, file: File): Promise<Submission> {
    const formData = new FormData();
    formData.append('file', file);
    return $fetch(`${base}/checklist/submissions/${submissionId}/president-reference`, {
      method: 'POST',
      body: formData,
      headers: authHeaders(),
    });
  }

  // Reference slip download — same pattern as getDocumentDownloadUrl
  // (plain link, token passed as a query param).
  function getReferenceSlipDownloadUrl(submissionId: string, opts?: { download?: boolean }): string {
    const params = new URLSearchParams();
    if (token.value) params.set('token', token.value);
    if (opts?.download) params.set('download', '1');
    const qs = params.toString() ? `?${params.toString()}` : '';
    return `${base}/checklist/submissions/${submissionId}/reference-slip/file${qs}`;
  }

  // Foreign Travel + IMP only — President's approval (not final), forwards to the Board to confirm.
  async function presidentApprove(submissionId: string): Promise<Submission> {
    return $fetch(`${base}/checklist/submissions/${submissionId}/president-approve`, {
      method: 'POST',
      headers: authHeaders(),
    });
  }

  // Foreign Travel + non-IMP only — President endorses (not final), forwards to the Board.
  async function presidentEndorse(submissionId: string): Promise<Submission> {
    return $fetch(`${base}/checklist/submissions/${submissionId}/president-endorse`, {
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
    markNotApplicable,
    submitSubmission,
    listUldcSubcommitteeSubmissions,
    listUldcCommitteeSubmissions,
    listBoardSubmissions,
    listAdminCouncilSubmissions,
    listPresidentSubmissions,
    listMySubmissions,
    getDocumentDownloadUrl,
    reviewDocument,
    returnForCorrection,
    approveSubmission,
    boardApproveSubmission,
    concludeUldcDeliberation,
    adminCouncilEndorse,
    getCertificationDownloadUrl,
    boardConfirm,
    submitPresidentReference,
    getReferenceSlipDownloadUrl,
    presidentApprove,
    presidentEndorse,
  };
}