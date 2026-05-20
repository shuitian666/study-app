const REMINDER_ENABLED_KEY = 'study-app:review-reminder-enabled:v1';
const REMINDER_TIME_KEY = 'study-app:review-reminder-time:v1';
const REMINDER_PROMPTED_KEY = 'study-app:review-reminder-prompted:v1';

export interface ReviewReminderSettings {
  enabled: boolean;
  reminderTime: string;
  prompted: boolean;
}

export function getReviewReminderSettings(): ReviewReminderSettings {
  return {
    enabled: localStorage.getItem(REMINDER_ENABLED_KEY) === '1',
    reminderTime: localStorage.getItem(REMINDER_TIME_KEY) || '20:00',
    prompted: localStorage.getItem(REMINDER_PROMPTED_KEY) === '1',
  };
}

export function setReviewReminderEnabled(enabled: boolean, reminderTime = '20:00'): void {
  localStorage.setItem(REMINDER_ENABLED_KEY, enabled ? '1' : '0');
  localStorage.setItem(REMINDER_TIME_KEY, reminderTime);
  localStorage.setItem(REMINDER_PROMPTED_KEY, '1');
}

export function canUseBrowserNotification(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestReviewReminderPermission(): Promise<boolean> {
  localStorage.setItem(REMINDER_PROMPTED_KEY, '1');
  if (!canUseBrowserNotification()) return false;
  if (Notification.permission === 'granted') {
    setReviewReminderEnabled(true, getReviewReminderSettings().reminderTime);
    return true;
  }
  if (Notification.permission === 'denied') return false;

  const permission = await Notification.requestPermission();
  const granted = permission === 'granted';
  if (granted) {
    setReviewReminderEnabled(true, getReviewReminderSettings().reminderTime);
  }
  return granted;
}

export function scheduleReviewReminder(dueCount: number): (() => void) | null {
  const settings = getReviewReminderSettings();
  if (!settings.enabled || dueCount <= 0 || !canUseBrowserNotification() || Notification.permission !== 'granted') {
    return null;
  }

  const [hourRaw, minuteRaw] = settings.reminderTime.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;

  const now = new Date();
  const next = new Date();
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  const timeoutId = window.setTimeout(() => {
    if (Notification.permission === 'granted') {
      new Notification('今天还有复习任务', {
        body: `还有 ${dueCount} 张卡片待复习，花几分钟把节奏接上。`,
        tag: 'study-app-review-reminder',
      });
    }
  }, next.getTime() - now.getTime());

  return () => window.clearTimeout(timeoutId);
}
