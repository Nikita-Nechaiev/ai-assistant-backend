import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateInvitationDto } from './create-invitation.dto';
import { Permission, InvitationStatus, NotificationStatus } from 'src/common/enums/enums';

const validUser = () => ({ id: 1, email: 'receiver@mail.com' });
const validSession = () => ({ id: 10 });

function validateDto(partial: Partial<CreateInvitationDto>) {
  const dto = plainToInstance(CreateInvitationDto, {
    role: Permission.READ,
    session: validSession(),
    receiver: validUser(),
    ...partial,
  });

  return validate(dto);
}

describe('CreateInvitationDto validation', () => {
  it('passes with minimal valid payload', async () => {
    const errors = await validateDto({});

    expect(errors).toHaveLength(0);
  });

  it('fails when role is missing', async () => {
    const errors = await validateDto({ role: undefined as any });

    expect(errors[0].property).toBe('role');
  });

  it('fails for invalid role value', async () => {
    const errors = await validateDto({ role: 'ADMIN' as any });

    expect(errors[0].property).toBe('role');
  });

  it('accepts optional enums when provided correctly', async () => {
    const errors = await validateDto({
      invitationStatus: InvitationStatus.PENDING,
      notificationStatus: NotificationStatus.READ,
    });

    expect(errors).toHaveLength(0);
  });

  it('fails for wrong invitationStatus value', async () => {
    const errors = await validateDto({ invitationStatus: 'WRONG' as any });

    expect(errors[0].property).toBe('invitationStatus');
  });

  it('fails when expiresAt is not a Date', async () => {
    const errors = await validateDto({ expiresAt: '2030-01-01' as any });

    expect(errors[0].property).toBe('expiresAt');
  });

  it('fails for bad inviterEmail format', async () => {
    const errors = await validateDto({ inviterEmail: 'not-email' });

    expect(errors[0].property).toBe('inviterEmail');
  });

  it('fails when receiver is null', async () => {
    const errors = await validateDto({ receiver: null as any });

    expect(errors[0].property).toBe('receiver');
  });

  it('fails when session is null', async () => {
    const errors = await validateDto({ session: null as any });

    expect(errors[0].property).toBe('session');
  });
});
