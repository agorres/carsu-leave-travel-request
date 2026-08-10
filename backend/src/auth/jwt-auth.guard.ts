import { AuthGuard } from '@nestjs/passport';

// Stub — replace with your actual email-only HR login guard/strategy.
// Kept as a separate guard so this module drops into any auth setup.
export class JwtAuthGuard extends AuthGuard('jwt') {}