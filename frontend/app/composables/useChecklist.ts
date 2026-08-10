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

export interface SubmissionDocument {
  id: string;
  itemCode: string;
  originalFileName: string;
  uploadedAt: string;
}

export interface Submission {
  id: string;
  requestType: string;
  isAbroad: boolean;
  status: 'in_progress' | 'complete';
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

export function useChecklist() {
  const config = useRuntimeConfig();
  const base = config.public.apiBase; // e.g. https://api.example.gov.ph

  async function listRequestTypes(): Promise<RequestTypeOption[]> {
    return $fetch(`${base}/checklist/types`);
  }

  async function createSubmission(
  requestType: string,
  isAbroad: boolean,
  employeeName: string,
  employeeEmail: string,
): Promise<Submission> {
  return $fetch(`${base}/checklist/submissions`, {
    method: 'POST',
    body: { requestType, isAbroad, employeeName, employeeEmail },
    credentials: 'include',
  });
}
  async function getProgress(submissionId: string): Promise<SubmissionProgress> {
    return $fetch(`${base}/checklist/submissions/${submissionId}`, {
      credentials: 'include',
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

  return { listRequestTypes, createSubmission, getProgress, uploadDocument, removeDocument };
}