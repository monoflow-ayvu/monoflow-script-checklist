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
  });

  it('runs without errors', () => {
    loadScript();
    messages.emit('onInit');
  });

  xdescribe('onLogin', () => {
    it('onLogin sets IS_DEVICE_LOCKED', () => {});
    it('onLogin does not go through if device is locked', () => {});
    it('onLogin sets currentLogin on frota doc', () => {});
    it('onLogin saves a login event', () => {});
    it('unlocks device for a given time to complete the checklist', () => {});

    xdescribe('onLogin is a supervisor', () => {
      it('onLogin only lets a supervisor pass if device is locked', () => {});
      it('onLogin sets LAST_LOGIN_AT if device is unlocked by supervisor', () => {});
      it('onLogin passes without checklist if device is unlocked by supervisor', () => {});
    });

    xdescribe('special tags', () => {
      it('shows custom checklist for customChecklist tag', () => {});
      it('omitChecklist tag skips checklist', () => {});
      it('always sets LAST_LOGIN_AT', () => {});
    });

    xdescribe('enableReturn', () => {
      it('if same user returns before time limit, passes without checklist', () => {});
      it('continues to the checklist for returnId', () => {});
    });
  });

  xdescribe('onShowSubmit', () => {
    it('locks if more time than lockChecklistTime passes and enableLock is enabled', () => {});
  });

  xdescribe('onSubmit', () => {
    it('sets LAST_LOGIN_AT if formId is returnId or checklistId', () => {});
    it('does not continue if ID is not checklistId', () => {});
    it('disables checklistUnlockTimer if checklist is submitted', () => {});
    it('unlocks the machine under normal conditions', () => {});

    xdescribe('checklistQuestionsEnabled', () => {
      it('keeps locked if keepLocked is true', () => {});
      it('goes into critical mode if critical is true', () => {});
    });
  });

  xdescribe('onLogout', () => {
    it('unsets LOGIN env var', () => {});
    it('unsets currentLogin on frota doc', () => {});
    it('saves a logout event', () => {});
  });

  xdescribe('onEnd', () => {
    it('cleans checklistUnlockTimer if there is one', () => {});
  })
});