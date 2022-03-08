import { SessionEvent } from "./events";
import { currentLogin, getFrotaDoc, getString, set } from "./utils";

const LAST_LOGIN_KEY = 'LAST_LOGIN' as const;
const LAST_LOGIN_AT_KEY = 'LAST_LOGIN_AT' as const;

type ReturnConfig = {
  enableReturn: true;
  returnId: string;
  returnHours: number;
} | {
  enableReturn: false;
}

type Config = ReturnConfig & {
  checklistId: string;
  checklistHours: number;
}

function getConfig(): Config {
  const conf = getSettings?.() as Config;
  if (!conf) {
    return {
      enableReturn: false,
      checklistHours: 8,
      checklistId: '',
    }
  }

  return conf;
}

messages.on('onInit', function() {
  platform.log('Checklist plugin initialized');
});

messages.on('onLogin', function(l) {
  platform.log('executing login logic');

  const lastLoginAt = new Date(getString(LAST_LOGIN_AT_KEY) || 0);
  const dateDiffHours = Math.abs((new Date()).getTime() - lastLoginAt.getTime()) / 36e5;
  const lastLogin = getString(LAST_LOGIN_KEY);

  // store new login date
  set(LAST_LOGIN_AT_KEY, (new Date()).toISOString());

  getFrotaDoc()?.set('currentLogin', l);
  env.project?.saveEvent(new SessionEvent('start', l));

  // get settings
  const config = getConfig();

  if (config.enableReturn) {
    // check if user has returned
    if (lastLogin === l && dateDiffHours < config.returnHours) {
      platform.log('user has returned');
      return env.setData('RETURN_VALUE', config.returnId);
    }
  }

  if (lastLogin === l && dateDiffHours < config.checklistHours) {
    platform.log('user has logged in before and is not overdue, skipping checklist');
    return env.setData('RETURN_VALUE', '');
  }

  if (lastLogin !== l && config.checklistId) {
    // we'll continue logic on onSubmit
    return env.setData('RETURN_VALUE', config.checklistId);
  }

  // TODO:
  // const login = env.project?.logins.find((ll) => ll.key === l);
  // if (login && (login.tags || []).includes('mecanico')) {
  //   platform.log('mostrando checklist de mecánico');
  //   return CHECKLIST_MECHANIC_FORM_ID;
  // }

  // TODO:
  // if (login && (login.tags || []).includes('abastecedor')) {
  //   platform.log('omitiendo checklist por abastecedor');
  //   return;
  // }

  return env.setData('RETURN_VALUE', config.checklistId);
});

messages.on('onSubmit', (subm, taskId, formId) => {
  if (formId !== getConfig().checklistId) {
    return;
  }

  set(LAST_LOGIN_KEY, currentLogin());
})

messages.on('onLogout', (l) => {
  env.setData('LOGIN', '');
  getFrotaDoc()?.set('currentLogin', '');
  env.project?.saveEvent(new SessionEvent('end', l));
})