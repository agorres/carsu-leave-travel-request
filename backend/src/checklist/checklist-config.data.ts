import { RequestType } from './request-type.enum';

/**
 * A single required document. `code` is stable and used as the key
 * for tracking which items an employee has uploaded.
 */
export interface ChecklistItemDef {
  code: string;
  label: string;
  /** Free-text hint shown under the item, e.g. "template available at HRMS Office" */
  note?: string;
}

/**
 * A conditional block of items that only applies in certain cases
 * (e.g. CHED IAS Assessment only applies to study/travel abroad).
 */
export interface ChecklistGroupDef {
  code: string;
  label: string;
  /** Shown to the employee to explain when this group applies */
  description?: string;
  items: ChecklistItemDef[];
}

export interface ChecklistDef {
  type: RequestType;
  title: string;
  items: ChecklistItemDef[];
  conditionalGroups?: ChecklistGroupDef[];
}

const chedIasAbroadStudy: ChecklistGroupDef = {
  code: 'ched_ias_study_abroad',
  label: 'CHED IAS Assessment (Study Leave Abroad only)',
  description: 'Required only if the study leave is abroad. Submit to OIGE.',
  items: [
    { code: 'notice_admission', label: 'Notice of Admission/Letter of Acceptance from the DHEI' },
    { code: 'notice_scholarship', label: 'Notice of Scholarship Acceptance' },
    { code: 'dhei_scholarship_info', label: 'Detailed information of the DHEI and Scholarship Program' },
    { code: 'ias_form', label: 'Filled-up IAS Form', note: 'downloadable from the CSU website' },
  ],
};

const chedIasForeignTravel: ChecklistGroupDef = {
  code: 'ched_ias_foreign_travel',
  label: 'CHED IAS Assessment',
  description: 'Submit to OIGE to secure CHED IAS Assessment.',
  items: [
    { code: 'invitation_letter_ias', label: 'Invitation Letter' },
    { code: 'event_organizer_info', label: 'Detailed information of the event and organizer' },
    { code: 'ias_form', label: 'Filled-up IAS Form', note: 'downloadable from the CSU website' },
    { code: 'certificate_urgency', label: 'Certificate of Urgency' },
  ],
};

export const CHECKLISTS: ChecklistDef[] = [
  {
    type: RequestType.STUDY_LEAVE,
    title: 'Checklist of Requirements for Study Leave Request',
    items: [
      { code: 'letter_of_intent', label: 'Letter of Intent' },
      { code: 'notice_admission', label: 'Notice of Admission/Letter of Acceptance from the DHEI' },
      { code: 'notice_scholarship', label: 'Notice of Scholarship Acceptance' },
      { code: 'iflpd', label: 'Consolidated Individual Faculty Learning & Development Plan (IFLDP)', note: 'available at the HRMS Office' },
      { code: 're_entry_plan', label: 'Re-entry Action Plan', note: 'template available at the HRMS Office' },
      { code: 'program_of_study', label: 'Detailed Program of Study' },
      { code: 'faculty_replacement', label: 'Faculty replacement to cover the classes that will be missed / Make-up Class Schedule' },
      { code: 'special_order_oic', label: 'Special Order – For OIC', note: 'for personnel with designation' },
      { code: 'itinerary', label: 'Itinerary of Travel', note: 'specify dates of travel' },
      { code: 'pds', label: 'Personal Data Sheet (PDS)' },
      { code: 'service_record', label: 'Service Record' },
      { code: 'medical_certificate', label: 'Medical Certificate', note: 'issued by the University physical and mental clinic or its equivalent' },
      { code: 'cert_no_pending_scholarship', label: 'Certificate confirming the absence of any pending scholarships', note: 'available at the HRMS Office' },
      { code: 'return_service_accomplishment', label: 'Return Service Accomplishment (Previous study leave)' },
      { code: 'performance_eval', label: 'Performance evaluation rating of at least Very Satisfactory (VS) for two (2) consecutive evaluations' },
      { code: 'fellowship_contract', label: 'Fellowship Contract', note: 'template available at the HRMS Office' },
      { code: 'suretyship_agreement', label: 'Suretyship Agreement', note: 'template available at the HRMS Office' },
      { code: 'cs_form_6', label: 'CS Form No. 6 Application for Leave', note: 'template available at the HRMS Office' },
      { code: 'cs_form_7', label: 'CS Form No. 7 Clearance', note: 'once request is approved by the BOR' },
    ],
    conditionalGroups: [chedIasAbroadStudy],
  },
  {
    type: RequestType.FOREIGN_TRAVEL,
    title: 'Checklist of Requirements for Foreign Travel Request',
    items: [
      { code: 'letter_of_intent', label: 'Letter of Intent' },
      { code: 'invitation_letter', label: 'Invitation Letter with attached copy of Conference brochure or Program and/or details of the Activity' },
      { code: 'proof_of_acceptance', label: 'Proof of Acceptance' },
      { code: 'itinerary', label: 'Itinerary of Travel', note: 'specify dates of travel' },
      { code: 'travel_order', label: 'Travel Order' },
      { code: 're_entry_plan', label: 'Re-entry Action Plan', note: 'template available at the HRMS Office' },
      { code: 'faculty_replacement', label: 'Faculty replacement to cover the classes that will be missed' },
      { code: 'special_order_oic', label: 'Special Order – For OIC', note: 'for personnel with designation' },
      { code: 'caf', label: 'Certificate of Availability of Funds (CAF)', note: 'for travels with funding requirement — Accounting Office' },
      { code: 'cert_budget_allocation', label: 'Certificate of Budget Allocation', note: 'for travels with funding requirement — Budget Office' },
      { code: 'cert_no_unliquidated_ca', label: 'Certificate of no unliquidated cash advances', note: 'Accounting Office' },
      { code: 'cert_no_pending_terminal_report', label: 'Certificate of no pending project terminal report', note: 'OVPRDIE' },
      { code: 'cert_employment', label: 'Certificate of Employment', note: 'HRMS' },
      { code: 'cs_form_7', label: 'CS Form No. 7 Clearance', note: 'for travel of 30 days or more' },
      { code: 'necessity_of_travel', label: 'Necessity of Foreign Travel' },
      { code: 'roles_of_personnel', label: 'Roles of Personnel for Official Foreign Travel' },
      { code: 'monitoring_form', label: 'Foreign Travel Monitoring Form', note: 'template available at the OIGE' },
    ],
    conditionalGroups: [chedIasForeignTravel],
  },
  {
    type: RequestType.PERSONAL_TRAVEL,
    title: 'Checklist of Requirements for Personal Travel Request',
    items: [
      { code: 'letter_of_intent', label: 'Letter of Intent' },
      { code: 'cs_form_6', label: 'CS Form No. 6 Application for Leave', note: 'template available at the HRMS Office' },
      { code: 'plane_ticket', label: 'Round trip Plane ticket' },
    ],
  },
  {
    type: RequestType.SABBATICAL_LEAVE,
    title: 'Checklist of Requirements for Sabbatical Leave Request',
    items: [
      { code: 'letter_of_intent', label: 'Letter of Intent' },
      { code: 'scholarly_work_proposal', label: 'Scholarly Work Proposal' },
      { code: 're_entry_plan', label: 'Re-entry Action Plan', note: 'template available at the HRMS Office' },
      { code: 'faculty_replacement', label: 'Faculty replacement for work/teaching load' },
      { code: 'special_order_oic', label: 'Special Order – For OIC/replacement', note: 'for personnel with designation' },
      { code: 'pds', label: 'Personal Data Sheet (PDS)' },
      { code: 'service_record', label: 'Service Record' },
      { code: 'cs_form_6', label: 'CS Form No. 6 Application for Leave', note: 'once request is approved by the BOR' },
      { code: 'cs_form_7', label: 'CS Form No. 7 Clearance', note: 'once request is approved by the BOR' },
    ],
  },
  {
    type: RequestType.STUDY_LEAVE_EXTENSION,
    title: 'Checklist of Requirements for Study Leave Extension Request',
    items: [
      { code: 'letter_of_intent', label: 'Letter of Intent' },
      { code: 'endorsement_letter', label: 'Endorsement letter duly signed by adviser/program coordinator' },
      { code: 'evaluation_of_grades', label: 'Evaluation of Grades' },
      { code: 'cor', label: 'Certificate of Registration (COR)' },
      { code: 'gantt_chart', label: 'Gantt Chart' },
      { code: 're_entry_plan', label: 'Re-entry Action Plan', note: 'template available at the HRMS Office' },
      { code: 'revised_program_of_study', label: 'Revised Program of Study' },
      { code: 'progress_report', label: 'Progress Report of previous study leave extension', note: 'if any' },
      { code: 'pds', label: 'Personal Data Sheet (PDS)' },
      { code: 'service_record', label: 'Service Record' },
      { code: 'fellowship_contract_renewal', label: 'Renewal of Fellowship Contract' },
    ],
  },
  {
    type: RequestType.LOCAL_TRAVEL,
    title: 'Checklist of Requirements for Local Travel Request (w/ Funding Requirement)',
    items: [
      { code: 'letter_of_intent', label: 'Letter of Intent' },
      { code: 'invitation_letter', label: 'Invitation Letter' },
      { code: 'itinerary', label: 'Itinerary of Travel', note: 'specify dates of travel' },
      { code: 'travel_order', label: 'Travel Order' },
      { code: 'faculty_replacement', label: 'Faculty replacement to cover the classes that will be missed' },
      { code: 'special_order_oic', label: 'Special Order – For OIC', note: 'for personnel with designation' },
      { code: 'caf', label: 'Certification of Availability of Funds (CAF)' },
      { code: 'cs_form_7', label: 'CS Form No. 7 Clearance', note: 'for travel of 30 days or more' },
    ],
  },
];

export function getChecklistDef(type: RequestType): ChecklistDef | undefined {
  return CHECKLISTS.find((c) => c.type === type);
}