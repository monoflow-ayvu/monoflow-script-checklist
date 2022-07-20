import * as MonoUtils from "@fermuch/monoutils";

type ReturnConfig = {
  enableReturn: boolean;
  returnId: string;
  returnHours: number;
};

type LockConfig = {
  enableLock: boolean;
  enableUnlockHack: boolean;
  lockOutput: 'MONOFLOW_RELAY_1' | 'MONOFLOW_RELAY_2' | 'MONOFLOW_BUZ_1';
  lockChecklistTime: number;
};

type SpecialTagSupervisor = {
  tag: string;
  action: "supervisor";
}

type SpecialTagOmitChecklist = {
  tag: string;
  action: "omitChecklist";
}

type SpecialTagCustomChecklist = {
  tag: string;
  action: "customChecklist";
  customChecklistId: string;
}

type SpecialTagCustomReturn = {
  tag: string;
  action: "customReturn";
  customReturnId: string;
}

type SpecialTag =
    SpecialTagSupervisor
  | SpecialTagOmitChecklist
  | SpecialTagCustomChecklist
  | SpecialTagCustomReturn;

type SpecialTagsConfig = {
  enableSpecialTags: boolean;
  specialTags: SpecialTag[];
};

type ChecklistQuestion = {
  question: string;
  answer: string;
  action: 'keepLocked' | 'critical' | 'hourmeter';
  checklistTarget?: string;
}

type ChecklistQuestionsConfig = {
  checklistQuestionsEnabled: boolean;
  checklistQuestions: ChecklistQuestion[];
};

type Config =
  ReturnConfig
  & LockConfig
  & SpecialTagsConfig
  & ChecklistQuestionsConfig
  & {
    checklistId: string;
    checklistHours: number;
  };

export const conf = new MonoUtils.config.Config<Config>();
