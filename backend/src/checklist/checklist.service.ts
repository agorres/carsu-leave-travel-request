import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CHECKLISTS, ChecklistItemDef, getChecklistDef } from './checklist-config.data';
import { RequestType, REQUEST_TYPE_LABELS } from './request-type.enum';
import { Submission, SubmissionStatus } from './entities/submission.entity';
import { SubmissionDocument, DocumentReviewStatus } from './entities/submission-document.entity';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { ReviewDocumentDto } from './dto/review-document.dto';

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
  this.getChecklist(dto.requestType);

  const submission = this.submissionRepo.create({
    employeeEmail: dto.employeeEmail,
    employeeName: dto.employeeName,
    officeAffiliation: dto.officeAffiliation,
    collegeOfficeUnit: dto.collegeOfficeUnit,
    currentPosition: dto.currentPosition,
    inclusiveDateFrom: dto.inclusiveDateFrom,
    inclusiveDateTo: dto.inclusiveDateTo,
    yearsInPosition: dto.yearsInPosition,
    yearsInCsu: dto.yearsInCsu,
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

  /**
   * HR/admin view: every request that has ever been formally submitted —
   * i.e. currently under screening, sent back for correction, or already
   * approved. Requests still IN_PROGRESS/COMPLETE (not yet submitted) never
   * appear here.
   */
  async listSubmittedSubmissions(): Promise<Submission[]> {
    return this.submissionRepo.find({
      where: {
        status: In([
          SubmissionStatus.SUBMITTED,
          SubmissionStatus.RETURNED_FOR_CORRECTION,
          SubmissionStatus.APPROVED,
        ]),
      },
      relations: { documents: true },
      order: { submittedAt: 'DESC' },
    });
  }

  async getDocumentForDownload(submissionId: string, itemCode: string): Promise<SubmissionDocument> {
    const doc = await this.documentRepo.findOne({ where: { submissionId, itemCode } });
    if (!doc) throw new NotFoundException('Document not found for this item');
    return doc;
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

    if (submission.status === SubmissionStatus.SUBMITTED) {
      throw new BadRequestException('This request is under HR screening and cannot be edited right now');
    }
    if (submission.status === SubmissionStatus.APPROVED) {
      throw new BadRequestException('This request has already been approved and can no longer be edited');
    }

    const requiredItems = this.getRequiredItems(submission.requestType, submission.isAbroad);
    const isValidItem = requiredItems.some((i) => i.code === itemCode);
    if (!isValidItem) {
      throw new BadRequestException(`"${itemCode}" is not a required item for this request type`);
    }

    // Replace any existing upload for this item (re-upload overwrites)
    const existing = await this.documentRepo.findOne({ where: { submissionId, itemCode } });

    // Once sent back for correction, the employee may only touch items HR
    // flagged as rejected — approved and not-yet-reviewed items stay locked.
    if (submission.status === SubmissionStatus.RETURNED_FOR_CORRECTION) {
      if (!existing || existing.reviewStatus !== DocumentReviewStatus.REJECTED) {
        throw new BadRequestException(
          'Only documents HR flagged for correction can be re-uploaded',
        );
      }
    }

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
      reviewStatus: DocumentReviewStatus.PENDING,
      reviewComment: null,
      reviewedAt: null,
    });
    const saved = await this.documentRepo.save(doc);

    // Auto-update status once everything required is in.
    // Uses a targeted update (not submissionRepo.save(submission)) because
    // `submission` was loaded before this document existed — saving that
    // stale entity would cascade-delete this brand-new document, since its
    // `documents` relation array doesn't include it yet.
    // Only applies pre-submission — RETURNED_FOR_CORRECTION has its own
    // "Resubmit" action instead of auto-flipping status.
    if (submission.status === SubmissionStatus.IN_PROGRESS) {
      const progress = await this.getProgress(submissionId);
      if (progress.missingItems.length === 0) {
        await this.submissionRepo.update(submissionId, { status: SubmissionStatus.COMPLETE });
      }
    }

    return saved;
  }

  async removeDocument(submissionId: string, itemCode: string): Promise<void> {
    const submission = await this.getSubmission(submissionId);
    if (submission.status === SubmissionStatus.SUBMITTED) {
      throw new BadRequestException('This request is under HR screening and cannot be edited right now');
    }
    if (submission.status === SubmissionStatus.APPROVED) {
      throw new BadRequestException('This request has already been approved and can no longer be edited');
    }

    const doc = await this.documentRepo.findOne({ where: { submissionId, itemCode } });
    if (!doc) throw new NotFoundException('Document not found for this item');

    if (submission.status === SubmissionStatus.RETURNED_FOR_CORRECTION) {
      if (doc.reviewStatus !== DocumentReviewStatus.REJECTED) {
        throw new BadRequestException('Only documents HR flagged for correction can be removed');
      }
    }

    await this.documentRepo.remove(doc);

    if (submission.status === SubmissionStatus.COMPLETE) {
      await this.submissionRepo.update(submissionId, { status: SubmissionStatus.IN_PROGRESS });
    }
  }

  /**
   * Explicit submit action. Handles both the first submission (from
   * IN_PROGRESS/COMPLETE) and re-submission after correction (from
   * RETURNED_FOR_CORRECTION). Either way it locks the submission for HR
   * screening.
   */
  async submitSubmission(id: string): Promise<Submission> {
    const submission = await this.getSubmission(id);

    if (submission.status === SubmissionStatus.SUBMITTED) {
      throw new BadRequestException('This request is already under HR screening');
    }
    if (submission.status === SubmissionStatus.APPROVED) {
      throw new BadRequestException('This request has already been approved');
    }

    const progress = await this.getProgress(id);
    if (progress.missingItems.length > 0) {
      throw new BadRequestException('Cannot submit — required documents are still missing');
    }

    if (submission.status === SubmissionStatus.RETURNED_FOR_CORRECTION) {
      const stillRejected = submission.documents.some(
        (d) => d.reviewStatus === DocumentReviewStatus.REJECTED,
      );
      if (stillRejected) {
        throw new BadRequestException(
          'Please re-upload every document HR flagged before resubmitting',
        );
      }
    }

    const submittedAt = new Date();
    await this.submissionRepo.update(id, { status: SubmissionStatus.SUBMITTED, submittedAt });
    return { ...submission, status: SubmissionStatus.SUBMITTED, submittedAt };
  }

  /**
   * Admin marks a single uploaded document as approved or rejected.
   * Only valid while the submission is under active screening
   * (SUBMITTED) or already sent back but HR is re-checking a fresh
   * re-upload (RETURNED_FOR_CORRECTION — e.g. reviewing a corrected file
   * before the employee resubmits).
   */
  async reviewDocument(
    submissionId: string,
    itemCode: string,
    dto: ReviewDocumentDto,
  ): Promise<SubmissionDocument> {
    const submission = await this.getSubmission(submissionId);
    if (
      submission.status !== SubmissionStatus.SUBMITTED &&
      submission.status !== SubmissionStatus.RETURNED_FOR_CORRECTION
    ) {
      throw new BadRequestException('This request is not currently under HR screening');
    }

    if (dto.status === DocumentReviewStatus.REJECTED && !dto.comment?.trim()) {
      throw new BadRequestException('A comment is required when rejecting a document');
    }

    const doc = await this.documentRepo.findOne({ where: { submissionId, itemCode } });
    if (!doc) throw new NotFoundException('Document not found for this item');

    doc.reviewStatus = dto.status;
    doc.reviewComment = dto.status === DocumentReviewStatus.REJECTED ? dto.comment!.trim() : (dto.comment?.trim() ?? null);
    doc.reviewedAt = new Date();
    return this.documentRepo.save(doc);
  }

  /**
   * Admin sends the whole request back to the employee for correction.
   * Requires at least one rejected document — otherwise there's nothing
   * for the employee to fix.
   */
  async returnForCorrection(submissionId: string): Promise<Submission> {
    const submission = await this.getSubmission(submissionId);
    if (submission.status !== SubmissionStatus.SUBMITTED) {
      throw new BadRequestException('Only a request currently under screening can be returned');
    }

    const hasRejected = submission.documents.some(
      (d) => d.reviewStatus === DocumentReviewStatus.REJECTED,
    );
    if (!hasRejected) {
      throw new BadRequestException(
        'Reject at least one document with a comment before sending this back',
      );
    }

    const returnedAt = new Date();
    await this.submissionRepo.update(submissionId, {
      status: SubmissionStatus.RETURNED_FOR_CORRECTION,
      returnedAt,
    });
    return { ...submission, status: SubmissionStatus.RETURNED_FOR_CORRECTION, returnedAt };
  }

  /**
   * Final HR approval. Only allowed once every required document has been
   * individually approved. Locks the submission permanently.
   */
  async approveSubmission(submissionId: string): Promise<Submission> {
    const submission = await this.getSubmission(submissionId);
    if (submission.status !== SubmissionStatus.SUBMITTED) {
      throw new BadRequestException('Only a request currently under screening can be approved');
    }

    const requiredItems = this.getRequiredItems(submission.requestType, submission.isAbroad);
    const allApproved = requiredItems.every((item) => {
      const doc = submission.documents.find((d) => d.itemCode === item.code);
      return doc?.reviewStatus === DocumentReviewStatus.APPROVED;
    });
    if (!allApproved) {
      throw new BadRequestException('Every document must be individually approved first');
    }

    const approvedAt = new Date();
    await this.submissionRepo.update(submissionId, {
      status: SubmissionStatus.APPROVED,
      approvedAt,
    });
    return { ...submission, status: SubmissionStatus.APPROVED, approvedAt };
  }
}