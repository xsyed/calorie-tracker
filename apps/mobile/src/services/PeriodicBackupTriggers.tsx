import { useEffect } from 'react';
import { AppState } from 'react-native';

import {
  runPeriodicBackupIfDue,
  syncPeriodicBackupSchedule,
} from './periodicBackupService';

export function PeriodicBackupTriggers() {
  useEffect(() => {
    void syncPeriodicBackupSchedule();
    void runPeriodicBackupIfDue();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void runPeriodicBackupIfDue();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return null;
}
