/** Haptic feedback with the expo-haptics-style names the app uses. */
import { trigger, HapticFeedbackTypes } from "react-native-haptic-feedback";

export enum ImpactFeedbackStyle {
  Light = "light",
  Medium = "medium",
  Heavy = "heavy",
}

export enum NotificationFeedbackType {
  Success = "success",
  Warning = "warning",
  Error = "error",
}

const OPTIONS = { enableVibrateFallback: false, ignoreAndroidSystemSettings: false };

const IMPACT: Record<ImpactFeedbackStyle, HapticFeedbackTypes> = {
  [ImpactFeedbackStyle.Light]: HapticFeedbackTypes.impactLight,
  [ImpactFeedbackStyle.Medium]: HapticFeedbackTypes.impactMedium,
  [ImpactFeedbackStyle.Heavy]: HapticFeedbackTypes.impactHeavy,
};

const NOTIFICATION: Record<NotificationFeedbackType, HapticFeedbackTypes> = {
  [NotificationFeedbackType.Success]: HapticFeedbackTypes.notificationSuccess,
  [NotificationFeedbackType.Warning]: HapticFeedbackTypes.notificationWarning,
  [NotificationFeedbackType.Error]: HapticFeedbackTypes.notificationError,
};

export async function impactAsync(style: ImpactFeedbackStyle = ImpactFeedbackStyle.Medium): Promise<void> {
  trigger(IMPACT[style], OPTIONS);
}

export async function notificationAsync(type: NotificationFeedbackType = NotificationFeedbackType.Success): Promise<void> {
  trigger(NOTIFICATION[type], OPTIONS);
}

export async function selectionAsync(): Promise<void> {
  trigger(HapticFeedbackTypes.selection, OPTIONS);
}
