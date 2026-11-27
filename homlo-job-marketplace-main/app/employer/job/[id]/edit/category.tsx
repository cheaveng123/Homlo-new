import { useEffect, useState } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "@/lib/router";
import { AppIcon } from "@/components/ui/AppIcon";

import { ScreenContainer } from "@/components/screen-container";
import { Text } from "@/components/ui/text";
import { opportunityCategories } from "@/lib/category-data";
import { readJobEditDraft, writeJobEditDraft } from "@/lib/job-edit-draft";
import { goBack } from "@/lib/navigation";
import { haptic } from "@/lib/haptics";

/**
 * Category picker for the Edit job screen. The selection is written to the
 * edit draft (AsyncStorage) and applied when the screen regains focus.
 *
 * NOTE: the categories lookup table is not seeded (the post-job wizard always
 * saves categoryId null), so this picker only drives the session draft; the
 * actual save still persists categoryId as null like the wizard does.
 */
export default function CategoryPickerScreen() {
  const router = useRouter();
  const { id, current } = useLocalSearchParams<{ id: string; current?: string }>();
  const [selected, setSelected] = useState<string | null>(current && current.trim() ? current.trim() : null);

  useEffect(() => {
    if (!id) return;
    void readJobEditDraft(id).then((draft) => {
      if (draft?.category) setSelected(draft.category);
    });
  }, [id]);

  function choose(title: string) {
    if (!id) return;
    setSelected(title);
    void writeJobEditDraft(id, { category: title }).then(() => goBack(router));
  }

  return (
    <ScreenContainer className="flex-1" containerClassName="bg-background" edges={["top", "left", "right", "bottom"]}>
      <View className="px-4 pt-3 pb-1">
        <Text className="text-[15px] font-semibold text-foreground">Choose a category</Text>
        <Text className="text-xs text-muted mt-0.5">
          Categories are promotional labels for this session; your listing keeps its current data.
        </Text>
      </View>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 12 }}>
        {opportunityCategories.map((category) => {
          const active = selected === category.title;
          return (
            <TouchableOpacity
              key={category.id}
              onPress={() => choose(category.title)}
              className={`flex-row items-center gap-3 rounded-2xl px-3.5 py-3 mb-2 border ${
                active ? "bg-primary border-primary" : "bg-surface border-border"
              }`}
            >
              <View className="flex-1">
                <Text className={`text-sm font-semibold ${active ? "text-white" : "text-foreground"}`}>
                  {category.title}
                </Text>
                <Text className={`text-xs mt-0.5 ${active ? "text-white/80" : "text-muted"}`}>
                  {category.summary}
                </Text>
              </View>
               {active ? <AppIcon name="check" size={18} color="#FFFFFF" /> : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <TouchableOpacity
        onPress={() => {
          haptic.selection();
          goBack(router);
        }}
        className="mx-4 mb-5 py-3 rounded-2xl bg-surface border border-border items-center"
      >
        <Text className="text-sm font-semibold text-foreground">Keep current</Text>
      </TouchableOpacity>
    </ScreenContainer>
  );
}