import { useCallback, useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppIcon } from "@/components/ui/AppIcon";

import { SearchScreenNew, type SuggestionNew } from "@/src/new/screens/SearchScreenNew";
import { JobLocationPicker, type PickedAddress } from "@/components/JobLocationPicker";
import { opportunityCategories } from "@/lib/category-data";
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
    () => opportunityCategories.map((category) => ({ id: category.id, label: category.title, kind: "search" })),
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
      <SearchScreenNew
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
        onPressSuggestion={(s) => handleSuggestionPress(s.label)}
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
              <AppIcon name="close" size={18} color="#0E3B2E" />
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
  screen: { flex: 1, backgroundColor: "#F6F8F7" },
  pickerScreen: { flex: 1, backgroundColor: "#F6F8F7" },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pickerTitle: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 15,
    color: "#0E3B2E",
  },
  pickerClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  pickerBody: { flex: 1, paddingHorizontal: 16 },
});