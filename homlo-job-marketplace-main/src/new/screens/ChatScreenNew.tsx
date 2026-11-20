import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextNew } from '../components/TextNew';
import Avatar from '../../../components/chat/Avatar';
import { AvatarNew, ChipNew, FieldNew, RoundButtonNew } from '../components/PrimitivesNew';
import { AppIconNew } from '../icons/AppIconNew';
import { useFirstLoadSkeletonFlag } from '@/lib/useFirstLoadSkeletonFlag';
import { ChatThreadSkeleton } from '@/src/new/components/NewSkeletons';
import { colorsNew } from '../theme/tokensNew';
import { useCopyNew } from '../theme/copyNew';

export type ChatMessageNew = {
  id: string;
  mine: boolean;
  text: string;
  system?: boolean;
  dayLabel?: string;
  jobLabel?: string;
  /** Local message still on its way, or one that failed to send. */
  status?: 'sending' | 'failed';
  /** Arrived after the thread was shown: animate it in. */
  animate?: boolean;
};
type Props = {
  name: string; initials: string; photo?: string | null; subtitle?: string; messages: ChatMessageNew[];
  draft: string; onChangeDraft: (t: string) => void; onSend: () => void; onBack: () => void;
  quickReplies?: string[]; onPressQuickReply?: (t: string) => void;
  loading?: boolean; errorText?: string; onRetry?: () => void; onPressMore?: () => void;
  hasMore?: boolean; loadingEarlier?: boolean; onLoadEarlier?: () => void;
  onRetryMessage?: (id: string) => void;
};

/** One chat bubble. Memoised so a new message never re-renders the others. */
const Bubble = memo(function Bubble({ item, reduced, onRetry }: { item: ChatMessageNew; reduced: boolean; onRetry?: (id: string) => void }) {
  const failed = item.status === 'failed';
  // Sending bubbles sit slightly faded and settle to full opacity when sent.
  const fade = useAnimatedStyle(() => ({
    opacity: withTiming(item.status === 'sending' ? 0.6 : 1, { duration: reduced ? 0 : 220 }),
  }));
  const entering = !item.animate || reduced
    ? undefined
    : item.mine
      ? FadeInDown
      : FadeInUp;

  return (
    <Animated.View entering={entering} layout={reduced ? undefined : LinearTransition.duration(200)} style={{ alignSelf: item.mine ? 'flex-end' : 'flex-start', maxWidth: '78%', marginHorizontal: 16, marginVertical: 3 }}>
      <Pressable
        disabled={!failed}
        onPress={() => onRetry?.(item.id)}
        accessibilityRole={failed ? 'button' : undefined}
        accessibilityLabel={failed ? 'Message not sent. Tap to retry' : undefined}
      >
        <Animated.View
          style={[
            {
              paddingVertical: 10,
              paddingHorizontal: 14,
              backgroundColor: failed ? colorsNew.clayTint : item.mine ? colorsNew.primary : colorsNew.white,
              borderWidth: item.mine && !failed ? 0 : 1,
              borderColor: failed ? colorsNew.clayTint2 : colorsNew.border,
              borderRadius: 20,
              borderBottomRightRadius: item.mine ? 6 : 20,
              borderBottomLeftRadius: item.mine ? 20 : 6,
            },
            fade,
          ]}
        >
          <TextNew variant="body" color={failed ? colorsNew.clayInk : item.mine ? colorsNew.white : colorsNew.text}>{item.text}</TextNew>
        </Animated.View>
      </Pressable>
      {item.status ? (
        <Animated.View entering={reduced ? undefined : FadeIn.duration(180)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', marginTop: 4, marginRight: 4 }}>
          {failed ? <AppIconNew name="x" size={12} color={colorsNew.clay} /> : <AppIconNew name="clock" size={12} color={colorsNew.muted} />}
          <TextNew variant="caption" color={failed ? colorsNew.clay : colorsNew.muted}>{failed ? 'Not sent · Tap to retry' : 'Sending…'}</TextNew>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
});

export function ChatScreenNew(p: Props) {
  const copy = useCopyNew();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const list = useRef<FlatList<ChatMessageNew>>(null);
  const showSkeleton = useFirstLoadSkeletonFlag({
    loading: Boolean(p.loading),
    data: p.messages.length ? p.messages : undefined,
  });

  // Chat-style scrolling: while you're at the bottom the list stays pinned to
  // the newest message (instantly while the thread first lays out, smoothly
  // for new messages). Scroll up to read history and it leaves you there.
  const pinned = useRef(true);
  const settled = useRef(false);
  const lastKey = p.messages[p.messages.length - 1]?.id;
  const prevLastKey = useRef(lastKey);
  // BUGFIX: threads opened at the OLDEST message. maintainVisibleContentPosition
  // (keep your place when history loads above) was active from the first
  // render and held the top row in view, cancelling the initial scrollToEnd.
  // Enable it only once the thread has settled at the bottom.
  const [keepPosition, setKeepPosition] = useState(false);
  const scrollToNewest = useCallback((animated: boolean) => {
    requestAnimationFrame(() => list.current?.scrollToEnd({ animated }));
  }, []);
  const onContentSizeChange = useCallback(() => {
    if (pinned.current) scrollToNewest(settled.current && !reduced);
  }, [reduced, scrollToNewest]);
  // Only a real drag can un-pin: layout-time scroll events are ignored.
  const userScrolling = useRef(false);
  const onScroll = useCallback((e: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
    if (!userScrolling.current) return;
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    pinned.current = contentSize.height - (contentOffset.y + layoutMeasurement.height) < 80;
  }, []);
  const onScrollBeginDrag = useCallback(() => { userScrolling.current = true; }, []);
  const onMomentumScrollEnd = useCallback(() => { userScrolling.current = false; }, []);
  const onLayout = useCallback(() => {
    if (pinned.current) scrollToNewest(false);
  }, [scrollToNewest]);
  useEffect(() => {
    // Sending a message always brings you back to the bottom.
    const last = p.messages[p.messages.length - 1];
    if (lastKey && lastKey !== prevLastKey.current && last?.mine) pinned.current = true;
    prevLastKey.current = lastKey;
  }, [lastKey, p.messages]);
  const hasMessages = !showSkeleton && p.messages.length > 0;
  useEffect(() => {
    // Once the messages are on screen: settle at the newest, then later
    // scrolls animate and "keep position" turns on for loading history.
    if (!hasMessages || settled.current) return;
    const t = setTimeout(() => {
      if (pinned.current) scrollToNewest(false);
      // Rows can still grow on their final layout pass; settle once more.
      t2 = setTimeout(() => {
        if (pinned.current) scrollToNewest(false);
        settled.current = true;
        setKeepPosition(true);
      }, 250);
    }, 600);
    let t2: ReturnType<typeof setTimeout> | undefined;
    return () => {
      clearTimeout(t);
      if (t2) clearTimeout(t2);
    };
  }, [hasMessages, scrollToNewest]);

  const canSend = p.draft.trim().length > 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colorsNew.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: insets.top + 8, paddingBottom: 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colorsNew.white, borderBottomWidth: 1, borderColor: colorsNew.border }}>
        <RoundButtonNew icon="back" onPress={p.onBack} accessibilityLabel={copy.common.back} />
        <Avatar photo={p.photo} style={{ width: 44, height: 44, borderRadius: 14 }}>
          <AvatarNew initials={p.initials} radius={14} bg={colorsNew.deep} />
        </Avatar>
        <View style={{ flex: 1 }}>
          <TextNew variant="title" weight="semibold" numberOfLines={1}>{p.name}</TextNew>
          {!!p.subtitle && <TextNew variant="meta" color={colorsNew.muted} numberOfLines={1}>{p.subtitle}</TextNew>}
        </View>
        {!!p.onPressMore && <RoundButtonNew icon="dots" onPress={p.onPressMore} accessibilityLabel="More" />}
      </View>

      {!!p.errorText && (
        <Animated.View entering={reduced ? undefined : FadeInDown.duration(200)} style={{ backgroundColor: colorsNew.clay + '1A', paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <TextNew variant="meta" color={colorsNew.clay}>{p.errorText}</TextNew>
          </View>
          {!!p.onRetry && (
            <Pressable accessibilityRole="button" accessibilityLabel="Retry loading messages" hitSlop={8} onPress={p.onRetry}>
              <TextNew variant="meta" color={colorsNew.primary} weight="semibold">Retry</TextNew>
            </Pressable>
          )}
        </Animated.View>
      )}

      {showSkeleton ? (
        <View style={{ flex: 1 }}>
          <ChatThreadSkeleton />
        </View>
      ) : (
        <Animated.View entering={reduced ? undefined : FadeIn.duration(200)} style={{ flex: 1 }}>
          <FlatList
            ref={list}
            data={p.messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ paddingVertical: 16, flexGrow: 1 }}
            onContentSizeChange={onContentSizeChange}
            onScroll={onScroll}
            onScrollBeginDrag={onScrollBeginDrag}
            onMomentumScrollEnd={onMomentumScrollEnd}
            onLayout={onLayout}
            scrollEventThrottle={32}
            // Keeps your place when earlier messages are added above.
            maintainVisibleContentPosition={keepPosition ? { minIndexForVisible: 0 } : undefined}
            // Keep rows mounted so scrolling never re-creates (and re-animates) them.
            initialNumToRender={30}
            windowSize={21}
            removeClippedSubviews={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            ListEmptyComponent={
              !p.errorText && !p.loading ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
                  <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colorsNew.tint, alignItems: 'center', justifyContent: 'center' }}>
                    <AppIconNew name="send" color={colorsNew.deep} />
                  </View>
                  <TextNew variant="body" color={colorsNew.muted} align="center">{copy.chat.empty}</TextNew>
                </View>
              ) : null
            }
            ListHeaderComponent={
              p.hasMore ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Load earlier messages"
                  disabled={p.loadingEarlier}
                  onPress={p.onLoadEarlier}
                  style={{ alignSelf: 'center', minWidth: 170, alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, marginBottom: 8, borderRadius: 999, backgroundColor: colorsNew.white, borderWidth: 1, borderColor: colorsNew.border }}
                >
                  {p.loadingEarlier ? <ActivityIndicator size="small" color={colorsNew.primary} /> : <TextNew variant="meta" color={colorsNew.primary} weight="semibold">Load earlier messages</TextNew>}
                </Pressable>
              ) : null
            }
            renderItem={({ item }) => (
              <>
                {!!item.dayLabel && (
                  <View style={{ alignItems: 'center', marginVertical: 10 }}>
                    <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: colorsNew.track }}>
                      <TextNew variant="caption" weight="semibold" color={colorsNew.muted}>{item.dayLabel}</TextNew>
                    </View>
                  </View>
                )}
                {!!item.jobLabel && (
                  <View style={{ alignItems: 'center', marginVertical: 6, paddingHorizontal: 24 }}>
                    <TextNew variant="meta" color={colorsNew.muted} align="center">{item.jobLabel}</TextNew>
                  </View>
                )}
                {item.system ? (
                  <Animated.View
                    entering={item.animate && !reduced ? FadeIn.duration(220) : undefined}
                    style={{ alignSelf: 'center', maxWidth: '86%', marginVertical: 6, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 16, backgroundColor: colorsNew.white, borderWidth: 1, borderColor: colorsNew.border }}
                  >
                    <TextNew variant="meta" color={colorsNew.muted} align="center">{item.text}</TextNew>
                  </Animated.View>
                ) : (
                  <Bubble item={item} reduced={reduced} onRetry={p.onRetryMessage} />
                )}
              </>
            )}
          />
        </Animated.View>
      )}

      <View style={{ backgroundColor: colorsNew.white, borderTopWidth: 1, borderColor: colorsNew.border, paddingTop: 8, paddingHorizontal: 16, paddingBottom: 12 + insets.bottom }}>
        {!!p.quickReplies?.length && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
            {p.quickReplies.map((q) => <ChipNew key={q} size="lg" label={q} onPress={() => p.onPressQuickReply?.(q)} />)}
          </ScrollView>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}><FieldNew value={p.draft} onChangeText={p.onChangeDraft} placeholder={copy.chat.message} style={{}} onSubmitEditing={p.onSend} returnKeyType="send" /></View>
          <RoundButtonNew
            icon="send"
            bg={canSend ? colorsNew.primary : colorsNew.track}
            color={canSend ? colorsNew.white : colorsNew.muted}
            onPress={canSend ? p.onSend : undefined}
            accessibilityLabel="Send"
            style={{ marginTop: 0 }}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
