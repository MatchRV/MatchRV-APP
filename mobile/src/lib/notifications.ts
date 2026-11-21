// Local notifications for price drops / new alert matches (port of AlertNotificationHelper.kt).
// No push server: notifications are scheduled locally right after a "check now" finds something.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID = 'matchrv_alerts';
const ENABLED_KEY = 'matchrv.alertNotificationsEnabled';

let handlerSet = false;
export function configureNotificationHandler() {
  if (handlerSet || Platform.OS === 'web') return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'MatchRV Price Drops & New Matches',
    description: 'Alerts when saved RVs drop in price or new dealer units match your saved criteria.',
    // eslint-disable-next-line import/namespace -- re-exported enum the import plugin can't trace
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function areAlertNotificationsEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(ENABLED_KEY)) === 'true';
}

/** Requests OS permission — call ONLY when the user turns alert notifications on. */
export async function enableAlertNotifications(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  await ensureChannel(); // Android 13+ shows the prompt only once a channel exists
  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  if (!granted) granted = (await Notifications.requestPermissionsAsync()).granted;
  await AsyncStorage.setItem(ENABLED_KEY, granted ? 'true' : 'false');
  return granted;
}

export async function disableAlertNotifications(): Promise<void> {
  await AsyncStorage.setItem(ENABLED_KEY, 'false');
}

/** Posts a notification if the user opted in and permission is still granted; never prompts. */
export async function postAlertNotification(title: string, body: string): Promise<void> {
  if (Platform.OS === 'web' || !(await areAlertNotificationsEnabled())) return;
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return;
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null,
    });
  } catch (e) {
    if (__DEV__) console.warn('Local notification failed', e);
  }
}
