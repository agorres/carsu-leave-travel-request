import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';

const SESSION_TTL = '7d';

// Comma-separated allowlist, e.g. "hr@carsu.edu.ph,records@carsu.edu.ph".
// Anyone whose email is on this list gets the admin role on login; a
// missing env var just means "no admins yet" rather than "everyone is
// admin" — fail closed.
function adminEmailSet(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

// Restrict who can log in at all. Empty/unset = no restriction.
function isAllowedDomain(email: string): boolean {
  const domain = (process.env.ALLOWED_EMAIL_DOMAIN ?? '').trim().toLowerCase();
  if (!domain) return true;
  return email.toLowerCase().endsWith(`@${domain}`);
}

export interface AuthResult {
  accessToken: string;
  user: { email: string; name: string | null; role: UserRole };
}

// NOTE: this is email-only identification, not verified authentication —
// there is no password, magic link, or any other proof the requester
// actually owns the email address they typed. Anyone who knows/guesses a
// CARSU email (including HR's) can sign in as that person. Fine for a
// low-stakes internal tool where this tradeoff was made deliberately;
// revisit if this ever needs to resist someone acting maliciously.
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async login(rawEmail: string): Promise<AuthResult> {
    const email = rawEmail.trim().toLowerCase();
    if (!isAllowedDomain(email)) {
      throw new BadRequestException(
        `Only ${process.env.ALLOWED_EMAIL_DOMAIN} email addresses can sign in`,
      );
    }

    const role = adminEmailSet().has(email) ? UserRole.ADMIN : UserRole.EMPLOYEE;

    let user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      user = this.userRepo.create({ email, role, lastLoginAt: new Date() });
    } else {
      user.role = role; // keep in sync with ADMIN_EMAILS in case it changed
      user.lastLoginAt = new Date();
    }
    await this.userRepo.save(user);

    return this.issueSession(user);
  }

  async getCurrentUser(email: string): Promise<AuthResult['user']> {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) throw new BadRequestException('Account not found');
    return { email: user.email, name: user.name, role: user.role };
  }

  private issueSession(user: User): AuthResult {
    const accessToken = this.jwtService.sign(
      { sub: user.email, role: user.role },
      { expiresIn: SESSION_TTL },
    );
    return { accessToken, user: { email: user.email, name: user.name, role: user.role } };
  }
}
