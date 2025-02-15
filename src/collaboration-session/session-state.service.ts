import { Injectable } from '@nestjs/common';

@Injectable()
export class SessionStateService {
  onlineUsers: Map<
    number,
    {
      sessionId: number;
      startTime: number;
      socketIds: Set<string>;
    }
  > = new Map();

  socketSessionMap: Map<string, number> = new Map();
}
