/**
 * components/chat/ChatInputBar.tsx
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import IconButton from '../common/IconButton';
import { colors, radius, sizes, type } from '../../theme/tokens';
import {
  READINESS_TRANSITION_MS,
  SEND_ECHO_TRAVEL_PX,
  SEND_EXIT_MS,
  SEND_TAP_SCALE_DOWN_MS,
  SEND_TAP_SCALE_UP_MS,
  hasText,
} from './send-config';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  value: string;
  onChangeText: (v: string) => void;
  onPressAttach?: () => void;
  /**
   * Called with the composed text on send. Must return true only if a send
   * actually started — the outgoing-text animation only runs then.
   */
  onPressSend?: (text: string) => boolean;
  /** Called once the outgoing-text animation has finished, so the owner can clear the input. */
  onSendComplete?: () => void;
  sending?: boolean;
};

export default function ChatInputBar({
  value,
  onChangeText,
  onPressAttach,
  onPressSend,
  onSendComplete,
  sending = false,
}: Props) {
  // 1 = ready to send, 0 = empty/whitespace. Driven purely by the input text
  // (never network/sending state), so it retargets smoothly as the user types.
  const ready = useSharedValue(hasText(value) ? 1 : 0);
  const scale = useSharedValue(1);
  const echoOpacity = useSharedValue(0);
  const echoTranslateY = useSharedValue(0);
  const inputOpacity = useSharedValue(1);
  const [echoText, setEchoText] = useState('');
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Shared values are mutable-by-design, but the React Compiler flags direct
  // writes from JS callbacks. JS-side writes go through this one stable ref;
  // the UI-thread worklets read/write them directly and are compiler-trackable
  // (same pattern as components/home/AutoScrollRow.tsx).
  const sharedRefs = useRef({ ready, scale, echoOpacity, echoTranslateY, inputOpacity });

  const clearExitTimer = useCallback(() => {
    if (exitTimerRef.current != null) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  }, []);

  // Keep the eased enabled/disabled cross-fade in lock-step with the input text.
  useEffect(() => {
    sharedRefs.current.ready.value = withTiming(hasText(value) ? 1 : 0, {
      duration: READINESS_TRANSITION_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [value]);

  useEffect(() => clearExitTimer, [clearExitTimer]);

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + 0.6 * ready.value,
    backgroundColor: interpolateColor(ready.value, [0, 1], [colors.gray, colors.mint500]),
    shadowOpacity: 0.4 * ready.value,
    transform: [{ scale: scale.value }],
  }));

  const echoStyle = useAnimatedStyle(() => ({
    opacity: echoOpacity.value,
    transform: [{ translateY: echoTranslateY.value }],
  }));

  const inputFadeStyle = useAnimatedStyle(() => ({ opacity: inputOpacity.value }));

  // Kick the whole exit choreography off: the composed text flies up toward the
  // thread while the input fades back to rest; the owner clears the value only
  // after the flight completes, and the bubble lands right as that happens.
  const animateExit = useCallback(() => {
    const body = hasText(value) ? value.trim() : '';
    if (!body) return;
    setEchoText(body);
    const { scale: s, echoOpacity: eo, echoTranslateY: et, inputOpacity: io } = sharedRefs.current;
    s.value = withSequence(
      withTiming(0.9, { duration: SEND_TAP_SCALE_DOWN_MS, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: SEND_TAP_SCALE_UP_MS, easing: Easing.out(Easing.cubic) }),
    );
    // Show the echo immediately, then fly it up toward the thread while fading.
    eo.value = 1;
    et.value = 0;
    et.value = withTiming(-SEND_ECHO_TRAVEL_PX, {
      duration: SEND_EXIT_MS,
      easing: Easing.out(Easing.cubic),
    });
    eo.value = withTiming(0, { duration: SEND_EXIT_MS, easing: Easing.out(Easing.cubic) });
    io.value = withSequence(
      withTiming(0, { duration: SEND_EXIT_MS, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 160, easing: Easing.out(Easing.cubic) }),
    );
    clearExitTimer();
    exitTimerRef.current = setTimeout(() => {
      onSendComplete?.();
    }, SEND_EXIT_MS);
  }, [value, clearExitTimer, onSendComplete]);

  const handlePressSend = useCallback(() => {
    if (sending || !hasText(value)) return;
    const started = onPressSend?.(value) ?? false;
    if (!started) return;
    animateExit();
  }, [sending, value, onPressSend, animateExit]);

  const readyState = hasText(value);

  return (
    <View style={styles.bar}>
      <IconButton
        size={sizes.clipButton}
        backgroundColor={colors.sand100}
        onPress={onPressAttach}
        accessibilityLabel="Attach"
      >
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path
            d="M8 12L14.5 5.5C15.9 4.1 18.1 4.1 19.5 5.5C20.9 6.9 20.9 9.1 19.5 10.5L11.5 18.5C9.6 20.4 6.4 20.4 4.5 18.5C2.6 16.6 2.6 13.4 4.5 11.5L12 4"
            stroke={colors.gray}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </IconButton>

      <Animated.Text
        pointerEvents="none"
        numberOfLines={1}
        ellipsizeMode="tail"
        style={[type.chatInputPlaceholder, styles.echo, echoStyle]}
      >
        {echoText}
      </Animated.Text>

      <Animated.View style={[styles.inputWrap, inputFadeStyle]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Write a message…"
          placeholderTextColor={colors.sand400}
          style={[type.chatInputPlaceholder, styles.input]}
        />
      </Animated.View>

      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel="Send message"
        accessibilityState={{ disabled: !readyState || sending, busy: sending }}
        disabled={!readyState || sending}
        onPress={handlePressSend}
        style={[styles.sendBtn, buttonStyle]}
      >
        {sending ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M12 19V5M12 5L6 11M12 5L18 11" stroke={colors.white} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        )}
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  inputWrap: {
    flex: 1,
  },
  input: {
    backgroundColor: colors.sand100,
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 18,
    color: colors.forest900,
  },
  echo: {
    position: 'absolute',
    left: 16 + sizes.clipButton + 8,
    right: 16 + sizes.sendButton + 8,
    top: 20,
    color: colors.forest900,
    zIndex: 2,
  },
  sendBtn: {
    width: sizes.sendButton,
    height: sizes.sendButton,
    borderRadius: radius.pill,
    backgroundColor: colors.mint500,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.mint500,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
});