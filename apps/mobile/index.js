/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { registerNotificationBackgroundTapHandler } from './src/services/notificationTapRouting';
import { runMealReminderRecoveryHeadlessTask } from './src/services/reminderRecoveryService';

registerNotificationBackgroundTapHandler();

AppRegistry.registerHeadlessTask(
  'MealReminderRecoveryHeadlessTask',
  () => runMealReminderRecoveryHeadlessTask,
);

AppRegistry.registerComponent(appName, () => App);
