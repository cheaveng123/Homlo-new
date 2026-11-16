import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  useWindowDimensions,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import { AppIcon } from "@/components/ui/AppIcon";
import { DrawAreaMap, type LatLng } from '@/components/DrawAreaMap';
import { opportunityCategories } from '@/lib/category-data';
import { JOB_FIELDS, resolveJobField } from '@/lib/job-fields';
import { JobFieldArtwork } from '@/components/shared/JobFieldArtwork';
import { saveQuickSearchAnswers } from '@/lib/quick-search-store';

const JOB_TYPES = ['Part time', 'Full time', 'Weekends', 'Remote'];
const SALARY_TYPES = ['Hourly', 'Monthly', 'Yearly'] as const;

type FieldOption = {
  id: string;
  /** The official field name, e.g. "IT & Technology" — what the user reads. */
  title: string;
  svg: string | null;
  /**
   * The `categories.name` this field submits. Job search filters with an exact
   * `c.name = trim(p_category)` match (016_job_search.sql), so the official title
   * cannot be sent — the legacy title it resolves to has to be.
   *
   * Six official fields have no legacy category. They submit '' rather than a
   * non-matching name, which `/search-results` treats as falsy and skips the
   * category filter for, so picking one returns unfiltered jobs instead of none.
   */
  value: string;
};

// The official 19 fields, joined to the legacy titles that the exact-match search
// actually understands. Derived rather than hand-written so it stays correct if
// either taxonomy changes.
const FIELD_OPTIONS: FieldOption[] = JOB_FIELDS.map((field) => ({
  id: field.id,
  title: field.title,
  svg: field.svg,
  value:
    opportunityCategories.find(
      (category) => resolveJobField(category.title)?.id === field.id
    )?.title ?? '',
}));

const SALARY_BOUNDS: Record<(typeof SALARY_TYPES)[number], [number, number]> = {
  Hourly: [1, 30],
  Monthly: [100, 3000],
  Yearly: [1200, 36000],
};

export default function QuickSearchWizard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [step, setStep] = useState(0);

  const [jobType, setJobType] = useState<string | null>(null);
  const [salaryType, setSalaryType] =
    useState<(typeof SALARY_TYPES)[number]>('Monthly');
  const [salaryTypeOpen, setSalaryTypeOpen] = useState(false);
  const [maxSalary, setMaxSalary] = useState(600);
  const [fieldOpen, setFieldOpen] = useState(false);
  const [fieldFilter, setFieldFilter] = useState('');
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [locationMode, setLocationMode] = useState<'near' | 'draw' | null>(null);
  const [polygon, setPolygon] = useState<LatLng[]>([]);

  const [minBound, maxBound] = SALARY_BOUNDS[salaryType];

  const goTo = (i: number) => {
    const next = Math.max(0, Math.min(2, i));
    setStep(next);
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
  };

  const onMomentumEnd = (e: any) => {
    setStep(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const selectedField = FIELD_OPTIONS.find(
    (option) => option.id === selectedFieldId
  );

  const fieldMatches = fieldFilter.trim()
    ? FIELD_OPTIONS.filter((option) =>
        option.title.toLowerCase().includes(fieldFilter.trim().toLowerCase())
      )
    : FIELD_OPTIONS;

  const toggleFieldMenu = () => {
    setFieldOpen((open) => !open);
    setFieldFilter('');
    setSalaryTypeOpen(false);
  };

  const toggleSalaryMenu = () => {
    setSalaryTypeOpen((open) => !open);
    setFieldOpen(false);
  };

  const pickField = (id: string) => {
    setSelectedFieldId(id);
    setFieldOpen(false);
    setFieldFilter('');
  };

  const submit = () => {
    const params = {
      jobType: jobType ?? '',
      salaryType,
      minSalary: String(minBound),
      maxSalary: String(maxSalary),
      field: selectedField?.value ?? '',
      locationMode: locationMode ?? 'near',
      polygon: polygon.length ? JSON.stringify(polygon) : '',
    };
    // Persist the answers so the home button switches from the wizard to the
    // one-tap Quick Search shortcut (skips this wizard on the next visit).
    void saveQuickSearchAnswers(params);
    router.replace({
      pathname: '/search-results',
      params,
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[styles.dot, i <= step && styles.dotActive]}
            />
          ))}
        </View>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <AppIcon name="close" size={20} color="#5F7A6E" />
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        keyboardShouldPersistTaps="handled"
      >
        {/* ---------- Step 1 : job type ---------- */}
        <ScrollView style={{ width }} contentContainerStyle={styles.page}>
          <Text style={styles.stepLabel}>Question 1 of 3</Text>
          <Text style={styles.heading}>What type of job?</Text>

          <View style={styles.grid}>
            {JOB_TYPES.map((t) => {
              const active = jobType === t;
              return (
                <Pressable
                  key={t}
                  style={[styles.gridCell, active && styles.cellActive]}
                  onPress={() => setJobType(t)}
                >
                  <Text style={[styles.cellText, active && styles.cellTextActive]}>
                    {t}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            style={[styles.cta, !jobType && styles.ctaDisabled]}
            disabled={!jobType}
            onPress={() => goTo(1)}
          >
            <Text style={styles.ctaText}>Continue</Text>
          </Pressable>
        </ScrollView>

        {/* ---------- Step 2 : salary + field ---------- */}
        <ScrollView style={{ width }} contentContainerStyle={styles.page}>
          <Text style={styles.stepLabel}>Question 2 of 3</Text>
          <Text style={styles.heading}>Price range</Text>

          <View style={styles.salaryTypeRow}>
            <Pressable
              style={styles.dropdown}
              onPress={toggleSalaryMenu}
            >
              <Text style={styles.dropdownText}>{salaryType}</Text>
              <AppIcon name="chevron" size={14} color="#12271F" style={{ transform: [{ rotate: "90deg" }] }} />
            </Pressable>
            <Text style={styles.salaryTypeHint}>pay</Text>
          </View>

          {salaryTypeOpen && (
            <View style={styles.dropdownMenu}>
              {SALARY_TYPES.map((t) => (
                <Pressable
                  key={t}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSalaryType(t);
                    setMaxSalary(
                      Math.round(
                        (SALARY_BOUNDS[t][0] + SALARY_BOUNDS[t][1]) / 2
                      )
                    );
                    setSalaryTypeOpen(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{t}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.sliderLabels}>
            <Text style={styles.sliderValue}>${minBound}</Text>
            <Text style={styles.sliderValue}>${maxSalary}</Text>
          </View>
          <Slider
            style={{ width: '100%', height: 36 }}
            minimumValue={minBound}
            maximumValue={maxBound}
            step={salaryType === 'Hourly' ? 1 : 50}
            value={maxSalary}
            onValueChange={setMaxSalary}
            minimumTrackTintColor="#5DCAA5"
            maximumTrackTintColor="#E1E8E3"
            thumbTintColor="#0F3D2B"
          />

          <Text style={styles.fieldLabel}>What field are you in?</Text>
          <Text style={styles.optional}>Optional</Text>

          <Pressable style={styles.dropdown} onPress={toggleFieldMenu}>
            {selectedField ? (
              <View style={styles.fieldTriggerIcon}>
                {selectedField.svg ? (
                  <JobFieldArtwork xml={selectedField.svg} width={22} height={22} />
                ) : (
                  <AppIcon name="brief" size={15} color="#8FA69B" />
                )}
              </View>
            ) : null}
            <Text
              numberOfLines={1}
              style={[styles.dropdownText, !selectedField && styles.fieldTriggerPlaceholder]}
            >
              {selectedField ? selectedField.title : 'Any field'}
            </Text>
              <AppIcon
                name="chevron"
                size={14}
                color="#12271F"
                style={[{ transform: [{ rotate: "90deg" }] }, fieldOpen && styles.chevronOpen]}
              />
          </Pressable>

          {fieldOpen && (
            <View style={styles.fieldMenu}>
              <TextInput
                style={styles.fieldFilter}
                value={fieldFilter}
                onChangeText={setFieldFilter}
                placeholder="Filter fields"
                placeholderTextColor="#8FA69B"
                autoCorrect={false}
              />
              <ScrollView
                style={styles.fieldMenuScroll}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {fieldMatches.map((option) => {
                  const active = option.id === selectedFieldId;
                  return (
                    <Pressable
                      key={option.id}
                      style={[
                        styles.fieldMenuItem,
                        active && styles.fieldMenuItemActive,
                      ]}
                      onPress={() => pickField(option.id)}
                    >
                      <View style={styles.fieldMenuIcon}>
                        {option.svg ? (
                          <JobFieldArtwork xml={option.svg} width={30} height={30} />
                        ) : (
                          <AppIcon name="brief" size={16} color="#8FA69B" />
                        )}
                      </View>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.fieldMenuText,
                          active && styles.fieldMenuTextActive,
                        ]}
                      >
                        {option.title}
                      </Text>
                      {active && <AppIcon name="check" size={15} color="#04342C" />}
                    </Pressable>
                  );
                })}
                {fieldMatches.length === 0 && (
                  <Text style={styles.fieldMenuEmpty}>No fields match</Text>
                )}
              </ScrollView>
            </View>
          )}

          <Pressable style={styles.cta} onPress={() => goTo(2)}>
            <Text style={styles.ctaText}>Continue</Text>
          </Pressable>
        </ScrollView>

        {/* ---------- Step 3 : location ---------- */}
        <ScrollView style={{ width }} contentContainerStyle={styles.page}>
          <Text style={styles.stepLabel}>Question 3 of 3</Text>
          <Text style={styles.heading}>Where should we look?</Text>

          <Pressable
            style={[styles.row, locationMode === 'near' && styles.cellActive]}
            onPress={() => setLocationMode('near')}
          >
            <AppIcon
              name="pin"
              size={18}
              color={locationMode === 'near' ? '#04342C' : '#12271F'}
            />
            <Text
              style={[
                styles.rowText,
                locationMode === 'near' && styles.cellTextActive,
              ]}
            >
              Jobs near me
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.row,
              { marginTop: 10 },
              locationMode === 'draw' && styles.cellActive,
            ]}
            onPress={() => setLocationMode('draw')}
          >
            <AppIcon
              name="map"
              size={18}
              color={locationMode === 'draw' ? '#04342C' : '#12271F'}
            />
            <Text
              style={[
                styles.rowText,
                locationMode === 'draw' && styles.cellTextActive,
              ]}
            >
              Draw an area on the map
            </Text>
          </Pressable>

          {locationMode === 'draw' && (
            <View style={{ marginTop: 14 }}>
              <DrawAreaMap onAreaChange={setPolygon} />
            </View>
          )}

          <Pressable
            style={[styles.cta, !locationMode && styles.ctaDisabled]}
            disabled={!locationMode}
            onPress={submit}
          >
            <Text style={styles.ctaText}>Search</Text>
          </Pressable>
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
}

// Fixed pixel values are intentional — they match the approved mockup exactly.
// Do not substitute percentages, flex sizing, or a theme spacing scale.
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  dots: { flexDirection: 'row', gap: 6, flex: 1 },
  dot: { height: 4, flex: 1, borderRadius: 999, backgroundColor: '#E1E8E3' },
  dotActive: { backgroundColor: '#5DCAA5' },

  page: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 },
  stepLabel: { fontSize: 13, color: '#5F7A6E', marginBottom: 4 },
  heading: {
    fontSize: 22,
    fontWeight: '600',
    color: '#12271F',
    marginBottom: 18,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridCell: {
    width: '47%',
    height: 64,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  cellActive: { backgroundColor: '#5DCAA5', borderColor: '#5DCAA5' },
  cellText: { fontSize: 14, color: '#12271F' },
  cellTextActive: { color: '#04342C', fontWeight: '500' },

  salaryTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DCE5E0',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dropdownText: { fontSize: 13, color: '#12271F', fontWeight: '500' },
  salaryTypeHint: { fontSize: 13, color: '#5F7A6E' },
  dropdownMenu: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DCE5E0',
    overflow: 'hidden',
  },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 11 },
  dropdownItemText: { fontSize: 13, color: '#12271F' },

  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 2,
  },
  sliderValue: { fontSize: 13, fontWeight: '500', color: '#12271F' },

  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#12271F',
    marginTop: 22,
  },
  optional: { fontSize: 12, color: '#8FA69B', marginTop: 2, marginBottom: 8 },
  fieldTriggerIcon: {
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  fieldTriggerImage: { height: '100%', width: '100%' },
  fieldTriggerPlaceholder: { color: '#8FA69B' },
  chevronOpen: { transform: [{ rotate: '-90deg' }] },

  fieldMenu: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  fieldFilter: {
    height: 42,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DCE5E0',
    fontSize: 13,
    color: '#12271F',
  },
  fieldMenuScroll: { maxHeight: 260 },
  fieldMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  fieldMenuItemActive: { backgroundColor: '#EAF6EF' },
  fieldMenuIcon: {
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
  },
  fieldMenuImage: { height: '100%', width: '100%' },
  fieldMenuText: { flex: 1, fontSize: 13, color: '#12271F' },
  fieldMenuTextActive: { color: '#04342C', fontWeight: '500' },
  fieldMenuEmpty: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    color: '#8FA69B',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DCE5E0',
    borderRadius: 14,
    padding: 14,
  },
  rowText: { fontSize: 14, color: '#12271F' },

  cta: {
    marginTop: 20,
    height: 48,
    borderRadius: 999,
    backgroundColor: '#5DCAA5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.45 },
  ctaText: { fontSize: 15, fontWeight: '600', color: '#04342C' },
});