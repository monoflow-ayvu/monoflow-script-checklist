import * as MonoUtils from '@fermuch/monoutils';
const read = require('fs').readFileSync;
const join = require('path').join;

function loadScript() {
  // import global script
  const script = read(join(__dirname, '..', 'dist', 'bundle.js')).toString('utf-8');
  eval(script);
}

describe("onInit", () => {
  // clean listeners
  afterEach(() => {
    messages.removeAllListeners();
    MonoUtils.storage.set('IS_DEVICE_LOCKED', false);
    MonoUtils.storage.set('LAST_LOGIN_AT', undefined);
    MonoUtils.storage.set('LAST_LOGIN', undefined);
  });

  it('runs without errors', () => {
    loadScript();
    messages.emit('onInit');
  });

  it('unlocks if enableUnlockHack is true and enableLock is false', () => {
    getSettings = () => ({
      enableLock: false,
      enableUnlockHack: true,
    })

    loadScript();
    messages.emit('onInit');
    expect(MonoUtils.wk.lock.getLockState()).toBe(false);
  })

  it('locks if page is Login, no user is logged in and lock is enabled', () => {
    getSettings = () => ({
      enableLock: true,
    });

    loadScript();
    expect(MonoUtils.wk.lock.getLockState()).toBe(false);
    messages.emit('onInit');
    expect(MonoUtils.wk.lock.getLockState()).toBe(false);

    MonoUtils.wk.lock.unlock(); // reset
    env.setData('CURRENT_PAGE', 'Login');
    messages.emit('onInit');
    expect(MonoUtils.wk.lock.getLockState()).toBe(true);

    MonoUtils.wk.lock.unlock(); // reset
    env.setData('CURRENT_PAGE', 'Foobar');
    messages.emit('onInit');
    expect(MonoUtils.wk.lock.getLockState()).toBe(false);

    MonoUtils.wk.lock.unlock(); // reset
    env.setData('CURRENT_PAGE', 'Submit');
    messages.emit('onInit');
    expect(MonoUtils.wk.lock.getLockState()).toBe(false);
  });
});

describe('onPeriodic', () => {
  it('locks if page is Login, no user is logged in and lock is enabled', () => {
    getSettings = () => ({
      enableLock: true,
    });
    loadScript();
    MonoUtils.wk.lock.unlock(); // reset

    expect(MonoUtils.wk.lock.getLockState()).toBe(false);
    messages.emit('onPeriodic');
    expect(MonoUtils.wk.lock.getLockState()).toBe(false);

    MonoUtils.wk.lock.unlock(); // reset
    env.setData('CURRENT_PAGE', 'Login');
    messages.emit('onPeriodic');
    expect(MonoUtils.wk.lock.getLockState()).toBe(true);

    MonoUtils.wk.lock.unlock(); // reset
    env.setData('CURRENT_PAGE', 'Foobar');
    messages.emit('onPeriodic');
    expect(MonoUtils.wk.lock.getLockState()).toBe(false);

    MonoUtils.wk.lock.unlock(); // reset
    env.setData('CURRENT_PAGE', 'Submit');
    messages.emit('onPeriodic');
    expect(MonoUtils.wk.lock.getLockState()).toBe(false);
  });
})

describe('onLogin', () => {
  // clean listeners
  afterEach(() => {
    messages.removeAllListeners();
    MonoUtils.storage.set('IS_DEVICE_LOCKED', false);
    MonoUtils.storage.set('LAST_LOGIN_AT', undefined);
    MonoUtils.storage.set('LAST_LOGIN', undefined);
  });

  it('onLogin sets IS_DEVICE_LOCKED', () => {
    loadScript();
    messages.emit('onInit');
    messages.emit('onLogin', '123', '');
    expect(env.data.IS_DEVICE_LOCKED).toBe(false);
    expect(MonoUtils.storage.getString('LAST_LOGIN_AT')).toBeTruthy();
  });

  it('onLogin does not go through if device is locked', () => {
    loadScript();
    messages.emit('onInit');
    MonoUtils.storage.set('IS_DEVICE_LOCKED', true);
    messages.emit('onLogin', '123', '');
    expect(env.data.RETURN_VALUE).toStrictEqual({ error: 'Supervisor requerido.' });
    expect(MonoUtils.storage.getString('LAST_LOGIN_AT')).toBeTruthy();
  });

  it('onLogin sets currentLogin on frota doc', () => {
    const colStore = {} as Record<any, any>;
    const mockCol = {
      get() {
        return {
          data: colStore,
          get: (k: string) => colStore[k],
          set: (k: string, v: any) => (colStore[k] = v),
        }
      }
    };
    (env.project as any) = {
      collectionsManager: {
        ensureExists: () => mockCol,
      },
      saveEvent: jest.fn(),
      logins: [],
    };
    loadScript();
    messages.emit('onInit');
    messages.emit('onLogin', '123', '');

    expect(colStore.currentLogin).toBe('123');
    expect(MonoUtils.storage.getString('LAST_LOGIN_AT')).toBeTruthy();
  });

  it('onLogin saves a login event', () => {
    const colStore = {} as Record<any, any>;
    const mockCol = {
      get() {
        return {
          data: colStore,
          get: (k: string) => colStore[k],
          set: (k: string, v: any) => (colStore[k] = v),
        }
      }
    };
    (env.project as any) = {
      collectionsManager: {
        ensureExists: () => mockCol,
      },
      saveEvent: jest.fn(),
      logins: [],
    };
    loadScript();
    messages.emit('onInit');
    messages.emit('onLogin', '123', '');

    expect(env.project.saveEvent).toHaveBeenCalledTimes(1);
    expect(MonoUtils.storage.getString('LAST_LOGIN_AT')).toBeTruthy();
  });

  it('unlocks device so the checklist decides if we need to block or not', () => {
    loadScript();
    messages.emit('onInit');
    messages.emit('onLogin', '123', '');
    expect(env.data.IS_DEVICE_LOCKED).toBe(false);
    expect(MonoUtils.storage.getString('LAST_LOGIN_AT')).toBeTruthy();
  });

  describe('onLogin is a supervisor', () => {
    it('onLogin only lets a supervisor pass if device is locked', () => {
      const colStore = {} as Record<any, any>;
      const mockCol = {
        get() {
          return {
            data: colStore,
            get: (k: string) => colStore[k],
            set: (k: string, v: any) => (colStore[k] = v),
          }
        }
      };
      (env.project as any) = {
        collectionsManager: {
          ensureExists: () => mockCol,
        },
        saveEvent: jest.fn(),
        logins: [{ key: '123', tags: ['supervisor'] }],
      };
      getSettings = () => ({
        enableSpecialTags: true,
        specialTags: [{ tag: 'supervisor', action: 'supervisor' }],
      });

      loadScript();
      messages.emit('onInit');
      MonoUtils.storage.set('IS_DEVICE_LOCKED', true);
      messages.emit('onLogin', '123', '');
      expect(MonoUtils.storage.getBoolean('IS_DEVICE_LOCKED')).toBe(false);
      expect(env.data.RETURN_VALUE).toBe('');
      expect(MonoUtils.storage.getString('LAST_LOGIN_AT')).toBeTruthy();
      const eventCall = (env.project.saveEvent as jest.Mock).mock.calls.find((e) => e[0].kind === 'critical-lock')[0];
      expect(eventCall.kind).toBe('critical-lock');
      expect(eventCall.getData().locked).toBe(false);
      expect(eventCall.getData().unlocked).toBe(true);
    });

    it('onLogin passes without checklist if device is unlocked by supervisor', () => {
      const colStore = {} as Record<any, any>;
      const mockCol = {
        get() {
          return {
            data: colStore,
            get: (k: string) => colStore[k],
            set: (k: string, v: any) => (colStore[k] = v),
          }
        }
      };
      (env.project as any) = {
        collectionsManager: {
          ensureExists: () => mockCol,
        },
        saveEvent: jest.fn(),
        logins: [{ key: '123', tags: ['supervisor'] }],
      };
      getSettings = () => ({
        enableSpecialTags: true,
        specialTags: [{ tag: 'supervisor', action: 'supervisor' }],
      });

      loadScript();
      messages.emit('onInit');
      MonoUtils.storage.set('IS_DEVICE_LOCKED', true);
      messages.emit('onLogin', '123', '');
      expect(MonoUtils.storage.getBoolean('IS_DEVICE_LOCKED')).toBe(false);
      expect(env.data.RETURN_VALUE).toBe('');
      expect(MonoUtils.storage.getString('LAST_LOGIN_AT')).toBeTruthy();

      expect(env.data.RETURN_VALUE).toBe('');
    });
  });

  describe('special tags', () => {
    it('shows custom checklist for customChecklist tag', () => {
      const colStore = {} as Record<any, any>;
      const mockCol = {
        get() {
          return {
            data: colStore,
            get: (k: string) => colStore[k],
            set: (k: string, v: any) => (colStore[k] = v),
          }
        }
      };
      (env.project as any) = {
        collectionsManager: {
          ensureExists: () => mockCol,
        },
        saveEvent: jest.fn(),
        logins: [{ key: '123', tags: ['customChecklist'] }],
      };
      getSettings = () => ({
        enableSpecialTags: true,
        specialTags: [{ tag: 'customChecklist', action: 'customChecklist', customChecklistId: 'abc123' }],
      })
      loadScript();
      messages.emit('onInit');
      messages.emit('onLogin', '123', '');

      expect(colStore.currentLogin).toBe('123');
      expect(env.data.RETURN_VALUE).toBe('abc123');
      expect(MonoUtils.storage.getString('LAST_LOGIN_AT')).toBeTruthy();
    });

    it('shows custom checklist for customChecklist tag, with device tag (instead of login tag)', () => {
      const colStore = {} as Record<any, any>;
      const mockCol = {
        get() {
          return {
            data: colStore,
            get: (k: string) => colStore[k],
            set: (k: string, v: any) => (colStore[k] = v),
          }
        }
      };
      (env.project as any) = {
        collectionsManager: {
          ensureExists: () => mockCol,
        },
        saveEvent: jest.fn(),
        logins: [{ key: '123', tags: [] }],
        usersManager: {
          users: [
            {
              $modelId: 'TEST',
              tags: ['customChecklist'],
            }
          ]
        }
      };
      getSettings = () => ({
        enableSpecialTags: true,
        specialTags: [{ tag: 'customChecklist', action: 'customChecklist', customChecklistId: 'abc123' }],
      })
      loadScript();
      messages.emit('onInit');
      messages.emit('onLogin', '123', '');

      expect(colStore.currentLogin).toBe('123');
      expect(env.data.RETURN_VALUE).toBe('abc123');
      expect(MonoUtils.storage.getString('LAST_LOGIN_AT')).toBeTruthy();
    });

    it('when using customChecklist, it is handled the same as checklist or return when onShowSubmit/onSubmit', () => {
      const colStore = {} as Record<any, any>;
      const mockCol = {
        get() {
          return {
            data: colStore,
            get: (k: string) => colStore[k],
            set: (k: string, v: any) => (colStore[k] = v),
          }
        }
      };
      (env.project as any) = {
        collectionsManager: {
          ensureExists: () => mockCol,
        },
        saveEvent: jest.fn(),
        logins: [{ key: '123', tags: [] }],
        usersManager: {
          users: [
            {
              $modelId: 'TEST',
              tags: ['customChecklist'],
            }
          ]
        }
      };
      getSettings = () => ({
        // lock
        enableLock: true,
        lockChecklistTime: 10,
        checklistId: 'asdf', // this should NOT be the checklist id returned!
        // special tags
        enableSpecialTags: true,
        specialTags: [{ tag: 'customChecklist', action: 'customChecklist', customChecklistId: 'abc123' }],
      })
      loadScript();
      messages.emit('onInit');
      messages.emit('onLogin', '123', '');

      expect(colStore.currentLogin).toBe('123');
      expect(env.data.RETURN_VALUE).toBe('abc123');
      expect(MonoUtils.storage.getString('LAST_LOGIN_AT')).toBeTruthy();

      // custom test for condition of onShowSubmit now:
      messages.emit('onShowSubmit', undefined, 'abc123');

      expect(MonoUtils.wk.lock.getLockState()).toBe(false);
      jest.advanceTimersByTime(3 * 60 * 1000);
      expect(MonoUtils.wk.lock.getLockState()).toBe(false);
      jest.advanceTimersByTime(100 * 60 * 1000);
      expect(MonoUtils.wk.lock.getLockState()).toBe(true);

      // should NOT set if it is the default checklist id
      messages.emit('onLogout', '123');
      messages.emit('onLogin', '123', '');
      messages.emit('onShowSubmit', undefined, 'asdf');

      expect(MonoUtils.wk.lock.getLockState()).toBe(false);
      jest.advanceTimersByTime(3 * 60 * 1000);
      expect(MonoUtils.wk.lock.getLockState()).toBe(false);
      jest.advanceTimersByTime(100 * 60 * 1000);
      expect(MonoUtils.wk.lock.getLockState()).toBe(false);

      // custom test for condition of onSubmit now:
      messages.emit('onLogout', '123');
      messages.emit('onLogin', '123', '');
      messages.emit('onShowSubmit', undefined, 'abc123');
      messages.emit('onSubmit', undefined, undefined, 'abc123');
      expect(MonoUtils.wk.lock.getLockState()).toBe(false);
      jest.advanceTimersByTime(3 * 60 * 1000);
      expect(MonoUtils.wk.lock.getLockState()).toBe(false);
      jest.advanceTimersByTime(100 * 60 * 1000);
      expect(MonoUtils.wk.lock.getLockState()).toBe(false);
    });

    it('omitChecklist tag skips checklist', () => {
      const colStore = {} as Record<any, any>;
      const mockCol = {
        get() {
          return {
            data: colStore,
            get: (k: string) => colStore[k],
            set: (k: string, v: any) => (colStore[k] = v),
          }
        }
      };
      (env.project as any) = {
        collectionsManager: {
          ensureExists: () => mockCol,
        },
        saveEvent: jest.fn(),
        logins: [{ key: '123', tags: ['omitChecklist'] }],
      };
      getSettings = () => ({
        checklistId: 'asdf',
        enableSpecialTags: true,
        specialTags: [{ tag: 'omitChecklist', action: 'omitChecklist', customChecklistId: '' }],
      })
      loadScript();
      messages.emit('onInit');
      messages.emit('onLogin', '123', '');

      expect(colStore.currentLogin).toBe('123');
      expect(env.data.RETURN_VALUE).toBe('');
      expect(MonoUtils.storage.getString('LAST_LOGIN_AT')).toBeTruthy();
    });
  });

  describe('enableReturn', () => {
    it('if same user returns before time limit, passes without checklist', () => {
      const colStore = {} as Record<any, any>;
      const mockCol = {
        get() {
          return {
            data: colStore,
            get: (k: string) => colStore[k],
            set: (k: string, v: any) => (colStore[k] = v),
          }
        }
      };
      (env.project as any) = {
        collectionsManager: {
          ensureExists: () => mockCol,
        },
        saveEvent: jest.fn(),
        logins: [],
      };
      getSettings = () => ({
        enableReturn: true,
        returnHours: 10,
        returnId: 'foobar123',
        checklistId: 'asdf',
      });

      loadScript();
      messages.emit('onInit');

      MonoUtils.storage.set('LAST_LOGIN', '123');
      MonoUtils.storage.set('LAST_LOGIN_AT', (new Date()).toISOString());
      messages.emit('onLogin', '123', '');

      expect(colStore.currentLogin).toBe('123');
      expect(MonoUtils.storage.getString('LAST_LOGIN_AT')).toBeTruthy();
      expect(env.data.RETURN_VALUE).toBe('foobar123');
    });

    it('shows return even if user has custom checklist', () => {
      const colStore = {} as Record<any, any>;
      const mockCol = {
        get() {
          return {
            data: colStore,
            get: (k: string) => colStore[k],
            set: (k: string, v: any) => (colStore[k] = v),
          }
        }
      };
      (env.project as any) = {
        collectionsManager: {
          ensureExists: () => mockCol,
        },
        saveEvent: jest.fn(),
        logins: [{ key: '123', tags: ['customChecklist'] }],
      };
      getSettings = () => ({
        enableReturn: true,
        returnHours: 10,
        returnId: 'foobar123',
        checklistId: 'asdf',
        enableSpecialTags: true,
        specialTags: [{ tag: 'customChecklist', action: 'customChecklist', customChecklistId: 'dsa123' }],
      });

      loadScript();
      messages.emit('onInit');

      MonoUtils.storage.set('LAST_LOGIN', '123');
      MonoUtils.storage.set('LAST_LOGIN_AT', (new Date()).toISOString());
      messages.emit('onLogin', '123', '');

      expect(colStore.currentLogin).toBe('123');
      expect(MonoUtils.storage.getString('LAST_LOGIN_AT')).toBeTruthy();
      expect(env.data.RETURN_VALUE).toBe('foobar123');
    })
  });
});

describe('onShowSubmit', () => {
  // clean listeners
  afterEach(() => {
    messages.removeAllListeners();
    MonoUtils.storage.set('IS_DEVICE_LOCKED', false);
    MonoUtils.storage.set('LAST_LOGIN_AT', undefined);
    MonoUtils.storage.set('LAST_LOGIN', undefined);
  });

  it('locks if more time than lockChecklistTime passes and enableLock is enabled', () => {
    getSettings = () => ({
      enableLock: true,
      lockChecklistTime: 10,
      checklistId: 'asdf',
    });
    loadScript();
    messages.emit('onInit');
    messages.emit('onShowSubmit', undefined, 'asdf');

    expect(MonoUtils.wk.lock.getLockState()).toBe(false);
    jest.advanceTimersByTime(3 * 60 * 1000);
    expect(MonoUtils.wk.lock.getLockState()).toBe(false);
    jest.advanceTimersByTime(100 * 60 * 1000);
    expect(MonoUtils.wk.lock.getLockState()).toBe(true);
  });
});

describe('onSubmit', () => {
  // clean listeners
  afterEach(() => {
    messages.removeAllListeners();
    MonoUtils.storage.set('IS_DEVICE_LOCKED', false);
    MonoUtils.storage.set('LAST_LOGIN_AT', undefined);
    MonoUtils.storage.set('LAST_LOGIN', undefined);
  });

  it('sets LAST_LOGIN_AT if formId is returnId or checklistId', () => {
    const colStore = {} as Record<any, any>;
    const mockCol = {
      get() {
        return {
          data: colStore,
          get: (k: string) => colStore[k],
          set: (k: string, v: any) => (colStore[k] = v),
        }
      }
    };
    (env.project as any) = {
      collectionsManager: {
        ensureExists: () => mockCol,
      },
      saveEvent: jest.fn(),
      logins: [],
    };
    getSettings = () => ({
      enableReturn: true,
      returnHours: 10,
      returnId: 'foobar123',
      checklistId: 'asdf',
    });

    loadScript();
    messages.emit('onInit');

    MonoUtils.storage.set('LAST_LOGIN_AT', '');

    expect(MonoUtils.storage.getString('LAST_LOGIN_AT')).toBe('');
    messages.emit('onSubmit', {} as never, undefined, 'foobar123');
    expect(MonoUtils.storage.getString('LAST_LOGIN_AT')).toBeTruthy();

    MonoUtils.storage.set('LAST_LOGIN_AT', '');

    expect(MonoUtils.storage.getString('LAST_LOGIN_AT')).toBe('');
    messages.emit('onSubmit', {} as never, undefined, 'asdf');
    expect(MonoUtils.storage.getString('LAST_LOGIN_AT')).toBeTruthy();

    MonoUtils.storage.set('LAST_LOGIN_AT', '');

    expect(MonoUtils.storage.getString('LAST_LOGIN_AT')).toBe('');
    messages.emit('onSubmit', {} as never, undefined, 'wololo');
    expect(MonoUtils.storage.getString('LAST_LOGIN_AT')).toBe('');
  });

  it('does not continue if ID is not checklistId or returnId', () => {
    const colStore = {} as Record<any, any>;
    const mockCol = {
      get() {
        return {
          data: colStore,
          get: (k: string) => colStore[k],
          set: (k: string, v: any) => (colStore[k] = v),
        }
      }
    };
    (env.project as any) = {
      collectionsManager: {
        ensureExists: () => mockCol,
      },
      saveEvent: jest.fn(),
      logins: [],
    };
    getSettings = () => ({
      enableReturn: true,
      returnHours: 10,
      returnId: 'foobar123',
      checklistId: 'asdf',
    });

    loadScript();
    messages.emit('onInit');

    MonoUtils.storage.set('LAST_LOGIN_AT', '');

    expect(MonoUtils.storage.getString('LAST_LOGIN_AT')).toBe('');
    messages.emit('onSubmit', {} as never, undefined, 'wololo');
    expect(MonoUtils.storage.getString('LAST_LOGIN_AT')).toBe('');
  });

  it('disables checklistUnlockTimer if checklist is submitted', () => {
    getSettings = () => ({
      enableLock: true,
      lockChecklistTime: 10,
      checklistId: 'asdf',
    });
    loadScript();
    messages.emit('onInit');
    messages.emit('onShowSubmit', undefined, 'asdf');
    messages.emit('onSubmit', undefined, undefined, 'asdf');

    expect(MonoUtils.wk.lock.getLockState()).toBe(false);
    jest.advanceTimersByTime(3 * 60 * 1000);
    expect(MonoUtils.wk.lock.getLockState()).toBe(false);
    jest.advanceTimersByTime(100 * 60 * 1000);
    expect(MonoUtils.wk.lock.getLockState()).toBe(false);
  });

  it('unlocks the machine under normal conditions', () => {
    getSettings = () => ({
      enableLock: true,
      lockChecklistTime: 10,
      checklistId: 'asdf',
    });
    loadScript();
    messages.emit('onInit');
    messages.emit('onShowSubmit', undefined, 'asdf');
    messages.emit('onSubmit', undefined, undefined, 'asdf');

    expect(MonoUtils.wk.lock.getLockState()).toBe(false);
  });

  describe('checklistQuestionsEnabled', () => {
    it('keeps locked if keepLocked is true', () => {
      getSettings = () => ({
        enableLock: true,
        lockChecklistTime: 10,
        checklistId: 'asdf',
        checklistQuestionsEnabled: true,
        checklistQuestions: [{
          question: 'foo',
          answer: 'bar',
          action: 'keepLocked',
        }]
      });
      loadScript();
      messages.emit('onInit');
      messages.emit('onShowSubmit', undefined, 'asdf');

      // does NOT answer the triggering response
      messages.emit('onSubmit', { data: { foo: 'zaz' } } as never, undefined, 'asdf');
      expect(MonoUtils.wk.lock.getLockState()).toBe(false);

      // DOES answer the triggering response (and should stay locked)
      messages.emit('onSubmit', { data: { foo: 'bar' } } as never, undefined, 'asdf');
      expect(MonoUtils.wk.lock.getLockState()).toBe(true);
    });

    it('goes into critical mode if critical is true', () => {
      (env.project as any) = {
        logout: jest.fn(),
        saveEvent: jest.fn(),
      };
      getSettings = () => ({
        enableLock: true,
        lockChecklistTime: 10,
        checklistId: 'asdf',
        checklistQuestionsEnabled: true,
        checklistQuestions: [{
          question: 'foo',
          answer: 'bar',
          action: 'critical',
        }]
      });
      loadScript();
      messages.emit('onInit');
      messages.emit('onShowSubmit', undefined, 'asdf');

      // does NOT answer the triggering response
      messages.emit('onSubmit', { data: { foo: 'zaz' } } as never, undefined, 'asdf');
      expect(MonoUtils.wk.lock.getLockState()).toBe(false);
      expect(MonoUtils.storage.getBoolean('IS_DEVICE_LOCKED')).toBe(false);
      expect(env.project.logout).not.toHaveBeenCalled();
      expect(env.project.saveEvent).not.toHaveBeenCalled();

      // DOES answer the triggering response (and should stay locked)
      messages.emit('onSubmit', { data: { foo: 'bar' } } as never, undefined, 'asdf');
      expect(MonoUtils.wk.lock.getLockState()).toBe(true);
      expect(MonoUtils.storage.getBoolean('IS_DEVICE_LOCKED')).toBe(true);
      expect(env.project.logout).toHaveBeenCalled();
      expect(env.project.saveEvent).toHaveBeenCalled();
      const eventCall = (env.project.saveEvent as jest.Mock).mock.calls[0][0];
      expect(eventCall.kind).toBe('critical-lock');
      expect(eventCall.getData().locked).toBe(true);
      expect(eventCall.getData().unlocked).toBe(false);
    });

    it('sets hourmeter if hourmeter is true', () => {
      getSettings = () => ({
        enableLock: true,
        lockChecklistTime: 10,
        checklistId: 'asdf',
        checklistQuestionsEnabled: true,
        checklistQuestions: [{
          question: 'foo',
          action: 'hourmeter',
          checklistTarget: 'hourmeterTarget'
        }]
      });
      const colStore = {} as Record<any, any>;
      const mockCol = {
        get() {
          return {
            data: colStore,
            get: (k: string) => colStore[k],
            set: (k: string, v: any) => (colStore[k] = v),
          }
        }
      };
      (env.project as any) = {
        collectionsManager: {
          ensureExists: () => mockCol,
        },
        saveEvent: jest.fn(),
        logins: [],
      };
      loadScript();
      messages.emit('onInit');
      messages.emit('onShowSubmit', undefined, 'asdf');

      // does NOT set the hourmeter if the answer is empty or invalid number
      messages.emit('onSubmit', { data: { foo: 'zaz' } } as never, undefined, 'asdf');
      expect(colStore.hourmeterTarget).toBe(undefined);
      expect(colStore.hourmeter).toBe(undefined);

      messages.emit('onSubmit', { data: { foo: '9123jgdsngksndg' } } as never, undefined, 'asdf');
      expect(colStore.hourmeterTarget).toBe(undefined);
      expect(colStore.hourmeter).toBe(undefined);

      // DOES set the hourmeter if the answer is a valid number
      messages.emit('onSubmit', { data: { foo: '1' } } as never, undefined, 'asdf');
      expect(colStore.hourmeterTarget).toBe(3600);
      expect(colStore.hourmeter).toBe(3600);

      // DOES set the hourmeter if the answer is a valid number
      messages.emit('onSubmit', { data: { foo: '3.5' } } as never, undefined, 'asdf');
      expect(colStore.hourmeterTarget).toBe(3600 * 3.5);
      expect(colStore.hourmeter).toBe(3600 * 3.5);
    });
  });
});

describe('onLogout', () => {
  // clean listeners
  afterEach(() => {
    messages.removeAllListeners();
    MonoUtils.storage.set('IS_DEVICE_LOCKED', false);
    MonoUtils.storage.set('LAST_LOGIN_AT', undefined);
    MonoUtils.storage.set('LAST_LOGIN', undefined);
  });

  it('unsets LOGIN env var', () => {
    getSettings = () => ({});
    (env.project as any) = {
      logout: jest.fn(),
      saveEvent: jest.fn(),
    };
    loadScript();
    messages.emit('onInit');

    env.data.LOGIN = '123';
    messages.emit('onLogout', '123');
    expect(env.data.LOGIN).toBe('');
  });

  it('unsets currentLogin on frota doc', () => {
    getSettings = () => ({});
    const colStore = {} as Record<any, any>;
    const mockCol = {
      get() {
        return {
          data: colStore,
          get: (k: string) => colStore[k],
          set: (k: string, v: any) => (colStore[k] = v),
        }
      }
    };
    (env.project as any) = {
      collectionsManager: {
        ensureExists: () => mockCol,
      },
      logout: jest.fn(),
      saveEvent: jest.fn(),
    };
    loadScript();
    messages.emit('onInit');

    colStore['currentLogin'] = '123';
    messages.emit('onLogout', '123');
    expect(colStore['currentLogin']).toBe('');
  });

  it('saves a logout event', () => {
    getSettings = () => ({});
    (env.project as any) = {
      logout: jest.fn(),
      saveEvent: jest.fn(),
    };
    loadScript();
    messages.emit('onInit');

    messages.emit('onLogout', '123');
    expect(env.project.saveEvent).toHaveBeenCalledTimes(1);
  });
});

describe('onEnd', () => {
  // clean listeners
  afterEach(() => {
    messages.removeAllListeners();
    MonoUtils.storage.set('IS_DEVICE_LOCKED', false);
    MonoUtils.storage.set('LAST_LOGIN_AT', undefined);
    MonoUtils.storage.set('LAST_LOGIN', undefined);
  });

  it('cleans checklistUnlockTimer if there is one', () => {
    getSettings = () => ({
      enableLock: true,
      lockChecklistTime: 10,
      checklistId: 'asdf',
    });
    loadScript();
    MonoUtils.wk.lock.unlock();

    messages.emit('onInit');
    messages.emit('onShowSubmit', undefined, 'asdf');

    expect(MonoUtils.wk.lock.getLockState()).toBe(false);
    messages.emit('onEnd');
    jest.advanceTimersByTime(100 * 60 * 1000);
    expect(MonoUtils.wk.lock.getLockState()).toBe(false);
  });
});