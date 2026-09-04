import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Submission } from './submission.entity';

export enum DocumentReviewStatus {
  PENDING = 'pending', // uploaded, not yet screened by admin
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ACKNOWLEDGED = 'acknowledged', // N/A items only — reviewer has acknowledged, no approve/reject applies
}

@Entity('submission_documents')
export class SubmissionDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Submission, (submission) => submission.documents, { onDelete: 'CASCADE' })
  submission: Submission;

  @Column()
  submissionId: string;

  // Matches ChecklistItemDef.code from checklist-config.data.ts.
  // Prefixed with groupCode for conditional-group items, e.g. "ched_ias_foreign_travel:certificate_urgency"
  @Column()
  itemCode: string;

  // True when the employee has marked this requirement as Not Applicable
  // instead of uploading a file. When true, the file columns below are null.
  @Column({ default: false })
  isNotApplicable: boolean;

  @Column({ type: 'varchar', nullable: true })
  originalFileName: string | null;

  // Path/key in storage (local disk, S3, etc — swap out in the service)
  @Column({ type: 'varchar', nullable: true })
  storagePath: string | null;

  @Column({ type: 'varchar', nullable: true })
  mimeType: string | null;

  @Column({ type: 'bigint', nullable: true })
  fileSizeBytes: number | null;

  @Column({ type: 'enum', enum: DocumentReviewStatus, default: DocumentReviewStatus.PENDING })
  reviewStatus: DocumentReviewStatus;

  // Admin's remark — required when rejecting, optional otherwise
  @Column({ type: 'text', nullable: true })
  reviewComment: string | null;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn()
  uploadedAt: Date;
}