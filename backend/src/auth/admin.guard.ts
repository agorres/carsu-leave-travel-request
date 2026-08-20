import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

// Must run AFTER JwtAuthGuard (relies on req.user already being set).
// @UseGuards(JwtAuthGuard, AdminGuard)
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (request.user?.role !== 'admin') {
      throw new ForbiddenException('ULDC Sub-Committee access required');
    }
    return true;
  }
}