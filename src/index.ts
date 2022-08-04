import * as MonoUtils from "@fermuch/monoutils";
import { ChecklistOvertimeEvent, HourmeterSetEvent, LockEvent, SessionEvent } from "./events";
import { conf } from './config';
import { currentLogin, myID } from "@fermuch/monoutils";
import { setUrgentNotification } from "./utils";

let checklistUnlockTimer: NodeJS.Timeout | null = null;
const LAST_LOGIN_KEY = 'LAST_LOGIN' as const;
const LAST_LOGIN_AT_KEY = 'LAST_LOGIN_AT' as const;
const IS_DEVICE_LOCKED_KEY = 'IS_DEVICE_LOCKED' as const;
const ACTION_OK_TIMELIMIT = 'checklist:expired-ok' as const;

function isDeviceLocked() {
  return MonoUtils.storage.getBoolean(IS_DEVICE_LOCKED_KEY) === true;
}

function setHourmeter(target: string, value: number) {
  const valueSeconds = value * 3600;
  env.project?.collectionsManager?.ensureExists('hourmeters')?.get(myID()).set(target, valueSeconds);
  env.project?.collectionsManager?.ensureExists('hourmeters')?.get(myID()).set(`${target}_time`, Number(new Date()));
  MonoUtils.collections.getFrotaDoc()?.set('hourmeter', valueSeconds);

  env.project.saveEvent(new HourmeterSetEvent(target, valueSeconds))
}

function getChecklistId(login: string) {
  const default_ = conf.get('checklistId', '');

  const userTags = env.project?.logins?.find((l) => l.key === login || l.$modelId === login)?.tags || [];
  const deviceTags = env.project?.usersManager?.users?.find?.((u) => u.$modelId === myID())?.tags || [];

  if (conf.get('enableSpecialTags', false) === false) {
    return default_;
  }

  for (const tag of conf.get('specialTags', [])) {
    if (tag.action === 'customChecklist') {
      if (userTags.includes(tag.tag) || deviceTags.includes(tag.tag)) {
        return tag.customChecklistId;
      }
    }
  }

  return default_;
}

function getReturnId(login: string): string {
  if (!conf.get('enableReturn', false)) {
    return '';
  }

  const default_ = conf.get('returnId', '');
  if (conf.get('enableSpecialTags', false) === false) {
    return default_;
  }

  const userTags = env.project?.logins?.find((l) => l.key === login || l.$modelId === login)?.tags || [];
  const deviceTags = env.project?.usersManager?.users?.find?.((u) => u.$modelId === myID())?.tags || [];

  for (const tag of conf.get('specialTags', [])) {
    if (tag.action === 'customReturn') {
      if (userTags.includes(tag.tag) || deviceTags.includes(tag.tag)) {
        return tag.customReturnId;
      }
    }
  }

  return default_;
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

  if (isLoginSupervisor) {
    MonoUtils.storage.del(LAST_LOGIN_KEY);
    MonoUtils.storage.del(LAST_LOGIN_AT_KEY);
  }

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

  // return needs to be checked before special tags
  // to avoid returning a custom checklist when the user
  // is returning
  if (conf.get('enableReturn', false)) {
    // check if user has returned
    if (lastLogin === l && dateDiffHours <= conf.get('returnHours', 0)) {
      platform.log('user has returned');
      MonoUtils.wk.lock.unlock();
      if (!getReturnId(l)) {
        MonoUtils.storage.set(LAST_LOGIN_AT_KEY, (new Date()).toISOString());
      }
      return env.setData('RETURN_VALUE', getReturnId(l));
    }
  }

  // now we can verify special tags
  const login = env.project?.logins.find((ll) => ll.key === l);
  if (conf.get('enableSpecialTags', false)) {
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
  platform.log('onShowSubmit my checklist id:', getChecklistId(currentLogin()), 'formId: ', formId);
  if (
    formId !== getChecklistId(currentLogin())
    && formId !== getReturnId(currentLogin())
  ) {
    platform.log('skipping timer')
    return;
  }

  // clear last unlock timer, so we can safely start a new one
  if (checklistUnlockTimer) {
    clearTimeout(checklistUnlockTimer);
    checklistUnlockTimer = null;
  }

  if (conf.get('enableLock', false)) {
    checklistUnlockTimer = setTimeout(() => {
      platform.log('form not completed on time, locking checklist');
      MonoUtils.wk.lock.lock();
      env.project?.saveEvent(new ChecklistOvertimeEvent(formId || ''));
      if (conf.get('showTimeAlert', false)) {
        setUrgentNotification({
          title: 'Tempo para preencher checklist expirado',
          message: 'O tempo límite para preencher o checklist foi superado.',
          urgent: true,
          actions: [{
            action: ACTION_OK_TIMELIMIT,
            name: 'OK',
            payload: null,
          }]
        })
      }
    }, conf.get('lockChecklistTime', 0) * 60 * 1000);
  }
})

messages.on('onSubmit', (subm, taskId, formId) => {
  if (
    formId === getChecklistId(currentLogin())
    || formId === getReturnId(currentLogin())
  ) {
    MonoUtils.storage.set(LAST_LOGIN_AT_KEY, (new Date()).toISOString());
  }

  if (
    formId !== getChecklistId(currentLogin())
    && formId !== getReturnId(currentLogin())
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

messages.on('onCall', (actId, payload) => {
  if (actId !== ACTION_OK_TIMELIMIT) {
    return;
  }

  setUrgentNotification(null);
})