import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

// All three guards must run AFTER JwtAuthGuard (they rely on req.user
// already being set). Usage: @UseGuards(JwtAuthGuard, ReviewerGuard)

// Either reviewer role — used for actions/views both ULDC and the Board
// are allowed to reach (e.g. viewing a submission's detail page and its
// uploaded documents, regardless of which stage it's in).
@Injectable()
export class ReviewerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const role = request.user?.role;
    if (role !== 'uldc' && role !== 'board') {
      throw new ForbiddenException('ULDC Sub-Committee or Board access required');
    }
    return true;
  }
}

// ULDC-only — document screening actions (approve/reject individual
// documents, send back for correction, forward to the Board).
@Injectable()
export class UldcGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (request.user?.role !== 'uldc') {
      throw new ForbiddenException('ULDC Sub-Committee access required');
    }
    return true;
  }
}

// Board-only — final deliberation action.
@Injectable()
export class BoardGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (request.user?.role !== 'board') {
      throw new ForbiddenException('Board access required');
    }
    return true;
  }
}