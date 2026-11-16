import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextNew } from '../components/TextNew';
import Avatar from '../../../components/chat/Avatar';
import { AvatarNew, ChipNew, FieldNew, RoundButtonNew } from '../components/PrimitivesNew';
import { useFirstLoadSkeletonFlag } from '@/lib/useFirstLoadSkeletonFlag';
import { ChatThreadSkeleton } from '@/src/new/components/NewSkeletons';
import { colorsNew } from '../theme/tokensNew';
import { useCopyNew } from '../theme/copyNew';

export type ChatMessageNew = { id: string; mine: boolean; text: string; system?: boolean; dayLabel?: string; jobLabel?: string };
type Props = {
  name: string; initials: string; photo?: string | null; subtitle?: string; messages: ChatMessageNew[];
  draft: string; onChangeDraft: (t: string) => void; onSend: () => void; onBack: () => void;
  quickReplies?: string[]; onPressQuickReply?: (t: string) => void;
  loading?: boolean; errorText?: string; onRetry?: () => void; onPressMore?: () => void;
  hasMore?: boolean; loadingEarlier?: boolean; onLoadEarlier?: () => void;
};

export function ChatScreenNew(p: Props) {
  const copy = useCopyNew();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const list = useRef<FlatList<ChatMessageNew>>(null);
  const showSkeleton = useFirstLoadSkeletonFlag({
    loading: Boolean(p.loading),
    data: p.messages.length ? p.messages : undefined,
  });
  useEffect(() => { list.current?.scrollToEnd({ animated: !reduced }); }, [p.messages.length]);
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
        <View style={{ backgroundColor: colorsNew.clay + '1A', paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <TextNew variant="meta" color={colorsNew.clay}>{p.errorText}</TextNew>
          </View>
          {!!p.onRetry && (
            <Pressable accessibilityRole="button" accessibilityLabel="Retry loading messages" hitSlop={8} onPress={p.onRetry}>
              <TextNew variant="meta" color={colorsNew.primary} weight="semibold">Retry</TextNew>
            </Pressable>
          )}
        </View>
      )}

      {showSkeleton ? (
        <View style={{ flex: 1 }}>
          <ChatThreadSkeleton />
        </View>
      ) : (
        <FlatList
          ref={list} data={p.messages} keyExtractor={(m) => m.id} contentContainerStyle={{ paddingVertical: 16 }}
          ListEmptyComponent={
            !p.errorText ? (
              <View style={{ padding: 32 }}>
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
                style={{ alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 8, marginBottom: 8, borderRadius: 14, backgroundColor: colorsNew.white, borderWidth: 1, borderColor: colorsNew.border }}
              >
                {p.loadingEarlier ? <ActivityIndicator size="small" color={colorsNew.primary} /> : <TextNew variant="meta" color={colorsNew.primary} weight="semibold">Load earlier messages</TextNew>}
              </Pressable>
            ) : null
          }
          renderItem={({ item }) => (
            <>
              {!!item.dayLabel && (
                <View style={{ alignItems: 'center', marginVertical: 8 }}>
                  <TextNew variant="meta" color={colorsNew.muted}>{item.dayLabel}</TextNew>
                </View>
              )}
              {!!item.jobLabel && (
                <View style={{ alignItems: 'center', marginVertical: 6 }}>
                  <TextNew variant="meta" color={colorsNew.muted} align="center">{item.jobLabel}</TextNew>
                </View>
              )}
              {item.system ? (
                <View style={{ alignSelf: 'center', maxWidth: '86%', marginVertical: 6, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 16, backgroundColor: colorsNew.white, borderWidth: 1, borderColor: colorsNew.border }}>
                  <TextNew variant="meta" color={colorsNew.muted} align="center">{item.text}</TextNew>
                </View>
              ) : (
                <Animated.View entering={reduced ? undefined : FadeInDown.duration(250)}
                  style={{ maxWidth: '76%', marginHorizontal: 16, marginVertical: 4, paddingVertical: 10, paddingHorizontal: 14, alignSelf: item.mine ? 'flex-end' : 'flex-start',
                    backgroundColor: item.mine ? colorsNew.primary : colorsNew.white, borderWidth: item.mine ? 0 : 1, borderColor: colorsNew.border,
                    borderRadius: 20, borderBottomRightRadius: item.mine ? 6 : 20, borderBottomLeftRadius: item.mine ? 20 : 6 }}>
                  <TextNew variant="body" color={item.mine ? colorsNew.white : colorsNew.text}>{item.text}</TextNew>
                </Animated.View>
              )}
            </>
          )}
        />
      )}

      <View style={{ backgroundColor: colorsNew.white, borderTopWidth: 1, borderColor: colorsNew.border, paddingTop: 8, paddingHorizontal: 16, paddingBottom: 12 + insets.bottom }}>
        {!!p.quickReplies?.length && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
            {p.quickReplies.map((q) => <ChipNew key={q} size="lg" label={q} onPress={() => p.onPressQuickReply?.(q)} />)}
          </ScrollView>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}><FieldNew value={p.draft} onChangeText={p.onChangeDraft} placeholder={copy.chat.message} style={{}} onSubmitEditing={p.onSend} /></View>
          <RoundButtonNew icon="send" bg={colorsNew.primary} color={colorsNew.white} onPress={p.onSend} accessibilityLabel="Send" style={{ marginTop: 0 }} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}