import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import type { Response } from 'express';
import { ChecklistService } from './checklist.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { ReviewDocumentDto } from './dto/review-document.dto';
import { RequestType } from './request-type.enum';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReviewerGuard, UldcSubcommitteeGuard, UldcCommitteeGuard, UldcScreeningGuard, BoardGuard, AdminCouncilGuard, PresidentGuard } from '../auth/role.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUserPayload } from '../auth/current-user.decorator';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

@UseGuards(JwtAuthGuard)
@Controller('checklist')
export class ChecklistController {
  constructor(private readonly checklistService: ChecklistService) {}

  @Get('types')
  listTypes() {
    return this.checklistService.listRequestTypes();
  }

  @Get('types/:type')
  getChecklist(@Param('type') type: RequestType) {
    return this.checklistService.getChecklist(type);
  }

  @Post('submissions')
  createSubmission(@Body() dto: CreateSubmissionDto, @CurrentUser() user: CurrentUserPayload) {
    // The employee identity always comes from the logged-in session, never
    // from client-supplied fields — prevents filing a request as someone else.
    return this.checklistService.createSubmission({ ...dto, employeeEmail: user.email });
  }

  @Get('submissions')
  listMySubmissions(@CurrentUser() user: CurrentUserPayload) {
    return this.checklistService.listSubmissionsForEmployee(user.email);
  }

  @Get('submissions/:id')
  async getSubmissionProgress(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    await this.assertOwnerOrAdmin(id, user);
    return this.checklistService.getProgress(id);
  }

  // ULDC Sub-Committee view — every request that has ever been formally
  // submitted, through the full pipeline (including after it moves to the Board).
  @UseGuards(UldcSubcommitteeGuard)
  @Get('uldc-subcommittee/submitted')
  listUldcSubcommitteeSubmissions() {
    return this.checklistService.listUldcSubcommitteeSubmissions();
  }

  // ULDC Committee view (Foreign Travel + IMP only) — requests under full-
  // body deliberation, plus anything already forwarded further downstream.
  @UseGuards(UldcCommitteeGuard)
  @Get('uldc-committee/submitted')
  listUldcCommitteeSubmissions() {
    return this.checklistService.listUldcCommitteeSubmissions();
  }

  // Board view — only requests ULDC has already forwarded.
  @UseGuards(BoardGuard)
  @Get('board/submitted')
  listBoardSubmissions() {
    return this.checklistService.listBoardSubmissions();
  }

  // Admin Council view (Foreign Travel only) — requests ULDC has forwarded
  // for endorsement.
  @UseGuards(AdminCouncilGuard)
  @Get('admin-council/submitted')
  listAdminCouncilSubmissions() {
    return this.checklistService.listAdminCouncilSubmissions();
  }

  // President view (Foreign Travel only) — requests awaiting endorsement
  // (non-IMP) or final approval (IMP).
  @UseGuards(PresidentGuard)
  @Get('president/submitted')
  listPresidentSubmissions() {
    return this.checklistService.listPresidentSubmissions();
  }

  @Get('submissions/:id/documents/:itemCode/file')
  async downloadDocument(
    @Param('id') submissionId: string,
    @Param('itemCode') itemCode: string,
    @CurrentUser() user: CurrentUserPayload,
    @Res() res: Response,
    @Query('download') download?: string,
  ) {
    await this.assertOwnerOrAdmin(submissionId, user);
    const doc = await this.checklistService.getDocumentForDownload(submissionId, itemCode);
    const absolutePath = join(process.cwd(), doc.storagePath);
    // "inline" lets the browser preview the file in a new tab (View File);
    // "attachment" forces an actual download instead (Download button).
    const disposition = download ? 'attachment' : 'inline';
    res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(doc.originalFileName)}"`);
    res.type(doc.mimeType);
    res.sendFile(absolutePath);
  }

    @Get('submissions/:id/certification/file')
  async downloadCertification(
    @Param('id') submissionId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Res() res: Response,
    @Query('download') download?: string,
  ) {
    await this.assertOwnerOrAdmin(submissionId, user);
    const submission = await this.checklistService.getCertificationForDownload(submissionId);
    const absolutePath = join(process.cwd(), submission.certificationStoragePath!);
    const disposition = download ? 'attachment' : 'inline';
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${encodeURIComponent(submission.certificationOriginalFileName!)}"`,
    );
    res.type(submission.certificationMimeType!);
    res.sendFile(absolutePath);
  }

  @Get('submissions/:id/reference-slip/file')
  async downloadReferenceSlip(
    @Param('id') submissionId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Res() res: Response,
    @Query('download') download?: string,
  ) {
    await this.assertOwnerOrAdmin(submissionId, user);
    const submission = await this.checklistService.getReferenceSlipForDownload(submissionId);
    const absolutePath = join(process.cwd(), submission.referenceSlipStoragePath!);
    const disposition = download ? 'attachment' : 'inline';
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${encodeURIComponent(submission.referenceSlipOriginalFileName!)}"`,
    );
    res.type(submission.referenceSlipMimeType!);
    res.sendFile(absolutePath);
  }

  @Post('submissions/:id/documents')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/checklist',
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          return cb(new Error('Unsupported file type'), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadDocument(
    @Param('id') submissionId: string,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.assertOwnerOrAdmin(submissionId, user);
    return this.checklistService.attachDocument(submissionId, dto.itemCode, file);
  }

  @Delete('submissions/:id/documents/:itemCode')
  async removeDocument(
    @Param('id') submissionId: string,
    @Param('itemCode') itemCode: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.assertOwnerOrAdmin(submissionId, user);
    return this.checklistService.removeDocument(submissionId, itemCode);
  }

  @Post('submissions/:id/submit')
  async submitSubmission(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    await this.assertOwnerOrAdmin(id, user);
    return this.checklistService.submitSubmission(id);
  }

  // --- ULDC document screening actions (Sub-Committee during initial
  // screening, Committee during full-body deliberation) ---

  @UseGuards(UldcScreeningGuard)
  @Post('submissions/:id/documents/:itemCode/review')
  reviewDocument(
    @Param('id') submissionId: string,
    @Param('itemCode') itemCode: string,
    @Body() dto: ReviewDocumentDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.checklistService.reviewDocument(
      submissionId,
      itemCode,
      dto,
      user.role as 'uldc_subcommittee' | 'uldc_committee',
    );
  }

  @UseGuards(UldcScreeningGuard)
  @Post('submissions/:id/return-for-correction')
  returnForCorrection(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.checklistService.returnForCorrection(
      id,
      user.role as 'uldc_subcommittee' | 'uldc_committee',
    );
  }

  @UseGuards(UldcSubcommitteeGuard)
  @Post('submissions/:id/approve')
  approveSubmission(@Param('id') id: string) {
    return this.checklistService.approveSubmission(id);
  }

  // --- ULDC Committee action ---

  // Foreign Travel + IMP only — ULDC Committee concludes full-body
  // deliberation and forwards to Admin Council.
  @UseGuards(UldcCommitteeGuard)
  @Post('submissions/:id/conclude-uldc-deliberation')
  concludeUldcDeliberation(@Param('id') id: string) {
    return this.checklistService.concludeUldcDeliberation(id);
  }


    // --- Admin Council action (Foreign Travel only) ---

  // Requires a certification file uploaded in the same action.
  @UseGuards(AdminCouncilGuard)
  @Post('submissions/:id/admin-council-endorse')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/checklist',
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          return cb(new Error('Unsupported file type'), false);
        }
        cb(null, true);
      },
    }),
  )
  adminCouncilEndorse(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.checklistService.adminCouncilEndorse(id, file);
  }

  // --- President actions (Foreign Travel only) ---

  // Foreign Travel + IMP only — President uploads the signed reference
  // slip, referring the request onward to the Admin Council. Sits between
  // the ULDC Committee concluding deliberation and Admin Council endorsement.
  @UseGuards(PresidentGuard)
  @Post('submissions/:id/president-reference')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/checklist',
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          return cb(new Error('Unsupported file type'), false);
        }
        cb(null, true);
      },
    }),
  )
  presidentReference(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.checklistService.submitPresidentReference(id, file);
  }

  // Foreign Travel + IMP only — final approval.
  @UseGuards(PresidentGuard)
  @Post('submissions/:id/president-approve')
  presidentApprove(@Param('id') id: string) {
    return this.checklistService.presidentApprove(id);
  }

  // Foreign Travel + non-IMP only — endorsement, forwards to the Board.
  @UseGuards(PresidentGuard)
  @Post('submissions/:id/president-endorse')
  presidentEndorse(@Param('id') id: string) {
    return this.checklistService.presidentEndorse(id);
  }

  // --- Board actions ---

  // Foreign Travel + IMP only — confirmation, forwards to the President.
  @UseGuards(BoardGuard)
  @Post('submissions/:id/board-confirm')
  boardConfirm(@Param('id') id: string) {
    return this.checklistService.boardConfirm(id);
  }

  // Final approval — valid from the standard flow (every non-Foreign-Travel
  // type) or Foreign Travel + non-IMP (after the President endorses).
  @UseGuards(BoardGuard)
  @Post('submissions/:id/board-approve')
  boardApprove(@Param('id') id: string) {
    return this.checklistService.boardApprove(id);
  }

  // Employees can only touch their own submissions; any reviewer role
  // can touch/view any submission.
  private async assertOwnerOrAdmin(submissionId: string, user: CurrentUserPayload) {
    const reviewerRoles = ['uldc_subcommittee', 'uldc_committee', 'board', 'admin_council', 'president'];
    if (reviewerRoles.includes(user.role)) return;
    const submission = await this.checklistService.getSubmission(submissionId);
    if (submission.employeeEmail !== user.email) {
      throw new ForbiddenException('You do not have access to this request');
    }
  }
}