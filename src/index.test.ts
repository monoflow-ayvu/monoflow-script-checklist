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

      // DOES answer the triggering response (and should stay locked)
      messages.emit('onSubmit', { data: { foo: 'bar' } } as never, undefined, 'asdf');
      expect(MonoUtils.wk.lock.getLockState()).toBe(true);
      expect(MonoUtils.storage.getBoolean('IS_DEVICE_LOCKED')).toBe(true);
      expect(env.project.logout).toHaveBeenCalled();
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