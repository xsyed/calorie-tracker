package com.caloriesapp

import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.TimeUnit

class PeriodicBackupSchedulerModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "PeriodicBackupScheduler"

  @ReactMethod
  fun configurePeriodicBackup(config: ReadableConfig, promise: Promise) {
    try {
      val enabled = config.getBoolean("enabled")
      val wifiOnly = config.getBoolean("wifiOnly")
      val workManager = WorkManager.getInstance(reactApplicationContext)

      if (!enabled) {
        workManager.cancelUniqueWork(WORK_NAME)
        promise.resolve(null)
        return
      }

      val networkType = if (wifiOnly) NetworkType.UNMETERED else NetworkType.CONNECTED
      val constraints = Constraints.Builder()
        .setRequiredNetworkType(networkType)
        .setRequiresBatteryNotLow(true)
        .build()
      val request = PeriodicWorkRequestBuilder<PeriodicBackupWorker>(7, TimeUnit.DAYS)
        .setConstraints(constraints)
        .build()

      workManager.enqueueUniquePeriodicWork(
        WORK_NAME,
        ExistingPeriodicWorkPolicy.UPDATE,
        request,
      )
      promise.resolve(null)
    } catch (error: RuntimeException) {
      promise.reject("PERIODIC_BACKUP_SCHEDULE_FAILED", error)
    }
  }

  companion object {
    private const val WORK_NAME = "periodic_backup"
  }
}

typealias ReadableConfig = com.facebook.react.bridge.ReadableMap
