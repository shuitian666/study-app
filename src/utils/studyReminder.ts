import { API_BASE } from '@/services/aiClient';

const REMINDER_ENABLED_KEY = 'study-app:review-reminder-enabled:v1';
const REMINDER_TIME_KEY = 'study-app:review-reminder-time:v1';
const REMINDER_PROMPTED_KEY = 'study-app:review-reminder-prompted:v1';
const DEFAULT_REMINDER_TIME = '20:00';

export interface StudyReminderSettings {
  enabled: boolean;
  reminderTime: string;
  prompted: boolean;
}

export interface ServerReminderPreferences {
  enabled: boolean;
  reminderTime: string;
  timezone: string;
  pushEnabled: boolean;
  emailFallbackEnabled: boolean;
}

export interface ReminderPreferencesResponse {
  preferences: ServerReminderPreferences;
  vapidPublicKey: string;
}

export interface StudyTaskReminderSnapshot {
  remainingCount: number;
  canCheckin: boolean;
}

export function getReviewReminderSettings(): StudyReminderSettings {
  return {
    enabled: localStorage.getItem(REMINDER_ENABLED_KEY) === '1',
    reminderTime: localStorage.getItem(REMINDER_TIME_KEY) || DEFAULT_REMINDER_TIME,
    prompted: localStorage.getItem(REMINDER_PROMPTED_KEY) === '1',
  };
}

export function setReviewReminderEnabled(enabled: boolean, reminderTime = DEFAULT_REMINDER_TIME): void {
  localStorage.setItem(REMINDER_ENABLED_KEY, enabled ? '1' : '0');
  localStorage.setItem(REMINDER_TIME_KEY, reminderTime);
  localStorage.setItem(REMINDER_PROMPTED_KEY, '1');
}

export function canUseBrowserNotification(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function canUsePushNotifications(): boolean {
  return canUseBrowserNotification() && 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function requestReviewReminderPermission(): Promise<boolean> {
  localStorage.setItem(REMINDER_PROMPTED_KEY, '1');
  const reminderTime = getReviewReminderSettings().reminderTime;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (!canUseBrowserNotification()) {
    try {
      await updateReminderPreferences({
        enabled: true,
        reminderTime,
        timezone,
        pushEnabled: false,
        emailFallbackEnabled: true,
      });
      setReviewReminderEnabled(true, reminderTime);
      return true;
    } catch {
      return false;
    }
  }

  const permission = Notification.permission === 'denied'
    ? 'denied'
    : Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();

  try {
    const data = await fetchReminderPreferences().catch(() => null);
    if (permission === 'granted' && canUsePushNotifications() && data?.vapidPublicKey) {
      await subscribeToPushNotifications(data.vapidPublicKey);
    } else {
      await updateReminderPreferences({
        enabled: true,
        reminderTime,
        timezone,
        pushEnabled: false,
        emailFallbackEnabled: true,
      });
    }
    setReviewReminderEnabled(true, reminderTime);
    return true;
  } catch {
    if (permission === 'granted') {
      setReviewReminderEnabled(true, reminderTime);
      updateReminderPreferences({
        enabled: true,
        reminderTime,
        timezone,
        emailFallbackEnabled: true,
      }).catch(() => {});
      return true;
    }
    return false;
  }
}

export function scheduleReviewReminder(input: StudyTaskReminderSnapshot | number): (() => void) | null {
  const settings = getReviewReminderSettings();
  const snapshot = typeof input === 'number'
    ? { remainingCount: input, canCheckin: false }
    : input;
  const remainingCount = Math.max(0, Math.round(Number(snapshot.remainingCount) || 0));
  const canCheckin = Boolean(snapshot.canCheckin);

  if (
    !settings.enabled ||
    (remainingCount <= 0 && !canCheckin) ||
    !canUseBrowserNotification() ||
    Notification.permission !== 'granted'
  ) {
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
      const title = remainingCount > 0 ? '今日学习量还没完成' : '今日目标已完成';
      const body = remainingCount > 0
        ? `还差 ${remainingCount} 项学习量，完成后就可以签到。`
        : '别忘了签到，领取今日奖励。';
      new Notification(title, {
        body,
        tag: 'study-app-daily-task-reminder',
      });
    }
  }, next.getTime() - now.getTime());

  return () => window.clearTimeout(timeoutId);
}

export async function fetchReminderPreferences(): Promise<ReminderPreferencesResponse> {
  const res = await fetch(`${API_BASE}/reminders/preferences`, { credentials: 'include' });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Failed to load reminder preferences');
  return res.json();
}

export async function updateReminderPreferences(
  patch: Partial<ServerReminderPreferences>,
): Promise<ServerReminderPreferences> {
  const res = await fetch(`${API_BASE}/reminders/preferences`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Failed to save reminder preferences');
  const data = await res.json();
  if (data.preferences) {
    setReviewReminderEnabled(Boolean(data.preferences.enabled), data.preferences.reminderTime || DEFAULT_REMINDER_TIME);
  }
  return data.preferences;
}

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return buffer;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.register('/sw.js');
}

export async function subscribeToPushNotifications(vapidPublicKey: string): Promise<ServerReminderPreferences> {
  if (!canUsePushNotifications()) {
    throw new Error('当前浏览器不支持推送通知');
  }
  if (!vapidPublicKey) {
    throw new Error('服务端尚未配置推送密钥，将使用邮件兜底');
  }

  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();
  localStorage.setItem(REMINDER_PROMPTED_KEY, '1');
  if (permission !== 'granted') {
    throw new Error('通知权限未开启');
  }

  const registration = await registerServiceWorker();
  if (!registration) throw new Error('无法注册离线通知服务');

  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToArrayBuffer(vapidPublicKey),
  });

  const res = await fetch(`${API_BASE}/reminders/push-subscription`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ subscription }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Failed to save push subscription');
  const data = await res.json();
  setReviewReminderEnabled(true, data.preferences?.reminderTime || DEFAULT_REMINDER_TIME);
  return data.preferences;
}

export async function unsubscribeFromPushNotifications(): Promise<ServerReminderPreferences | null> {
  const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.ready.catch(() => null) : null;
  const subscription = registration ? await registration.pushManager.getSubscription() : null;
  const endpoint = subscription?.endpoint || '';
  if (subscription) {
    await subscription.unsubscribe().catch(() => false);
  }

  const res = await fetch(`${API_BASE}/reminders/push-subscription`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ endpoint }),
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Failed to remove push subscription');
  const data = await res.json();
  return data.preferences;
}
