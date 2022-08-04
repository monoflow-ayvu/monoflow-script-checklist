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

export class LockEvent extends MonoUtils.wk.event.BaseEvent {
  kind = 'critical-lock' as const;

  constructor(public readonly isLocked: boolean) {
    super();
  }

  getData() {
    return {
      locked: this.isLocked,
      unlocked: !this.isLocked,
      isLocked: this.isLocked,
    };
  }
}

export class HourmeterSetEvent extends MonoUtils.wk.event.BaseEvent {
  kind = 'hourmeter-set' as const;

  constructor(public readonly target: string, public readonly seconds: number) {
    super();
  }

  getData() {
    return {
      target: this.target,
      seconds: this.seconds,
    };
  }
}

export class ChecklistOvertimeEvent extends MonoUtils.wk.event.BaseEvent {
  kind = 'checklist-overtime' as const;

  constructor(public readonly checklistId: string) {
    super();
  }

  getData() {
    return {
      checklistId: this.checklistId,
    };
  }
}
