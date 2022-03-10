import { SessionEvent } from "./events";
// import { currentLogin, getFrotaDoc, getString, set } from "./utils";
import MonoUtils from "@fermuch/monoutils";

let checklistUnlockTimer: NodeJS.Timeout | null = null;
const LAST_LOGIN_KEY = 'LAST_LOGIN' as const;
const LAST_LOGIN_AT_KEY = 'LAST_LOGIN_AT' as const;

type ReturnConfig = {
  enableReturn: true;
  returnId: string;
  returnHours: number;
} | {
  enableReturn: false;
}

type LockConfig = {
  enableLock: true;
  lockOutput: 'MONOFLOW_RELAY_1' | 'MONOFLOW_RELAY_2' | 'MONOFLOW_BUZ_1';
  lockChecklistTime: number;
} | {
  enableLock: false;
}

type SpecialTag = {
  tag: string;
  action: "customChecklist";
  customChecklistId: string;
} | {
  tag: string;
  action: "omitChecklist";
}

type SpecialTagsConfig = {
  enableSpecialTags: true;
  specialTags: SpecialTag[];
} | {
  enableSpecialTags: false;
}

type Config = ReturnConfig & LockConfig & SpecialTagsConfig & {
  checklistId: string;
  checklistHours: number;
}

function lock(doLock = true) {
  const conf = MonoUtils.config.getConfig<Config>();
  if (!conf.enableLock) {
    return;
  }

  env.setData(conf.lockOutput, doLock);
}

messages.on('onInit', function() {
  platform.log('Checklist plugin initialized');
});

messages.on('onLogin', function(l) {
  platform.log('executing login logic');

  const lastLoginAt = new Date(MonoUtils.storage.getString(LAST_LOGIN_AT_KEY) || 0);
  const dateDiffHours = Math.abs((new Date()).getTime() - lastLoginAt.getTime()) / 36e5;
  const lastLogin = MonoUtils.storage.getString(LAST_LOGIN_KEY);

  // store new login date
  MonoUtils.storage.set(LAST_LOGIN_AT_KEY, (new Date()).toISOString());

  MonoUtils.collections.getFrotaDoc()?.set('currentLogin', l);
  env.project?.saveEvent(new SessionEvent('start', l));

  // get settings
  const config = MonoUtils.config.getConfig<Config>();

  const login = env.project?.logins.find((ll) => ll.key === l);
  if (login && config.enableSpecialTags) {
    for (const tag of config.specialTags) {
      if (login.tags.includes(tag.tag)) {
        if (tag.action === 'customChecklist') {
          lock(false);
          return env.setData('RETURN_VALUE', tag.customChecklistId);
        } else if (tag.action === 'omitChecklist') {
          lock(false);
          return env.setData('RETURN_VALUE', '');
        }
      }
    }
  }

  if (config.enableReturn) {
    // check if user has returned
    if (lastLogin === l && dateDiffHours < config.returnHours) {
      platform.log('user has returned');
      lock(false);
      return env.setData('RETURN_VALUE', config.returnId);
    }
  }

  if (lastLogin === l && dateDiffHours < config.checklistHours) {
    platform.log('user has logged in before and is not overdue, skipping checklist');
    lock(false);
    return env.setData('RETURN_VALUE', '');
  }

  // we'll continue logic for locks on onSubmit
  lock(false);
  return env.setData('RETURN_VALUE', config.checklistId);
});

messages.on('onShowSubmit', (taskId, formId) => {
  if (checklistUnlockTimer) {
    clearTimeout(checklistUnlockTimer);
    checklistUnlockTimer = null;
  }

  const conf = MonoUtils.config.getConfig<Config>();
  if (conf.enableLock) {
    checklistUnlockTimer = setTimeout(() => {
      platform.log('form not completed on time, locking checklist');
      lock(true);
    }, conf.lockChecklistTime * 60 * 1000);
  }
})

messages.on('onSubmit', (subm, taskId, formId) => {
  if (formId !== MonoUtils.config.get<Config, 'checklistId'>('checklistId', '')) {
    return;
  }

  if (checklistUnlockTimer) {
    clearTimeout(checklistUnlockTimer);
    checklistUnlockTimer = null;
  }
  lock(false);
  MonoUtils.storage.set(LAST_LOGIN_KEY, MonoUtils.currentLogin());
})

messages.on('onLogout', (l) => {
  lock(true);
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