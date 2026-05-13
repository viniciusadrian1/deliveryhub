import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { LoginInput } from './dto/login.dto.js';
import type { SignupInput } from './dto/signup.dto.js';
import { PasswordService } from './password.service.js';
import { TokensService } from './tokens.service.js';

export interface AuthResult {
  accessToken: string;
  expiresAt: Date;
  user: {
    id: string;
    email: string;
    name: string;
  };
  organization: {
    id: string;
    name: string;
  };
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokensService,
  ) {}

  async signup(input: SignupInput): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException('email_already_in_use');
    }

    const passwordHash = await this.passwords.hash(input.password);

    const { user, membership, organization } = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: input.organizationName },
      });

      const user = await tx.user.create({
        data: { email: input.email, passwordHash, name: input.name },
      });

      const membership = await tx.membership.create({
        data: { organizationId: organization.id, userId: user.id, role: 'owner' },
      });

      return { user, membership, organization };
    });

    return this.buildAuthResult(user, membership, organization);
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      include: { memberships: { include: { organization: true }, take: 1 } },
    });

    if (!user) {
      throw new UnauthorizedException('invalid_credentials');
    }

    const valid = await this.passwords.verify(user.passwordHash, input.password);
    if (!valid) {
      throw new UnauthorizedException('invalid_credentials');
    }

    const membership = user.memberships[0];
    if (!membership) {
      throw new UnauthorizedException('no_organization');
    }

    return this.buildAuthResult(user, membership, membership.organization);
  }

  private async buildAuthResult(
    user: { id: string; email: string; name: string },
    membership: { role: string },
    organization: { id: string; name: string },
  ): Promise<AuthResult> {
    const { token, expiresAt } = await this.tokens.signAccessToken({
      sub: user.id,
      orgId: organization.id,
      role: membership.role,
    });

    return {
      accessToken: token,
      expiresAt,
      user: { id: user.id, email: user.email, name: user.name },
      organization: { id: organization.id, name: organization.name },
      role: membership.role,
    };
  }
}
