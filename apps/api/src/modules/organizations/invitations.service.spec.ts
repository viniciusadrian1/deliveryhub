import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env.js', () => ({ loadEnv: () => ({ WEB_BASE_URL: 'http://localhost:3101' }) }));
import { InvitationsService } from './invitations.service.js';

function fixture(configured = false) {
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue(null) },
    organization: { findUniqueOrThrow: vi.fn().mockResolvedValue({ name: 'Teste' }) },
    invitation: {
      findFirst: vi.fn().mockResolvedValue({ id: 'old' }),
      create: vi.fn().mockResolvedValue({ id: 'new' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      delete: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  const email = { configured, send: vi.fn().mockResolvedValue(undefined) };
  const passwords = { verify: vi.fn().mockResolvedValue(false) };
  const service = new InvitationsService(prisma as never, {} as never, passwords as never,
    { hashRefreshToken: vi.fn().mockReturnValue('hash') } as never, email as never,
    { record: vi.fn() } as never, {} as never);
  return { service, prisma, email, passwords };
}

describe('invitation delivery and renewal', () => {
  it('renews a pending invitation and supplies a usable link when email is not configured', async () => {
    const { service, prisma, email } = fixture();
    const result = await service.create('org', 'owner', 'owner', 'test@example.com', 'staff');
    expect(result.delivery).toBe('link');
    expect(result.invitationUrl).toMatch(/^http:\/\/localhost:3101\/auth\/invitations\/accept\?token=.+/);
    expect(email.send).not.toHaveBeenCalled();
    expect(prisma.invitation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: 'org', email: 'test@example.com', id: { not: 'new' } }),
    }));
  });
  it('preserves the earlier invitation if sending the replacement fails', async () => {
    const { service, prisma, email } = fixture(true);
    email.send.mockRejectedValue(new Error('provider unavailable'));
    await expect(service.create('org', 'owner', 'owner', 'test@example.com', 'staff')).rejects.toThrow('invitation_email_failed');
    expect(prisma.invitation.delete).toHaveBeenCalledWith({ where: { id: 'new' } });
    expect(prisma.invitation.updateMany).not.toHaveBeenCalled();
  });
  it('does not expose the link when the email was sent', async () => {
    const { service, email } = fixture(true);
    const result = await service.create('org', 'owner', 'owner', 'test@example.com', 'staff');
    expect(result.delivery).toBe('email');
    expect(result.invitationUrl).toBeUndefined();
    expect(email.send).toHaveBeenCalledOnce();
  });
  it('reports an existing member without creating an invitation', async () => {
    const { service, prisma } = fixture();
    prisma.user.findUnique.mockResolvedValue({ memberships: [{}] } as never);
    await expect(service.create('org', 'owner', 'owner', 'test@example.com', 'staff')).rejects.toThrow('already_a_member');
    expect(prisma.invitation.create).not.toHaveBeenCalled();
  });
  it('rejects a manager attempting to invite an owner', async () => {
    const { service, prisma } = fixture();
    await expect(service.create('org', 'manager', 'manager', 'test@example.com', 'owner')).rejects.toThrow('cannot_invite_higher_role');
    expect(prisma.invitation.create).not.toHaveBeenCalled();
  });
  it('requires the existing account password before accepting an invitation', async () => {
    const { service, prisma } = fixture();
    prisma.invitation.findUnique.mockResolvedValue({ email: 'test@example.com', expiresAt: new Date(Date.now() + 60000) });
    prisma.user.findUnique.mockResolvedValue({ id: 'existing', passwordHash: 'hash' } as never);
    await expect(service.accept('token', undefined, 'wrong')).rejects.toThrow('existing_user_password_required');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
