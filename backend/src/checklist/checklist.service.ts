import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CHECKLISTS, ChecklistItemDef, getChecklistDef } from './checklist-config.data';
import { RequestType, REQUEST_TYPE_LABELS } from './request-type.enum';
import { Submission, SubmissionStatus } from './entities/submission.entity';
import { SubmissionDocument } from './entities/submission-document.entity';
import { CreateSubmissionDto } from './dto/create-submission.dto';

export interface FlatChecklistItem {
  code: string; // fully-qualified: "letter_of_intent" or "groupCode:itemCode"
  label: string;
  note?: string;
  groupLabel?: string;
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

@Injectable()
export class ChecklistService {
  constructor(
    @InjectRepository(Submission)
    private readonly submissionRepo: Repository<Submission>,
    @InjectRepository(SubmissionDocument)
    private readonly documentRepo: Repository<SubmissionDocument>,
  ) {}

  listRequestTypes() {
    return Object.values(RequestType).map((type) => ({
      type,
      label: REQUEST_TYPE_LABELS[type],
    }));
  }

  getChecklist(type: RequestType) {
    const def = getChecklistDef(type);
    if (!def) throw new NotFoundException(`No checklist defined for type "${type}"`);
    return def;
  }

  /**
   * Flattens a checklist's base items + any applicable conditional groups
   * into a single list of items the employee must upload.
   */
  getRequiredItems(type: RequestType, isAbroad: boolean): FlatChecklistItem[] {
    const def = this.getChecklist(type);
    const base: FlatChecklistItem[] = def.items.map((i) => ({
      code: i.code,
      label: i.label,
      note: i.note,
    }));

    if (isAbroad && def.conditionalGroups?.length) {
      for (const group of def.conditionalGroups) {
        for (const item of group.items) {
          base.push({
            code: `${group.code}:${item.code}`,
            label: item.label,
            note: item.note,
            groupLabel: group.label,
          });
        }
      }
    }
    return base;
  }

  async createSubmission(dto: CreateSubmissionDto): Promise<Submission> {
  // Validate the type exists
  this.getChecklist(dto.requestType);

  const submission = this.submissionRepo.create({
    employeeEmail: dto.employeeEmail,
    employeeName: dto.employeeName,
    requestType: dto.requestType,
    isAbroad: dto.isAbroad ?? false,
    status: SubmissionStatus.IN_PROGRESS,
  });
  return this.submissionRepo.save(submission);
}
  async getSubmission(id: string): Promise<Submission> {
    const submission = await this.submissionRepo.findOne({
      where: { id },
      relations: { documents: true },
    });
    if (!submission) throw new NotFoundException('Submission not found');
    return submission;
  }

  async listSubmissionsForEmployee(employeeEmail: string): Promise<Submission[]> {
    return this.submissionRepo.find({
      where: { employeeEmail },
      relations: { documents: true },
      order: { createdAt: 'DESC' },
    });
  }

  async getProgress(id: string): Promise<SubmissionProgress> {
    const submission = await this.getSubmission(id);
    const requiredItems = this.getRequiredItems(submission.requestType, submission.isAbroad);
    const uploadedItemCodes = submission.documents.map((d) => d.itemCode);
    const missingItems = requiredItems.filter((i) => !uploadedItemCodes.includes(i.code));

    return {
      submission,
      requiredItems,
      uploadedItemCodes,
      missingItems,
      totalRequired: requiredItems.length,
      totalUploaded: requiredItems.length - missingItems.length,
      percentComplete: requiredItems.length
        ? Math.round(((requiredItems.length - missingItems.length) / requiredItems.length) * 100)
        : 0,
    };
  }

  async attachDocument(
    submissionId: string,
    itemCode: string,
    file: { originalname: string; path: string; mimetype: string; size: number },
  ): Promise<SubmissionDocument> {
    const submission = await this.getSubmission(submissionId);
    const requiredItems = this.getRequiredItems(submission.requestType, submission.isAbroad);
    const isValidItem = requiredItems.some((i) => i.code === itemCode);
    if (!isValidItem) {
      throw new BadRequestException(`"${itemCode}" is not a required item for this request type`);
    }

    // Replace any existing upload for this item (re-upload overwrites)
    const existing = await this.documentRepo.findOne({ where: { submissionId, itemCode } });
    if (existing) {
      await this.documentRepo.remove(existing);
    }

    const doc = this.documentRepo.create({
      submissionId,
      itemCode,
      originalFileName: file.originalname,
      storagePath: file.path,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
    });
    const saved = await this.documentRepo.save(doc);

    // Auto-update status once everything required is in
    const progress = await this.getProgress(submissionId);
    if (progress.missingItems.length === 0) {
      submission.status = SubmissionStatus.COMPLETE;
      await this.submissionRepo.save(submission);
    }

    return saved;
  }

  async removeDocument(submissionId: string, itemCode: string): Promise<void> {
    const doc = await this.documentRepo.findOne({ where: { submissionId, itemCode } });
    if (!doc) throw new NotFoundException('Document not found for this item');
    await this.documentRepo.remove(doc);

    const submission = await this.getSubmission(submissionId);
    if (submission.status === SubmissionStatus.COMPLETE) {
      submission.status = SubmissionStatus.IN_PROGRESS;
      await this.submissionRepo.save(submission);
    }
  }
}