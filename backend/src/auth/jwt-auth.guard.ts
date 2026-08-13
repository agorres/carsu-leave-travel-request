import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

// Reads a bearer token from the Authorization header (not a cookie — the
// frontend and backend run on different ports/origins in dev, and bearer
// tokens sidestep cross-site cookie headaches entirely).
// Attaches { email, role } to req.user for @CurrentUser() to read.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];
    // Plain <a>/<img> links (e.g. document downloads) can't set an
    // Authorization header, so also accept the token as a query param there.
    const token =
      (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null) ??
      (typeof request.query?.token === 'string' ? request.query.token : null);

    if (!token) {
      throw new UnauthorizedException('Sign in to continue');
    }

    try {
      const payload = this.jwtService.verify(token);
      request.user = { email: payload.sub, role: payload.role };
      return true;
    } catch {
      throw new UnauthorizedException('Your session has expired. Please sign in again.');
    }
  }
}
