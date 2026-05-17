package com.caloriesapp

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import java.io.File
import java.security.KeyStore
import java.security.SecureRandom
import javax.crypto.AEADBadTagException
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

class BackupCryptoModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "BackupCrypto"

  @ReactMethod
  fun hasLocalBackupKey(promise: Promise) {
    promise.resolve(loadStoredKeyMaterial() != null)
  }

  @ReactMethod
  fun encryptBackupFile(options: ReadableMap, promise: Promise) {
    try {
      val password = options.getString("password")?.trim().orEmpty()
      val storedKeyMaterial = loadStoredKeyMaterial()
      val keyMaterial = storedKeyMaterial ?: createAndStoreKeyMaterial(password)
      val contentIv = randomBytes(GCM_IV_BYTES)
      val inputPath = requireString(options, "inputPath")
      val outputPath = requireString(options, "outputPath")
      val encryptedSizeBytes = encryptFile(
        inputPath,
        outputPath,
        keyMaterial.dataKey,
        contentIv,
      )

      val manifest = Arguments.createMap()
      manifest.putInt("version", 1)
      manifest.putString("backupId", requireString(options, "backupId"))
      manifest.putString("createdTime", requireString(options, "createdTime"))
      manifest.putString("firebaseUid", requireString(options, "firebaseUid"))
      manifest.putString("originalChecksum", requireString(options, "originalChecksum"))
      manifest.putString("originalFileName", requireString(options, "originalFileName"))
      manifest.putDouble("originalSizeBytes", options.getDouble("originalSizeBytes"))
      manifest.putDouble("encryptedSizeBytes", encryptedSizeBytes.toDouble())
      manifest.putString("salt", encode(keyMaterial.salt))
      manifest.putString("wrappedDataKey", encode(keyMaterial.wrappedDataKey))
      manifest.putString("wrapIv", encode(keyMaterial.wrapIv))
      manifest.putString("contentIv", encode(contentIv))
      promise.resolve(manifest)
    } catch (error: BackupCryptoException) {
      promise.reject(error.code, error.message, error)
    } catch (error: Exception) {
      promise.reject("BACKUP_CRYPTO_FAILED", error)
    }
  }

  @ReactMethod
  fun decryptBackupFile(
    inputPath: String,
    outputPath: String,
    password: String,
    manifest: ReadableMap,
    promise: Promise,
  ) {
    try {
      val salt = decode(requireString(manifest, "salt"))
      val wrapIv = decode(requireString(manifest, "wrapIv"))
      val wrappedDataKey = decode(requireString(manifest, "wrappedDataKey"))
      val contentIv = decode(requireString(manifest, "contentIv"))
      val wrappingKey = deriveWrappingKey(password, salt)
      val dataKey = decryptBytes(wrappedDataKey, wrappingKey, wrapIv)
      decryptFile(inputPath, outputPath, dataKey, contentIv)
      promise.resolve(null)
    } catch (error: AEADBadTagException) {
      File(outputPath).delete()
      promise.reject("BACKUP_INCORRECT_PASSWORD", "Incorrect backup password.", error)
    } catch (error: BackupCryptoException) {
      File(outputPath).delete()
      promise.reject(error.code, error.message, error)
    } catch (error: Exception) {
      File(outputPath).delete()
      promise.reject("BACKUP_CRYPTO_FAILED", error)
    }
  }

  private fun createAndStoreKeyMaterial(password: String): StoredKeyMaterial {
    if (password.isBlank()) {
      throw BackupCryptoException(
        "BACKUP_PASSWORD_REQUIRED",
        "Backup password is required before first backup.",
      )
    }

    val dataKey = randomBytes(KEY_BYTES)
    val salt = randomBytes(SALT_BYTES)
    val wrapIv = randomBytes(GCM_IV_BYTES)
    val wrappingKey = deriveWrappingKey(password, salt)
    val wrappedDataKey = encryptBytes(dataKey, wrappingKey, wrapIv)
    val localIv = randomBytes(GCM_IV_BYTES)
    val localEncryptedDataKey = encryptWithLocalKey(dataKey, localIv)
    val prefs = getPrefs()

    prefs.edit()
      .putString(PREF_LOCAL_DATA_KEY, encode(localEncryptedDataKey))
      .putString(PREF_LOCAL_IV, encode(localIv))
      .putString(PREF_SALT, encode(salt))
      .putString(PREF_WRAP_IV, encode(wrapIv))
      .putString(PREF_WRAPPED_DATA_KEY, encode(wrappedDataKey))
      .apply()

    return StoredKeyMaterial(dataKey, salt, wrapIv, wrappedDataKey)
  }

  private fun loadStoredKeyMaterial(): StoredKeyMaterial? {
    val prefs = getPrefs()
    val localDataKey = prefs.getString(PREF_LOCAL_DATA_KEY, null) ?: return null
    val localIv = prefs.getString(PREF_LOCAL_IV, null) ?: return null
    val salt = prefs.getString(PREF_SALT, null) ?: return null
    val wrapIv = prefs.getString(PREF_WRAP_IV, null) ?: return null
    val wrappedDataKey = prefs.getString(PREF_WRAPPED_DATA_KEY, null) ?: return null
    val dataKey = decryptBytes(decode(localDataKey), getOrCreateLocalKey(), decode(localIv))

    return StoredKeyMaterial(
      dataKey,
      decode(salt),
      decode(wrapIv),
      decode(wrappedDataKey),
    )
  }

  private fun encryptFile(
    inputPath: String,
    outputPath: String,
    dataKey: ByteArray,
    iv: ByteArray,
  ): Long {
    val encrypted = encryptBytes(File(inputPath).readBytes(), dataKey, iv)
    File(outputPath).writeBytes(encrypted)
    return encrypted.size.toLong()
  }

  private fun decryptFile(
    inputPath: String,
    outputPath: String,
    dataKey: ByteArray,
    iv: ByteArray,
  ) {
    val decrypted = decryptBytes(File(inputPath).readBytes(), dataKey, iv)
    File(outputPath).writeBytes(decrypted)
  }

  private fun deriveWrappingKey(password: String, salt: ByteArray): ByteArray {
    val spec = PBEKeySpec(password.toCharArray(), salt, PBKDF2_ITERATIONS, KEY_BITS)
    return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
      .generateSecret(spec)
      .encoded
  }

  private fun encryptBytes(data: ByteArray, key: ByteArray, iv: ByteArray): ByteArray =
    runCipher(Cipher.ENCRYPT_MODE, data, key, iv)

  private fun encryptBytes(data: ByteArray, key: SecretKey, iv: ByteArray): ByteArray =
    runCipher(Cipher.ENCRYPT_MODE, data, key, iv)

  private fun decryptBytes(data: ByteArray, key: ByteArray, iv: ByteArray): ByteArray =
    runCipher(Cipher.DECRYPT_MODE, data, key, iv)

  private fun decryptBytes(data: ByteArray, key: SecretKey, iv: ByteArray): ByteArray =
    runCipher(Cipher.DECRYPT_MODE, data, key, iv)

  private fun runCipher(mode: Int, data: ByteArray, key: ByteArray, iv: ByteArray): ByteArray {
    return runCipher(mode, data, SecretKeySpec(key, "AES"), iv)
  }

  private fun runCipher(mode: Int, data: ByteArray, key: SecretKey, iv: ByteArray): ByteArray {
    val cipher = Cipher.getInstance(AES_GCM_TRANSFORMATION)
    // IVs are random per encryption call and stored in the manifest for decrypt.
    // nosemgrep: kotlin.lang.security.gcm-detection.gcm-detection
    cipher.init(mode, key, GCMParameterSpec(GCM_TAG_BITS, iv))
    return cipher.doFinal(data)
  }

  private fun getOrCreateLocalKey(): SecretKey {
    val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE)
    keyStore.load(null)
    val existing = keyStore.getEntry(KEY_ALIAS, null) as? KeyStore.SecretKeyEntry
    if (existing != null) return existing.secretKey

    val keyGenerator = KeyGenerator.getInstance(
      KeyProperties.KEY_ALGORITHM_AES,
      ANDROID_KEYSTORE,
    )
    val spec = KeyGenParameterSpec.Builder(
      KEY_ALIAS,
      KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
    )
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setRandomizedEncryptionRequired(false)
      .setKeySize(KEY_BITS)
      .build()
    keyGenerator.init(spec)
    return keyGenerator.generateKey()
  }

  private fun deleteLocalKey() {
    val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE)
    keyStore.load(null)
    keyStore.deleteEntry(KEY_ALIAS)
  }

  private fun encryptWithLocalKey(dataKey: ByteArray, iv: ByteArray): ByteArray {
    try {
      return encryptBytes(dataKey, getOrCreateLocalKey(), iv)
    } catch (e: Exception) {
      if (e.message?.contains("IV not permitted", ignoreCase = true) == true) {
        deleteLocalKey()
        return encryptBytes(dataKey, getOrCreateLocalKey(), iv)
      }
      throw e
    }
  }

  private fun requireString(map: ReadableMap, key: String): String =
    map.getString(key) ?: throw BackupCryptoException(
      "BACKUP_CRYPTO_FAILED",
      "Missing $key.",
    )

  private fun getPrefs() = reactApplicationContext.getSharedPreferences(
    PREFS_NAME,
    Context.MODE_PRIVATE,
  )

  private fun randomBytes(size: Int): ByteArray =
    ByteArray(size).also { SecureRandom().nextBytes(it) }

  private fun encode(bytes: ByteArray): String =
    Base64.encodeToString(bytes, Base64.NO_WRAP)

  private fun decode(value: String): ByteArray =
    Base64.decode(value, Base64.NO_WRAP)

  companion object {
    private const val AES_GCM_TRANSFORMATION = "AES/GCM/NoPadding"
    private const val ANDROID_KEYSTORE = "AndroidKeyStore"
    private const val GCM_IV_BYTES = 12
    private const val GCM_TAG_BITS = 128
    private const val KEY_ALIAS = "calories_backup_local_key"
    private const val KEY_BITS = 256
    private const val KEY_BYTES = 32
    private const val PBKDF2_ITERATIONS = 210_000
    private const val PREF_LOCAL_DATA_KEY = "local_data_key"
    private const val PREF_LOCAL_IV = "local_iv"
    private const val PREF_SALT = "salt"
    private const val PREF_WRAP_IV = "wrap_iv"
    private const val PREF_WRAPPED_DATA_KEY = "wrapped_data_key"
    private const val PREFS_NAME = "backup_crypto"
    private const val SALT_BYTES = 16
  }
}

private data class StoredKeyMaterial(
  val dataKey: ByteArray,
  val salt: ByteArray,
  val wrapIv: ByteArray,
  val wrappedDataKey: ByteArray,
)

private class BackupCryptoException(
  val code: String,
  message: String,
) : RuntimeException(message)
