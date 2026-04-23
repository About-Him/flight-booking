import { IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateStaffUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsIn(['ASSOCIATE', 'SENIOR_ASSOCIATE'])
  role!: 'ASSOCIATE' | 'SENIOR_ASSOCIATE';
}
