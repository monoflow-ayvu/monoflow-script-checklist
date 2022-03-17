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
  });

  it('runs without errors', () => {
    loadScript();
    messages.emit('onInit');
  });

  describe('onLogin', () => {
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
          logins: [{key: '123', tags: ['supervisor']}],
        };
        getSettings = () => ({
          enableSpecialTags: true,
          specialTags: [{tag: 'supervisor', action: 'supervisor'}],
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
          logins: [{key: '123', tags: ['supervisor']}],
        };
        getSettings = () => ({
          enableSpecialTags: true,
          specialTags: [{tag: 'supervisor', action: 'supervisor'}],
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
          logins: [{key: '123', tags: ['customChecklist']}],
        };
        getSettings = () => ({
          enableSpecialTags: true,
          specialTags: [{tag: 'customChecklist', action: 'customChecklist', customChecklistId: 'abc123'}],
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
          logins: [{key: '123', tags: ['omitChecklist']}],
        };
        getSettings = () => ({
          checklistId: 'asdf',
          enableSpecialTags: true,
          specialTags: [{tag: 'omitChecklist', action: 'omitChecklist', customChecklistId: ''}],
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
      xit('if same user returns before time limit, passes without checklist', () => { });
      xit('continues to the checklist for returnId', () => {});
    });
  });

  describe('onShowSubmit', () => {
    it('locks if more time than lockChecklistTime passes and enableLock is enabled', () => {
      getSettings = () => ({
        enableLock: true,
        lockChecklistTime: 10,
      });
      loadScript();
      messages.emit('onInit');
      messages.emit('onShowSubmit');
      
      expect(MonoUtils.wk.lock.getLockState()).toBe(false);
      jest.advanceTimersByTime(3 * 60 * 1000);
      expect(MonoUtils.wk.lock.getLockState()).toBe(false);
      jest.advanceTimersByTime(10 * 60 * 1000);
      expect(MonoUtils.wk.lock.getLockState()).toBe(true);
    });
  });

  xdescribe('onSubmit', () => {
    xit('sets LAST_LOGIN_AT if formId is returnId or checklistId', () => { });
    xit('does not continue if ID is not checklistId', () => { });
    xit('disables checklistUnlockTimer if checklist is submitted', () => { });
    xit('unlocks the machine under normal conditions', () => { });

    xdescribe('checklistQuestionsEnabled', () => {
      xit('keeps locked if keepLocked is true', () => { });
      xit('goes into critical mode if critical is true', () => { });
    });
  });

  xdescribe('onLogout', () => {
    xit('unsets LOGIN env var', () => { });
    xit('unsets currentLogin on frota doc', () => { });
    xit('saves a logout event', () => { });
  });

  xdescribe('onEnd', () => {
    xit('cleans checklistUnlockTimer if there is one', () => { });
  })
});