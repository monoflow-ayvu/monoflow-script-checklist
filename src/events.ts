import { myID } from "@fermuch/monoutils";
import { BaseEvent } from "@fermuch/telematree/src/events";

export class SessionEvent extends BaseEvent {
  kind = 'session';
  type: 'start' | 'end';
  userId: string;

  constructor(type: 'start' | 'end', userId: string) {
    super();

    this.type = type;
    this.userId = userId;
  }

  getData() {
    return {
      deviceId: myID(),
      type: this.type,
      userId: this.userId,
    }
  }
}