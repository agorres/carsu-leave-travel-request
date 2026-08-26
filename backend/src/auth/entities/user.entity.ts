import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum UserRole {
  EMPLOYEE = 'employee',
  // Initial document screening (approve/reject individual documents, send
  // back for correction, forward the request onward once every document
  // is approved).
  ULDC_SUBCOMMITTEE = 'uldc_subcommittee',
  // Full-body deliberation stage. Today this only exists on the Foreign
  // Travel + IMP path (see SubmissionStatus.ULDC_DELIBERATION) — every
  // other request type skips straight from Sub-Committee screening to
  // the Board.
  ULDC_COMMITTEE = 'uldc_committee',
  BOARD = 'board',
  ADMIN_COUNCIL = 'admin_council',
  PRESIDENT = 'president',
}

// Created/updated the first time someone completes a magic-link login.
// Role is derived from ULDC_SUBCOMMITTEE_EMAILS / ULDC_COMMITTEE_EMAILS /
// BOARD_EMAILS / ADMIN_COUNCIL_EMAILS / PRESIDENT_EMAILS at login time, so
// promoting/demoting a reviewer is just an env var change (see
// auth.service.ts).
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.EMPLOYEE })
  role: UserRole;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}