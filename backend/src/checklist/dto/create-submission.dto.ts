import { IsBoolean, IsDateString, IsEmail, IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
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

  @IsString()
  @MinLength(2)
  officeAffiliation: string;

  @IsString()
  @MinLength(2)
  currentPosition: string;

  @IsDateString()
  inclusiveDateFrom: string;

  @IsDateString()
  inclusiveDateTo: string;

  @IsInt()
  @Min(0)
  yearsInPosition: number;

  @IsInt()
  @Min(0)
  yearsInCsu: number;
}