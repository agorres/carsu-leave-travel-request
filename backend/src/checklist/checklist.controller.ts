import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
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
import { AdminGuard } from '../auth/admin.guard';
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

  // HR/admin view — every request that has been formally submitted.
  @UseGuards(AdminGuard)
  @Get('admin/submitted')
  listSubmitted() {
    return this.checklistService.listSubmittedSubmissions();
  }

  @Get('submissions/:id/documents/:itemCode/file')
  async downloadDocument(
    @Param('id') submissionId: string,
    @Param('itemCode') itemCode: string,
    @CurrentUser() user: CurrentUserPayload,
    @Res() res: Response,
  ) {
    await this.assertOwnerOrAdmin(submissionId, user);
    const doc = await this.checklistService.getDocumentForDownload(submissionId, itemCode);
    const absolutePath = join(process.cwd(), doc.storagePath);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.originalFileName)}"`);
    res.type(doc.mimeType);
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

  // --- HR/admin document screening actions ---

  @UseGuards(AdminGuard)
  @Post('submissions/:id/documents/:itemCode/review')
  reviewDocument(
    @Param('id') submissionId: string,
    @Param('itemCode') itemCode: string,
    @Body() dto: ReviewDocumentDto,
  ) {
    return this.checklistService.reviewDocument(submissionId, itemCode, dto);
  }

  @UseGuards(AdminGuard)
  @Post('submissions/:id/return-for-correction')
  returnForCorrection(@Param('id') id: string) {
    return this.checklistService.returnForCorrection(id);
  }

  @UseGuards(AdminGuard)
  @Post('submissions/:id/approve')
  approveSubmission(@Param('id') id: string) {
    return this.checklistService.approveSubmission(id);
  }

  // Employees can only touch their own submissions; admins can touch any.
  private async assertOwnerOrAdmin(submissionId: string, user: CurrentUserPayload) {
    if (user.role === 'admin') return;
    const submission = await this.checklistService.getSubmission(submissionId);
    if (submission.employeeEmail !== user.email) {
      throw new ForbiddenException('You do not have access to this request');
    }
  }
}
