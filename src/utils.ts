export function wakeup() {
  if ('wakeup' in platform) {
    (platform as unknown as { wakeup: () => void }).wakeup();
  }
}

interface Action {
  name: string;
  action: string;
  payload: unknown;
}

type UrgentNotification = {
  title: string;
  message?: string;
  color?: string;
  actions?: Action[];
  urgent?: boolean;
} | null;

export function setUrgentNotification(notification: UrgentNotification) {
  if (!('setUrgentNotification' in platform)) {
    return;
  }

  if (notification !== null) {
    wakeup();
  }

  (platform as unknown as { setUrgentNotification: (notification: UrgentNotification) => void }).setUrgentNotification(notification);
}

export function getUrgentNotification(): UrgentNotification | null {
  if (!('getUrgentNotification' in platform)) {
    return null;
  }

  return (platform as unknown as { getUrgentNotification: () => UrgentNotification | null }).getUrgentNotification();
}
