import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum UserRole {
  EMPLOYEE = 'employee',
  ULDC = 'uldc',
  BOARD = 'board',
  ADMIN_COUNCIL = 'admin_council',
  PRESIDENT = 'president',
}

// Created/updated the first time someone completes a magic-link login.
// Role is derived from ULDC_EMAILS / BOARD_EMAILS / ADMIN_COUNCIL_EMAILS /
// PRESIDENT_EMAILS at login time, so promoting/demoting a reviewer is just
// an env var change (see auth.service.ts).
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