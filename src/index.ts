import * as MonoUtils from "@fermuch/monoutils";
import { SessionEvent } from "./events";
import { conf } from './config';
import { myID } from "@fermuch/monoutils";

let checklistUnlockTimer: NodeJS.Timeout | null = null;
const LAST_LOGIN_KEY = 'LAST_LOGIN' as const;
const LAST_LOGIN_AT_KEY = 'LAST_LOGIN_AT' as const;
const IS_DEVICE_LOCKED_KEY = 'IS_DEVICE_LOCKED' as const;

class LockEvent extends MonoUtils.wk.event.BaseEvent {
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

function isDeviceLocked() {
  return MonoUtils.storage.getBoolean(IS_DEVICE_LOCKED_KEY) === true;
}

function setHourmeter(target: string, value: number) {
  const valueSeconds = value * 3600;
  env.project?.collectionsManager?.ensureExists('hourmeters')?.get(myID()).set(target, valueSeconds);
  MonoUtils.collections.getFrotaDoc()?.set('hourmeter', valueSeconds);
}

messages.on('onInit', function() {
  platform.log('Checklist plugin initialized...' + isDeviceLocked() ? ' Device is locked!' : '');

  if (
    conf.get('enableLock', false)
    && env.data.CURRENT_PAGE === 'Login'
    && env.project?.currentLogin?.maybeCurrent === undefined
  ) {
    platform.log('Checklist plugin: login page detected on script init, locking device...');
    MonoUtils.wk.lock.lock();
  }
});

messages.on('onPeriodic', function() {
  if (
    conf.get('enableUnlockHack', false)
    && conf.get('enableLock', false) === false
  ) {
    MonoUtils.wk.lock.unlock();
    return;
  }

  if (
    conf.get('enableLock', false)
    && env.data.CURRENT_PAGE === 'Login'
    && env.project?.currentLogin?.maybeCurrent === undefined
  ) {
    MonoUtils.wk.lock.lock();
  }
});

messages.on('onLogin', function(l) {
  platform.log('executing login logic');

  const lastLoginAt = new Date(MonoUtils.storage.getString(LAST_LOGIN_AT_KEY) || 0);
  const dateDiffHours = Math.abs((new Date()).getTime() - lastLoginAt.getTime()) / 36e5;
  const lastLogin = MonoUtils.storage.getString(LAST_LOGIN_KEY);
  const userTags = env.project?.logins?.find((login) => login.key === l)?.tags || [];
  const deviceTags = env.project?.usersManager?.users?.find?.((u) => u.$modelId === myID())?.tags || [];
  const specialTags = conf.get('specialTags', []);
  const supervisorTags = specialTags.filter((tag) => tag.action === 'supervisor');
  // deviceTags are not added to isLoginSupervisor since a device cannot be a supervisor
  const isLoginSupervisor = userTags.some((tag) => supervisorTags.some((supervisorTag) => supervisorTag.tag === tag));
  const isLocked = isDeviceLocked();

  env.setData('IS_DEVICE_LOCKED', isLocked);

  if (isLocked && !isLoginSupervisor) {
    platform.log('Device is locked, but user is not a supervisor');
    return env.setData('RETURN_VALUE', {error: 'Supervisor requerido.'});
  }

  // update metadata
  MonoUtils.collections.getFrotaDoc()?.set('currentLogin', l);
  env.project?.saveEvent(new SessionEvent('start', l));

  if (isLocked && isLoginSupervisor) {
    platform.log('Device is locked, but user is a supervisor. Unlocking device...');
    MonoUtils.storage.set(IS_DEVICE_LOCKED_KEY, false);
    MonoUtils.storage.set(LAST_LOGIN_AT_KEY, (new Date()).toISOString());
    env.project.saveEvent(new LockEvent(false));
    return env.setData('RETURN_VALUE', '');
  }

  const login = env.project?.logins.find((ll) => ll.key === l);
  if (login && conf.get('enableSpecialTags', false)) {
    for (const tag of conf.get('specialTags', [])) {
      if (login.tags.includes(tag.tag) || deviceTags.includes(tag.tag)) {
        if (tag.action === 'customChecklist') {
          MonoUtils.wk.lock.unlock();
          return env.setData('RETURN_VALUE', tag.customChecklistId);
        } else if (tag.action === 'omitChecklist') {
          MonoUtils.wk.lock.unlock();
          MonoUtils.storage.set(LAST_LOGIN_AT_KEY, (new Date()).toISOString());
          return env.setData('RETURN_VALUE', '');
        }
      }
    }
  }

  if (conf.get('enableReturn', false)) {
    // check if user has returned
    if (lastLogin === l && dateDiffHours <= conf.get('returnHours', 0)) {
      platform.log('user has returned');
      MonoUtils.wk.lock.unlock();
      if (!conf.get('returnId', '')) {
        MonoUtils.storage.set(LAST_LOGIN_AT_KEY, (new Date()).toISOString());
      }
      return env.setData('RETURN_VALUE', conf.get('returnId', ''));
    }
  }

  if (lastLogin === l && dateDiffHours < conf.get('checklistHours', 0)) {
    platform.log('user has logged in before and is not overdue, skipping checklist');
    MonoUtils.wk.lock.unlock();
    return env.setData('RETURN_VALUE', '');
  }

  // we'll continue logic for locks on onSubmit
  platform.log("normal login, continuing logic post-checklist");
  MonoUtils.wk.lock.unlock();
  if (!conf.get('checklistId')) {
    MonoUtils.storage.set(LAST_LOGIN_AT_KEY, (new Date()).toISOString());
  }
  return env.setData('RETURN_VALUE', conf.get('checklistId', ''));
});

messages.on('onShowSubmit', (taskId, formId) => {
  if (
    formId !== conf.get('checklistId', '')
    && formId !== conf.get('returnId', '')
  ) {
    return;
  }

  if (checklistUnlockTimer) {
    clearTimeout(checklistUnlockTimer);
    checklistUnlockTimer = null;
  }

  if (conf.get('enableLock', false)) {
    checklistUnlockTimer = setTimeout(() => {
      platform.log('form not completed on time, locking checklist');
      MonoUtils.wk.lock.lock();
    }, conf.get('lockChecklistTime', 0) * 60 * 1000);
  }
})

messages.on('onSubmit', (subm, taskId, formId) => {
  if (
    formId === conf.get('returnId', '')
    || formId === conf.get('checklistId', '')
  ) {
    MonoUtils.storage.set(LAST_LOGIN_AT_KEY, (new Date()).toISOString());
  }

  if (
    formId !== conf.get('checklistId', '')
    && formId !== conf.get('returnId', '')
  ) {
    return;
  }

  if (checklistUnlockTimer) {
    clearTimeout(checklistUnlockTimer);
    checklistUnlockTimer = null;
  }

  // process checklist questions actions
  let keepLocked = false;
  if (conf.get('checklistQuestionsEnabled', false)) {
    platform.log('checking checklist questions');
    for (const question of conf.get('checklistQuestions', [])) {
      if (
            subm.data[question.question] === question.answer
        ||  question.action === 'hourmeter' && subm.data[question.question]
      ) {
        switch(question.action) {
          case 'keepLocked':
            keepLocked = true;
            break;
          case 'critical':
            platform.log('critical checklist question answered, locking device!!!');
            MonoUtils.storage.set(IS_DEVICE_LOCKED_KEY, true);
            env.project.saveEvent(new LockEvent(true));
            MonoUtils.wk.lock.lock();
            env.project.logout();
            return;
          case 'hourmeter': {
            const hourmeter = Number(String(subm.data[question.question] || '').replace(/,/, '.'))
            if (hourmeter > 0) {
              setHourmeter(question.checklistTarget || 'hourmeter', hourmeter);
            }
          }
          break;
        }
      }
    }
  }

  if (keepLocked) {
    platform.log('an action was triggered to keep locked after checklist');
    MonoUtils.wk.lock.lock();
  } else {
    platform.log('unlocking after checklist completed correctly');
    MonoUtils.wk.lock.unlock();
  }
  MonoUtils.storage.set(LAST_LOGIN_KEY, MonoUtils.currentLogin());
})

messages.on('onLogout', (l) => {
  MonoUtils.wk.lock.lock();
  env.setData('LOGIN', '');
  MonoUtils.collections.getFrotaDoc()?.set('currentLogin', '');
  env.project?.saveEvent(new SessionEvent('end', l));
})

messages.on('onEnd', () => {
  if (checklistUnlockTimer) {
    clearTimeout(checklistUnlockTimer);
    checklistUnlockTimer = null;
  }
})