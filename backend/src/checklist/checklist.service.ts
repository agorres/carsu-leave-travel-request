import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CHECKLISTS, ChecklistItemDef, getChecklistDef } from './checklist-config.data';
import { RequestType, REQUEST_TYPE_LABELS } from './request-type.enum';
import { Submission, SubmissionStatus, LOCKED_SUBMISSION_STATUSES } from './entities/submission.entity';
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
    isImp: dto.isImp ?? false,
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
   * ULDC Sub-Committee view: every request that has ever been formally
   * submitted — under their own screening, sent back for correction, or
   * anywhere further downstream (so they can track a request's full
   * lifecycle even after it leaves their hands, whichever flow it's on).
   * Requests still IN_PROGRESS/COMPLETE (not yet submitted) never appear.
   */
  async listUldcSubcommitteeSubmissions(): Promise<Submission[]> {
    return this.submissionRepo.find({
      where: {
        status: In([
          SubmissionStatus.SUBMITTED,
          SubmissionStatus.RETURNED_FOR_CORRECTION,
          SubmissionStatus.FOR_BOARD_DELIBERATION,
          SubmissionStatus.ULDC_DELIBERATION,
          SubmissionStatus.FOR_PRESIDENT_REFERENCE,
          SubmissionStatus.FOR_ADMIN_COUNCIL,
          SubmissionStatus.FOR_PRESIDENT_APPROVAL,
          SubmissionStatus.PRESIDENT_APPROVED,
          SubmissionStatus.FOR_BOARD_CONFIRMATION,
          SubmissionStatus.BOARD_CONFIRMED,
          SubmissionStatus.FOR_PRESIDENT_ENDORSEMENT,
          SubmissionStatus.FOR_BOARD_APPROVAL,
          SubmissionStatus.BOARD_APPROVED,
        ]),
      },
      relations: { documents: true },
      order: { submittedAt: 'DESC' },
    });
  }

  /**
   * ULDC Committee view (Foreign Travel + IMP only): requests currently
   * under full-body deliberation, plus anything the Committee has already
   * forwarded further downstream, for tracking.
   */
  async listUldcCommitteeSubmissions(): Promise<Submission[]> {
    return this.submissionRepo.find({
      where: {
        status: In([
          SubmissionStatus.ULDC_DELIBERATION,
          SubmissionStatus.FOR_PRESIDENT_REFERENCE,
          SubmissionStatus.FOR_ADMIN_COUNCIL,
          SubmissionStatus.FOR_PRESIDENT_APPROVAL,
          SubmissionStatus.PRESIDENT_APPROVED,
          SubmissionStatus.FOR_BOARD_CONFIRMATION,
          SubmissionStatus.BOARD_CONFIRMED,
        ]),
      },
      relations: { documents: true },
      order: { uldcDeliberationAt: 'DESC' },
    });
  }

  /**
   * Board view: requests currently awaiting Board action (standard-flow
   * final approval, Foreign Travel+non-IMP final approval, or Foreign
   * Travel+IMP confirmation), plus anything the Board has already acted
   * on further downstream, for tracking.
   */
  async listBoardSubmissions(): Promise<Submission[]> {
    return this.submissionRepo.find({
      where: {
        status: In([
          SubmissionStatus.FOR_BOARD_DELIBERATION,
          SubmissionStatus.FOR_PRESIDENT_APPROVAL,
          SubmissionStatus.PRESIDENT_APPROVED,
          SubmissionStatus.FOR_BOARD_CONFIRMATION,
          SubmissionStatus.BOARD_CONFIRMED,
          SubmissionStatus.FOR_BOARD_APPROVAL,
          SubmissionStatus.BOARD_APPROVED,
        ]),
      },
      relations: { documents: true },
      order: { uldcApprovedAt: 'DESC' },
    });
  }

  /**
   * Admin Council view (Foreign Travel only): requests ULDC has forwarded
   * for endorsement, plus anything further downstream for tracking.
   */
  async listAdminCouncilSubmissions(): Promise<Submission[]> {
    return this.submissionRepo.find({
      where: {
        status: In([
          SubmissionStatus.FOR_ADMIN_COUNCIL,
          SubmissionStatus.FOR_PRESIDENT_APPROVAL,
          SubmissionStatus.PRESIDENT_APPROVED,
          SubmissionStatus.FOR_BOARD_CONFIRMATION,
          SubmissionStatus.BOARD_CONFIRMED,
          SubmissionStatus.FOR_PRESIDENT_ENDORSEMENT,
          SubmissionStatus.FOR_BOARD_APPROVAL,
          SubmissionStatus.BOARD_APPROVED,
        ]),
      },
      relations: { documents: true },
      order: { uldcApprovedAt: 'DESC' },
    });
  }

  /**
   * President view (Foreign Travel only): requests awaiting the
   * President's reference slip (IMP, right after ULDC Committee
   * deliberation), endorsement (non-IMP), or approval (IMP), plus
   * anything further downstream for tracking.
   */
  async listPresidentSubmissions(): Promise<Submission[]> {
    return this.submissionRepo.find({
      where: {
        status: In([
          SubmissionStatus.FOR_PRESIDENT_REFERENCE,
          SubmissionStatus.FOR_ADMIN_COUNCIL,
          SubmissionStatus.FOR_PRESIDENT_APPROVAL,
          SubmissionStatus.PRESIDENT_APPROVED,
          SubmissionStatus.FOR_BOARD_CONFIRMATION,
          SubmissionStatus.BOARD_CONFIRMED,
          SubmissionStatus.FOR_PRESIDENT_ENDORSEMENT,
          SubmissionStatus.FOR_BOARD_APPROVAL,
          SubmissionStatus.BOARD_APPROVED,
        ]),
      },
      relations: { documents: true },
      order: { uldcApprovedAt: 'DESC' },
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
      throw new BadRequestException('This request is under ULDC Sub-Committee screening and cannot be edited right now');
    }
    if (LOCKED_SUBMISSION_STATUSES.includes(submission.status)) {
      throw new BadRequestException('This request has already moved past ULDC screening and can no longer be edited');
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
    // A missing document (no `existing` row) counts as fixable too: the only
    // way to reach "no document while returned" is a rejected item whose
    // file was removed after the return — refusing it would leave the
    // submission permanently stuck with no way to complete it.
    if (submission.status === SubmissionStatus.RETURNED_FOR_CORRECTION) {
      if (existing && existing.reviewStatus !== DocumentReviewStatus.REJECTED) {
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
      throw new BadRequestException('This request is under ULDC Sub-Committee screening and cannot be edited right now');
    }
    if (LOCKED_SUBMISSION_STATUSES.includes(submission.status)) {
      throw new BadRequestException('This request has already moved past ULDC screening and can no longer be edited');
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
  /**
   * Employee resubmits after a correction. Routes back to whichever body
   * sent it back (see returnedBy) — Sub-Committee rejections go back to
   * Sub-Committee screening, Committee rejections go straight back to
   * Committee deliberation. Skips the other stage entirely; it's not a
   * second gate, just a return to whoever flagged it.
   */
  async submitSubmission(id: string): Promise<Submission> {
    const submission = await this.getSubmission(id);

    if (submission.status === SubmissionStatus.SUBMITTED) {
      throw new BadRequestException('This request is already under ULDC Sub-Committee screening');
    }
    if (LOCKED_SUBMISSION_STATUSES.includes(submission.status)) {
      throw new BadRequestException('This request has already moved past ULDC screening');
    }

    const progress = await this.getProgress(id);
    if (progress.missingItems.length > 0) {
      throw new BadRequestException('Cannot submit — required documents are still missing');
    }

    let nextStatus = SubmissionStatus.SUBMITTED;
    if (submission.status === SubmissionStatus.RETURNED_FOR_CORRECTION) {
      const stillRejected = submission.documents.some(
        (d) => d.reviewStatus === DocumentReviewStatus.REJECTED,
      );
      if (stillRejected) {
        throw new BadRequestException(
          'Please re-upload every document HR flagged before resubmitting',
        );
      }
      nextStatus =
        submission.returnedBy === 'uldc_committee'
          ? SubmissionStatus.ULDC_DELIBERATION
          : SubmissionStatus.SUBMITTED;
    }

    const submittedAt = new Date();
    await this.submissionRepo.update(id, { status: nextStatus, submittedAt });
    return { ...submission, status: nextStatus, submittedAt };
  }
    /**
   * Admin marks a single uploaded document as approved or rejected.
   *
   * Shared by two review stages, gated by the caller's role so neither
   * can touch the other's stage:
   *   - uldc_subcommittee: while SUBMITTED (active screening) or
   *     RETURNED_FOR_CORRECTION (re-checking a fresh re-upload before the
   *     employee resubmits)
   *   - uldc_committee: while ULDC_DELIBERATION (full-body deliberation,
   *     Foreign Travel + IMP only)
   */
  async reviewDocument(
    submissionId: string,
    itemCode: string,
    dto: ReviewDocumentDto,
    reviewerRole: 'uldc_subcommittee' | 'uldc_committee',
  ): Promise<SubmissionDocument> {
    const submission = await this.getSubmission(submissionId);
    const allowedStatuses =
      reviewerRole === 'uldc_committee'
        ? [SubmissionStatus.ULDC_DELIBERATION]
        : [SubmissionStatus.SUBMITTED, SubmissionStatus.RETURNED_FOR_CORRECTION];
    if (!allowedStatuses.includes(submission.status)) {
      throw new BadRequestException(
        reviewerRole === 'uldc_committee'
          ? 'This request is not currently under ULDC Committee deliberation'
          : 'This request is not currently under ULDC Sub-Committee screening',
      );
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
   * Sends the whole request back to the employee for correction. Requires
   * at least one rejected document — otherwise there's nothing for the
   * employee to fix. Records which body did it (returnedBy) — see
   * submitSubmission, which uses that to route the resubmission straight
   * back to whichever body rejected it.
   */
  async returnForCorrection(
    submissionId: string,
    reviewerRole: 'uldc_subcommittee' | 'uldc_committee',
  ): Promise<Submission> {
    const submission = await this.getSubmission(submissionId);
    const requiredStatus =
      reviewerRole === 'uldc_committee' ? SubmissionStatus.ULDC_DELIBERATION : SubmissionStatus.SUBMITTED;
    if (submission.status !== requiredStatus) {
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
      returnedBy: reviewerRole,
    });
    return {
      ...submission,
      status: SubmissionStatus.RETURNED_FOR_CORRECTION,
      returnedAt,
      returnedBy: reviewerRole,
    };
  }

  /**
   * ULDC Sub-Committee's initial screening approval. Only allowed once
   * every required document has been individually approved. Where this
   * forwards to depends on the request:
   *   - anything except Foreign Travel        -> FOR_BOARD_DELIBERATION
   *   - Foreign Travel + IMP                  -> ULDC_DELIBERATION
   *   - Foreign Travel + not IMP              -> FOR_ADMIN_COUNCIL
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

    const isForeignTravel = submission.requestType === RequestType.FOREIGN_TRAVEL;
    const nextStatus = !isForeignTravel
      ? SubmissionStatus.FOR_BOARD_DELIBERATION
      : submission.isImp
        ? SubmissionStatus.ULDC_DELIBERATION
        : SubmissionStatus.FOR_ADMIN_COUNCIL;

    const uldcApprovedAt = new Date();
    await this.submissionRepo.update(submissionId, { status: nextStatus, uldcApprovedAt });
    return { ...submission, status: nextStatus, uldcApprovedAt };
  }

  /**
   * Foreign Travel + IMP only. ULDC concludes full-body deliberation
   * (the stage after initial screening) and forwards to the President for
   * a reference slip (not Admin Council directly — see
   * submitPresidentReference). Only allowed once every required document
   * is (still) individually approved — same gating as Sub-Committee's
   * approveSubmission.
   */
  async concludeUldcDeliberation(submissionId: string): Promise<Submission> {
    const submission = await this.getSubmission(submissionId);
    if (submission.status !== SubmissionStatus.ULDC_DELIBERATION) {
      throw new BadRequestException('Only a request under ULDC deliberation can be forwarded from here');
    }

    const requiredItems = this.getRequiredItems(submission.requestType, submission.isAbroad);
    const allApproved = requiredItems.every((item) => {
      const doc = submission.documents.find((d) => d.itemCode === item.code);
      return doc?.reviewStatus === DocumentReviewStatus.APPROVED;
    });
    if (!allApproved) {
      throw new BadRequestException('Every document must be individually approved first');
    }

    const uldcDeliberationAt = new Date();
    await this.submissionRepo.update(submissionId, {
      status: SubmissionStatus.FOR_PRESIDENT_REFERENCE,
      uldcDeliberationAt,
    });
    return { ...submission, status: SubmissionStatus.FOR_PRESIDENT_REFERENCE, uldcDeliberationAt };
  }

  /**
   * Foreign Travel + IMP only. President uploads the signed reference
   * slip, referring the request onward to the Admin Council. Sits between
   * ULDC Committee's concludeUldcDeliberation and adminCouncilEndorse.
   */
  async submitPresidentReference(
    submissionId: string,
    file: { originalname: string; path: string; mimetype: string },
  ): Promise<Submission> {
    const submission = await this.getSubmission(submissionId);
    if (submission.status !== SubmissionStatus.FOR_PRESIDENT_REFERENCE) {
      throw new BadRequestException('Only a request awaiting the President\'s reference slip can be referred');
    }

    const presidentReferencedAt = new Date();
    await this.submissionRepo.update(submissionId, {
      status: SubmissionStatus.FOR_ADMIN_COUNCIL,
      presidentReferencedAt,
      referenceSlipStoragePath: file.path,
      referenceSlipOriginalFileName: file.originalname,
      referenceSlipMimeType: file.mimetype,
    });
    return {
      ...submission,
      status: SubmissionStatus.FOR_ADMIN_COUNCIL,
      presidentReferencedAt,
      referenceSlipStoragePath: file.path,
      referenceSlipOriginalFileName: file.originalname,
      referenceSlipMimeType: file.mimetype,
    };
  }

  async getReferenceSlipForDownload(submissionId: string): Promise<Submission> {
    const submission = await this.getSubmission(submissionId);
    if (!submission.referenceSlipStoragePath) {
      throw new NotFoundException('No reference slip has been uploaded for this request');
    }
    return submission;
  }

  /**
   * Foreign Travel only. Admin Council endorses the request — requires
   * attaching a certification file in the same action. Where this
   * forwards to depends on IMP:
   *   - IMP     -> FOR_PRESIDENT_APPROVAL
   *   - not IMP -> FOR_PRESIDENT_ENDORSEMENT
   */
  async adminCouncilEndorse(
    submissionId: string,
    file: { originalname: string; path: string; mimetype: string },
  ): Promise<Submission> {
    const submission = await this.getSubmission(submissionId);
    if (submission.status !== SubmissionStatus.FOR_ADMIN_COUNCIL) {
      throw new BadRequestException('Only a request forwarded to Admin Council can be endorsed');
    }
    if (!file) {
      throw new BadRequestException('A certification file is required to endorse this request');
    }

    const nextStatus = submission.isImp
      ? SubmissionStatus.FOR_PRESIDENT_APPROVAL
      : SubmissionStatus.FOR_PRESIDENT_ENDORSEMENT;

    const adminCouncilEndorsedAt = new Date();
    await this.submissionRepo.update(submissionId, {
      status: nextStatus,
      adminCouncilEndorsedAt,
      certificationStoragePath: file.path,
      certificationOriginalFileName: file.originalname,
      certificationMimeType: file.mimetype,
    });
    return {
      ...submission,
      status: nextStatus,
      adminCouncilEndorsedAt,
      certificationStoragePath: file.path,
      certificationOriginalFileName: file.originalname,
      certificationMimeType: file.mimetype,
    };
  }

  async getCertificationForDownload(submissionId: string): Promise<Submission> {
    const submission = await this.getSubmission(submissionId);
    if (!submission.certificationStoragePath) {
      throw new NotFoundException('No certification has been uploaded for this request');
    }
    return submission;
  }


  /**
   * Foreign Travel + IMP only. President's approval (not final for this
   * path) and forwards to the Board to confirm.
   */
  async presidentApprove(submissionId: string): Promise<Submission> {
    const submission = await this.getSubmission(submissionId);
    if (submission.status !== SubmissionStatus.FOR_PRESIDENT_APPROVAL) {
      throw new BadRequestException('Only a request forwarded to the President can be approved');
    }

    const presidentApprovedAt = new Date();
    await this.submissionRepo.update(submissionId, {
      status: SubmissionStatus.FOR_BOARD_CONFIRMATION,
      presidentApprovedAt,
    });
    return { ...submission, status: SubmissionStatus.FOR_BOARD_CONFIRMATION, presidentApprovedAt };
  }

  /**
   * Foreign Travel + IMP only. Board's confirmation — last stage in this
   * path.
   */
  async boardConfirm(submissionId: string): Promise<Submission> {
    const submission = await this.getSubmission(submissionId);
    if (submission.status !== SubmissionStatus.FOR_BOARD_CONFIRMATION) {
      throw new BadRequestException('Only a request forwarded to the Board for confirmation can be confirmed');
    }

    const boardConfirmedAt = new Date();
    await this.submissionRepo.update(submissionId, {
      status: SubmissionStatus.BOARD_CONFIRMED,
      boardConfirmedAt,
    });
    return { ...submission, status: SubmissionStatus.BOARD_CONFIRMED, boardConfirmedAt };
  }

  /**
   * Foreign Travel + non-IMP only. President endorses (not final for this
   * path) and forwards to the Board for final approval.
   */
  async presidentEndorse(submissionId: string): Promise<Submission> {
    const submission = await this.getSubmission(submissionId);
    if (submission.status !== SubmissionStatus.FOR_PRESIDENT_ENDORSEMENT) {
      throw new BadRequestException('Only a request forwarded to the President for endorsement can be endorsed');
    }

    const presidentEndorsedAt = new Date();
    await this.submissionRepo.update(submissionId, {
      status: SubmissionStatus.FOR_BOARD_APPROVAL,
      presidentEndorsedAt,
    });
    return { ...submission, status: SubmissionStatus.FOR_BOARD_APPROVAL, presidentEndorsedAt };
  }

  /**
   * Board's final approval action. Valid from either:
   *   - FOR_BOARD_DELIBERATION (standard flow — every non-Foreign-Travel type)
   *   - FOR_BOARD_APPROVAL (Foreign Travel + non-IMP, after President endorses)
   * Locks the submission permanently — the last stage in both of those paths.
   */
  async boardApprove(submissionId: string): Promise<Submission> {
    const submission = await this.getSubmission(submissionId);
    if (
      submission.status !== SubmissionStatus.FOR_BOARD_DELIBERATION &&
      submission.status !== SubmissionStatus.FOR_BOARD_APPROVAL
    ) {
      throw new BadRequestException('Only a request currently awaiting final Board approval can be approved');
    }

    const boardApprovedAt = new Date();
    await this.submissionRepo.update(submissionId, {
      status: SubmissionStatus.BOARD_APPROVED,
      boardApprovedAt,
    });
    return { ...submission, status: SubmissionStatus.BOARD_APPROVED, boardApprovedAt };
  }
}