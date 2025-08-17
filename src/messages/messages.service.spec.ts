import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessagesService } from './messages.service';
import { Message } from './messages.model';
import { User } from 'src/user/user.model';
import { CollaborationSession } from 'src/collaboration-session/collaboration-session.model';

const repoFactory = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('MessagesService', () => {
  let service: MessagesService;
  let repo: jest.Mocked<Repository<Message>>;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [MessagesService, { provide: getRepositoryToken(Message), useFactory: repoFactory }],
    }).compile();

    service = mod.get(MessagesService);
    repo = mod.get(getRepositoryToken(Message));
  });

  describe('createMessage', () => {
    const sender: User = { id: 5 } as User;
    const sessionId = 9;
    const text = 'hello';

    it('persists message then returns populated message', async () => {
      repo.create.mockReturnValue({} as any);
      repo.save.mockResolvedValue({ id: 1 } as any);

      const populated = { id: 1, text, sender } as Message;

      jest.spyOn<any, any>(service, 'getMessageWithSender').mockResolvedValue(populated);

      const res = await service.createMessage(sender, sessionId, text);

      expect(repo.create).toHaveBeenCalledWith({
        sender,
        collaborationSession: { id: sessionId },
        text,
      });
      expect(repo.save).toHaveBeenCalled();
      expect(res).toBe(populated);
    });
  });

  describe('getMessagesForSession', () => {
    it('returns messages ordered by createdAt', async () => {
      const session = { id: 7 } as CollaborationSession;
      const msgs = [{ id: 1 }, { id: 2 }] as Message[];

      repo.find.mockResolvedValue(msgs);

      const res = await service.getMessagesForSession(session);

      expect(repo.find).toHaveBeenCalledWith({
        where: { collaborationSession: { id: session.id } },
        order: { createdAt: 'ASC' },
      });
      expect(res).toBe(msgs);
    });
  });
});
