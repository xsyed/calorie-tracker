package com.caloriesapp

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class MealReminderRecoveryHeadlessTaskService : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig {
    val data = Arguments.createMap().apply {
      putString("source", intent?.getStringExtra(EXTRA_SOURCE) ?: "android-boot")
    }

    return HeadlessJsTaskConfig(
      "MealReminderRecoveryHeadlessTask",
      data,
      TASK_TIMEOUT_MS,
      false,
    )
  }

  companion object {
    const val EXTRA_SOURCE = "source"
    private const val TASK_TIMEOUT_MS = 60000L
  }
}
