import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChecklistController } from './checklist.controller';
import { ChecklistService } from './checklist.service';
import { Submission } from './entities/submission.entity';
import { SubmissionDocument } from './entities/submission-document.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Submission, SubmissionDocument])],
  controllers: [ChecklistController],
  providers: [ChecklistService],
  exports: [ChecklistService],
})
export class ChecklistModule {}