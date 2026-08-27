import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RequestType } from '../request-type.enum';
import { SubmissionDocument } from './submission-document.entity';

export enum SubmissionStatus {
  IN_PROGRESS = 'in_progress', // employee still uploading
  COMPLETE = 'complete', // all required items uploaded, ready to submit
  SUBMITTED = 'submitted', // employee pressed Submit — locked, awaiting ULDC Sub-Committee screening
  RETURNED_FOR_CORRECTION = 'returned_for_correction', // ULDC rejected 1+ docs, sent back to employee

  // --- Standard flow (every request type EXCEPT Foreign Travel) ---
  FOR_BOARD_DELIBERATION = 'for_board_deliberation', // ULDC approved every document — forwarded to the Board

  // --- Foreign Travel + IMP flow only ---
  ULDC_DELIBERATION = 'uldc_deliberation', // ULDC screening passed — now under full ULDC body deliberation
  FOR_BOARD_CONFIRMATION = 'for_board_confirmation', // Admin Council endorsed — forwarded to the Board to confirm
  FOR_PRESIDENT_APPROVAL = 'for_president_approval', // Board confirmed — forwarded to the President
  PRESIDENT_APPROVED = 'president_approved', // President approved — final state (IMP path)

  // --- Foreign Travel + non-IMP flow only ---
  FOR_PRESIDENT_ENDORSEMENT = 'for_president_endorsement', // Admin Council endorsed — forwarded to the President
  FOR_BOARD_APPROVAL = 'for_board_approval', // President endorsed — forwarded to the Board for final approval

  // --- Shared by: standard flow (final) AND Foreign Travel + non-IMP (final) ---
  FOR_ADMIN_COUNCIL = 'for_admin_council', // Foreign Travel only (either IMP or not) — awaiting Admin Council
  BOARD_APPROVED = 'board_approved', // Board approved — final state
}

// Every status past this point means the request is locked from further
// employee edits (submitted, under review at any stage, or finished).
export const LOCKED_SUBMISSION_STATUSES: SubmissionStatus[] = [
  SubmissionStatus.SUBMITTED,
  SubmissionStatus.FOR_BOARD_DELIBERATION,
  SubmissionStatus.ULDC_DELIBERATION,
  SubmissionStatus.FOR_ADMIN_COUNCIL,
  SubmissionStatus.FOR_BOARD_CONFIRMATION,
  SubmissionStatus.FOR_PRESIDENT_APPROVAL,
  SubmissionStatus.PRESIDENT_APPROVED,
  SubmissionStatus.FOR_PRESIDENT_ENDORSEMENT,
  SubmissionStatus.FOR_BOARD_APPROVAL,
  SubmissionStatus.BOARD_APPROVED,
];

@Entity('submissions')
export class Submission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Comes from the HR login session (employee email / ID)
  @Column()
  employeeEmail: string;

  @Column()
  employeeName: string;

  @Column()
  officeAffiliation: string;

  // Specific college/office/unit within the office affiliation,
  // e.g. "College of Engineering", "HRMS Office"
  @Column()
  collegeOfficeUnit: string;

  @Column()
  currentPosition: string;

  @Column({ type: 'date' })
  inclusiveDateFrom: string;

  @Column({ type: 'date' })
  inclusiveDateTo: string;

  @Column({ type: 'int' })
  yearsInPosition: number;

  @Column({ type: 'int' })
  yearsInCsu: number;

  @Column({ type: 'enum', enum: RequestType })
  requestType: RequestType;

  // Whether the traveling/leave is abroad, used to decide if the
  // CHED IAS Assessment conditional group applies
  @Column({ default: false })
  isAbroad: boolean;

  // Foreign Travel requests only — set by the employee on the form.
  // Determines which multi-stage approval path the request follows
  // (see SubmissionStatus). Ignored for every other request type.
  @Column({ default: false })
  isImp: boolean;

  @Column({ type: 'enum', enum: SubmissionStatus, default: SubmissionStatus.IN_PROGRESS })
  status: SubmissionStatus;

  @Column({ type: 'timestamp', nullable: true })
  submittedAt: Date | null;

  // Set when admin sends the request back to the employee for correction
  @Column({ type: 'timestamp', nullable: true })
  returnedAt: Date | null;

  // Which body sent it back — 'uldc_subcommittee' or 'uldc_committee'.
  // Drives the "The ULDC ___ sent this back" message on the employee's
  // resubmit screen (see RequestForm.vue) instead of hardcoding one body.
  @Column({ type: 'varchar', nullable: true })
  returnedBy: string | null;

  // Set when ULDC approves every document during initial screening
  @Column({ type: 'timestamp', nullable: true })
  uldcApprovedAt: Date | null;

  // Foreign Travel + IMP only — set when ULDC concludes full-body deliberation
  @Column({ type: 'timestamp', nullable: true })
  uldcDeliberationAt: Date | null;

  // Foreign Travel only — set when Admin Council endorses the request
  @Column({ type: 'timestamp', nullable: true })
  adminCouncilEndorsedAt: Date | null;

  // Foreign Travel + IMP only — set when the Board confirms (not final for this path)
  @Column({ type: 'timestamp', nullable: true })
  boardConfirmedAt: Date | null;

  // Foreign Travel + IMP only — set when the President gives final approval
  @Column({ type: 'timestamp', nullable: true })
  presidentApprovedAt: Date | null;

  // Foreign Travel + non-IMP only — set when the President endorses (not final for this path)
  @Column({ type: 'timestamp', nullable: true })
  presidentEndorsedAt: Date | null;

  // Set when the Board gives final approval (standard flow, or Foreign Travel + non-IMP)
  @Column({ type: 'timestamp', nullable: true })
  boardApprovedAt: Date | null;

  @OneToMany(() => SubmissionDocument, (doc) => doc.submission, { cascade: true })
  documents: SubmissionDocument[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}