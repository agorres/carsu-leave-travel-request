import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChecklistController } from './checklist.controller';
import { ChecklistService } from './checklist.service';
import { Submission } from './entities/submission.entity';
import { SubmissionDocument } from './entities/submission-document.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Submission, SubmissionDocument]), AuthModule],
  controllers: [ChecklistController],
  providers: [ChecklistService],
  exports: [ChecklistService],
})
export class ChecklistModule {}