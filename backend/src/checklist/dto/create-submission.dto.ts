import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { RequestType } from '../request-type.enum';

export class CreateSubmissionDto {
  @IsEnum(RequestType)
  requestType: RequestType;

  @IsOptional()
  @IsBoolean()
  isAbroad?: boolean;

  @IsString()
  @MinLength(2)
  employeeName: string;

  @IsEmail()
  employeeEmail: string;
}