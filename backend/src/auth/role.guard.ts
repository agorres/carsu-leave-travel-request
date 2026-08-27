import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

// All guards must run AFTER JwtAuthGuard (they rely on req.user already
// being set). Usage: @UseGuards(JwtAuthGuard, ReviewerGuard)

const REVIEWER_ROLES = ['uldc_subcommittee', 'uldc_committee', 'board', 'admin_council', 'president'];

// Any reviewer role — used for actions/views every reviewing body is
// allowed to reach (e.g. viewing a submission's detail page and its
// uploaded documents, regardless of which stage it's in).
@Injectable()
export class ReviewerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const role = request.user?.role;
    if (!REVIEWER_ROLES.includes(role)) {
      throw new ForbiddenException('Reviewer access required');
    }
    return true;
  }
}

// ULDC Sub-Committee OR ULDC Committee — document screening actions that
// both stages now share (approve/reject individual documents, send back
// for correction). Which submission statuses each role may actually act
// on is enforced in ChecklistService, keyed off the caller's role, so a
// Sub-Committee member can't touch Committee-stage documents and vice
// versa even though both pass this guard.
@Injectable()
export class UldcScreeningGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const role = request.user?.role;
    if (role !== 'uldc_subcommittee' && role !== 'uldc_committee') {
      throw new ForbiddenException('ULDC Sub-Committee or ULDC Committee access required');
    }
    return true;
  }
}

// ULDC Sub-Committee-only — document screening actions (approve/reject
// individual documents, send back for correction, forward to the next
// stage).
@Injectable()
export class UldcSubcommitteeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (request.user?.role !== 'uldc_subcommittee') {
      throw new ForbiddenException('ULDC Sub-Committee access required');
    }
    return true;
  }
}

// ULDC Committee-only — full-body deliberation action. Today this is only
// reachable on the Foreign Travel + IMP path (SubmissionStatus.ULDC_DELIBERATION).
@Injectable()
export class UldcCommitteeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (request.user?.role !== 'uldc_committee') {
      throw new ForbiddenException('ULDC Committee access required');
    }
    return true;
  }
}

// Board-only — confirmation (Foreign Travel + IMP) and final approval
// (standard flow, and Foreign Travel + non-IMP) actions.
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

// Admin Council-only — Foreign Travel endorsement action.
@Injectable()
export class AdminCouncilGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (request.user?.role !== 'admin_council') {
      throw new ForbiddenException('Admin Council access required');
    }
    return true;
  }
}

// President-only — Foreign Travel endorsement (non-IMP) and final
// approval (IMP) actions.
@Injectable()
export class PresidentGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (request.user?.role !== 'president') {
      throw new ForbiddenException('President access required');
    }
    return true;
  }
}