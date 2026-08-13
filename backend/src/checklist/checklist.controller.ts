import {
  Body,
  Controller,
  Delete,
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

// Swap these for your actual HR email-login guard/decorator.
// CurrentUser is expected to expose { email, name } from the session/JWT.
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

//@UseGuards(JwtAuthGuard)//
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
createSubmission(@Body() dto: CreateSubmissionDto) {
  return this.checklistService.createSubmission(dto);
}

@Get('submissions')
listMySubmissions(@Query('email') email: string) {
  return this.checklistService.listSubmissionsForEmployee(email);
}

  @Get('submissions/:id')
  getSubmissionProgress(@Param('id') id: string) {
    return this.checklistService.getProgress(id);
  }

  // HR/admin view — every request that has been formally submitted.
  @Get('admin/submitted')
  listSubmitted() {
    return this.checklistService.listSubmittedSubmissions();
  }

  @Get('submissions/:id/documents/:itemCode/file')
  async downloadDocument(
    @Param('id') submissionId: string,
    @Param('itemCode') itemCode: string,
    @Res() res: Response,
  ) {
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
  uploadDocument(
    @Param('id') submissionId: string,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.checklistService.attachDocument(submissionId, dto.itemCode, file);
  }

  @Delete('submissions/:id/documents/:itemCode')
  removeDocument(@Param('id') submissionId: string, @Param('itemCode') itemCode: string) {
    return this.checklistService.removeDocument(submissionId, itemCode);
  }

  @Post('submissions/:id/submit')
  submitSubmission(@Param('id') id: string) {
    return this.checklistService.submitSubmission(id);
  }

  // --- HR/admin document screening actions ---

  @Post('submissions/:id/documents/:itemCode/review')
  reviewDocument(
    @Param('id') submissionId: string,
    @Param('itemCode') itemCode: string,
    @Body() dto: ReviewDocumentDto,
  ) {
    return this.checklistService.reviewDocument(submissionId, itemCode, dto);
  }

  @Post('submissions/:id/return-for-correction')
  returnForCorrection(@Param('id') id: string) {
    return this.checklistService.returnForCorrection(id);
  }

  @Post('submissions/:id/approve')
  approveSubmission(@Param('id') id: string) {
    return this.checklistService.approveSubmission(id);
  }
}