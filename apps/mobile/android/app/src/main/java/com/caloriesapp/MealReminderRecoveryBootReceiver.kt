package com.caloriesapp

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.facebook.react.HeadlessJsTaskService

class MealReminderRecoveryBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

    val serviceIntent = Intent(context, MealReminderRecoveryHeadlessTaskService::class.java).apply {
      putExtra(MealReminderRecoveryHeadlessTaskService.EXTRA_SOURCE, "android-boot")
    }
    context.startService(serviceIntent)
    HeadlessJsTaskService.acquireWakeLockNow(context)
  }
}
