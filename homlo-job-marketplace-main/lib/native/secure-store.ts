/**
 * Small key/value secret store (iOS Keychain / Android Keystore) with the
 * expo-secure-store-style names the app uses. Each key is its own keychain
 * "service" so values never overwrite each other.
 */
import * as Keychain from "react-native-keychain";

const SERVICE_PREFIX = "com.hirenow.app.";

export async function getItemAsync(key: string): Promise<string | null> {
  const result = await Keychain.getGenericPassword({ service: SERVICE_PREFIX + key });
  return result ? result.password : null;
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  const ok = await Keychain.setGenericPassword(key, value, {
    service: SERVICE_PREFIX + key,
    accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  if (!ok) throw new Error(`Could not save "${key}" to the secure store.`);
}

export async function deleteItemAsync(key: string): Promise<void> {
  await Keychain.resetGenericPassword({ service: SERVICE_PREFIX + key });
}
