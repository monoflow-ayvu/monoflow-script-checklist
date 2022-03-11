import MonoUtils from "@fermuch/monoutils";

type ReturnConfig = {
  enableReturn: boolean;
  returnId: string;
  returnHours: number;
};

type LockConfig = {
  enableLock: boolean;
  lockOutput: 'MONOFLOW_RELAY_1' | 'MONOFLOW_RELAY_2' | 'MONOFLOW_BUZ_1';
  lockChecklistTime: number;
};

type SpecialTag = {
  tag: string;
  action: "customChecklist" | "omitChecklist";
  customChecklistId: string;
};

type SpecialTagsConfig = {
  enableSpecialTags: boolean;
  specialTags: SpecialTag[];
};

type Config = ReturnConfig & LockConfig & SpecialTagsConfig & {
  checklistId: string;
  checklistHours: number;
}

export const conf = new MonoUtils.config.Config<Config>();
