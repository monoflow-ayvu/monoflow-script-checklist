import * as MonoUtils from "@fermuch/monoutils";
import { myID } from "@fermuch/monoutils";

export class SessionEvent extends MonoUtils.wk.event.BaseEvent {
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