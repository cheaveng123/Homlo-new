import { useCallback, useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppIcon } from "@/components/ui/AppIcon";

import { type SuggestionNew } from "@/src/new/screens/SearchScreenNew";
import { SearchPage } from "@/components/search/SearchPage";
import { palette } from "@/src/design/tokens";
import { JobLocationPicker, type PickedAddress } from "@/components/JobLocationPicker";
import { JOB_FIELDS } from "@/lib/job-fields";
import { vistaKeyForField } from "@/components/vista/vistaCategoryData";
import { haptic } from "@/lib/haptics";
import { goBack } from "@/lib/navigation";
import { useSearchHistory } from "@/lib/search-history";

const DEFAULT_LOCATION = "Phnom Penh · Remote OK";

export default function SearchDetailRoute() {
  const router = useRouter();
  const { history, addSearch, clearHistory, removeSearch } = useSearchHistory();
  const [query, setQuery] = useState("");
  const [locationLabel, setLocationLabel] = useState(DEFAULT_LOCATION);
  const [pickerVisible, setPickerVisible] = useState(false);

  const recents = useMemo(() => history.map((item) => item.original), [history]);

  const suggestions = useMemo<SuggestionNew[]>(
    // The 19 official job fields (same list as Home and the Category pages).
    () => JOB_FIELDS.map((field) => ({ id: field.id, label: field.title, kind: "search" })),
    []
  );

  const handleBack = useCallback(() => goBack(router), [router]);

  const handleRecentPress = useCallback(
    (label: string) => {
      haptic.light();
      addSearch({ original: label, corrected: label });
      router.push({ pathname: "/search-results", params: { query: label } } as never);
    },
    [addSearch, router]
  );

  const handleRemoveRecent = useCallback(
    (label: string) => {
      const item = history.find((h) => h.original === label);
      if (!item) return;
      haptic.light();
      removeSearch(item.id);
    },
    [history, removeSearch]
  );

  const handleClearRecents = useCallback(() => {
    haptic.light();
    clearHistory();
  }, [clearHistory]);

  const handleSuggestionPress = useCallback(
    (category: string) => {
      haptic.light();
      addSearch({ original: category, corrected: category });
      router.push({ pathname: "/search-results", params: { query: category } } as never);
    },
    [addSearch, router]
  );

  const handleLocationSelect = useCallback((place: PickedAddress) => {
    const label = place.city || place.district || place.formatted;
    if (label) setLocationLabel(label);
    setPickerVisible(false);
  }, []);

  const handleSubmitSearch = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      haptic.light();
      addSearch({ original: trimmed, corrected: trimmed });
      router.push({ pathname: "/search-results", params: { query: trimmed } } as never);
    },
    [addSearch, router]
  );

  return (
    <View style={styles.screen}>
      <SearchPage
        query={query}
        onChangeQuery={setQuery}
        onSubmit={handleSubmitSearch}
        onCancel={handleBack}
        onBack={handleBack}
        locationLabel={locationLabel}
        onPressLocation={() => setPickerVisible(true)}
        recent={recents}
        onPressRecent={handleRecentPress}
        onRemoveRecent={handleRemoveRecent}
        onClearRecent={handleClearRecents}
        suggestions={suggestions}
        // A field opens its Category page, which gathers every job for the field
        // through its aliases (text search alone misses most of them).
        onPressSuggestion={(s) => {
          const key = vistaKeyForField(s.id);
          if (key) {
            haptic.light();
            router.push({ pathname: "/vista/[categoryKey]", params: { categoryKey: key } } as never);
          } else {
            handleSuggestionPress(JOB_FIELDS.find((f) => f.id === s.id)?.aliases[0] ?? s.label);
          }
        }}
        trending={[]}
        onPressTrending={() => {}}
      />

      <Modal
        animationType="slide"
        transparent={false}
        visible={pickerVisible}
        onRequestClose={() => setPickerVisible(false)}
      >
        <SafeAreaView style={styles.pickerScreen} edges={["top", "bottom"]}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Choose your search location</Text>
            <TouchableOpacity
              accessibilityLabel="Close location picker"
              onPress={() => setPickerVisible(false)}
              hitSlop={10}
              style={styles.pickerClose}
            >
              <AppIcon name="close" size={18} color={palette.navy} />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.pickerBody}
          >
            <JobLocationPicker onSelect={handleLocationSelect} />
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.page },
  pickerScreen: { flex: 1, backgroundColor: palette.page },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pickerTitle: {
    fontFamily: "PlusJakartaSans_800ExtraBold",
    fontSize: 17,
    color: palette.navy,
  },
  pickerClose: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E3E9EC",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  pickerBody: { flex: 1, paddingHorizontal: 16 },
});
