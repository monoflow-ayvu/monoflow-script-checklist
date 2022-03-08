import type { StoreBasicValueT, CollectionDoc } from "@fermuch/telematree";

export function myID(): string {
  return 'id' in platform ?
      String(platform.id)
    : String(data.DEVICE_ID) || '';
}

export function currentLogin(): string {
  return (
    env.project.currentLogin?.maybeCurrent?.key
    || env.project.currentLogin?.maybeCurrent?.$modelId
    || env.currentLogin?.key
    || env.currentLogin?.$modelId
    || ''
  );
}

export function set(key: string, val: string | number | boolean): void {
  if ('set' in platform) {
    return (platform.set as (key: string, val: string | number | boolean) => void)(key, val);
  }
}

export function del(key: string): void {
  if ('delete' in platform) {
    return (platform.delete as (key: string) => void)(key);
  }
}

export function getString(key: string): string {
  if ('getString' in platform) {
    return String((platform.getString as (key: string) => string)(key));
  }
}

export function getBoolean(key: string): boolean {
  if ('getBoolean' in platform) {
    return Boolean((platform.getBoolean as (key: string) => boolean)(key));
  }
}

export function getNumber(key: string): number {
  if ('getNumber' in platform) {
    return Number((platform.getNumber as (key: string) => number)(key) || 0);
  }
}

export interface FrotaCollection {
  scriptVer: string;
  batteryLevel: number;
  appVer: string;
  ioVer: string;
  lastEventAt: number;
  bleConnected: boolean;
  currentLogin: string;
  loginDate: number;
  mttr: number;
  mtbf: number;
  pulsusId?: string;

  [key: string]: StoreBasicValueT;
}

export function getFrotaDoc(): CollectionDoc<FrotaCollection> | null {
  const col = env.project?.collectionsManager?.ensureExists?.<FrotaCollection>("frota");
  if (!col) return null;
  return col.get(myID());
}