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
  COMPLETE = 'complete', // all required items uploaded
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

  @OneToMany(() => SubmissionDocument, (doc) => doc.submission, { cascade: true })
  documents: SubmissionDocument[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}