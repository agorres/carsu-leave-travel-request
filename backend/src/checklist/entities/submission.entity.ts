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
  SUBMITTED = 'submitted', // employee pressed Submit — locked, awaiting admin screening
  RETURNED_FOR_CORRECTION = 'returned_for_correction', // admin rejected 1+ docs, sent back to employee
  APPROVED = 'approved', // admin approved every document — final state
}

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

  @Column({ type: 'enum', enum: SubmissionStatus, default: SubmissionStatus.IN_PROGRESS })
  status: SubmissionStatus;

  @Column({ type: 'timestamp', nullable: true })
  submittedAt: Date | null;

  // Set when admin sends the request back to the employee for correction
  @Column({ type: 'timestamp', nullable: true })
  returnedAt: Date | null;

  // Set when admin gives final approval (every document reviewed & approved)
  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @OneToMany(() => SubmissionDocument, (doc) => doc.submission, { cascade: true })
  documents: SubmissionDocument[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}