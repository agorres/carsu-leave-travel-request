import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ReviewerGuard, UldcGuard, BoardGuard } from './role.guard';
import { User } from './entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    JwtModule.register({
      // Set JWT_SECRET in .env for real deployments — this fallback is
      // fine for local dev only.
      secret: process.env.JWT_SECRET ?? 'dev-only-insecure-secret-change-me',
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, ReviewerGuard, UldcGuard, BoardGuard],
  exports: [JwtAuthGuard, ReviewerGuard, UldcGuard, BoardGuard, JwtModule],
})
export class AuthModule {}