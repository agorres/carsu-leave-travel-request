import { IsString } from 'class-validator';

export class UploadDocumentDto {
  @IsString()
  itemCode: string; // e.g. "letter_of_intent" or "ched_ias_foreign_travel:certificate_urgency"
}