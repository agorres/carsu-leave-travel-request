import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DocumentReviewStatus } from '../entities/submission-document.entity';

export class ReviewDocumentDto {
  @IsEnum(DocumentReviewStatus)
  status: DocumentReviewStatus.APPROVED | DocumentReviewStatus.REJECTED;

  // Required (enforced in the service) when rejecting — the employee needs
  // to know what to fix. Optional when approving.
  @IsOptional()
  @IsString()
  comment?: string;
}
