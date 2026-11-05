import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class BoardNotApproveDto {
  // Required: the employee and every reviewer need to know why the Board
  // did not approve the request.
  @IsString()
  @IsNotEmpty({ message: 'Please give the reason the request was not approved' })
  @MaxLength(2000)
  reason: string;
}