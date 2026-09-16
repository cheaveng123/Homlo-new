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
import { MapPin, Map as MapIcon, ChevronDown, X } from 'lucide-react-native';
import { DrawAreaMap, type LatLng } from '@/components/DrawAreaMap';
import { opportunityCategories } from '@/lib/category-data';
import { saveQuickSearchAnswers } from '@/lib/quick-search-store';

const JOB_TYPES = ['Part time', 'Full time', 'Weekends', 'Remote'];
const SALARY_TYPES = ['Hourly', 'Monthly', 'Yearly'] as const;

// The app's real field taxonomy — the same list the job posting form uses,
// so wizard selections map onto real job records.
const FIELDS = opportunityCategories.map((category) => category.title);

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
  const [fieldQuery, setFieldQuery] = useState('');
  const [selectedField, setSelectedField] = useState<string | null>(null);
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

  const fieldMatches = fieldQuery.trim()
    ? FIELDS.filter((f) =>
        f.toLowerCase().includes(fieldQuery.trim().toLowerCase())
      ).slice(0, 4)
    : [];

  const submit = () => {
    const params = {
      jobType: jobType ?? '',
      salaryType,
      minSalary: String(minBound),
      maxSalary: String(maxSalary),
      field: selectedField ?? '',
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
          <X size={20} color="#5F7A6E" />
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
              onPress={() => setSalaryTypeOpen((o) => !o)}
            >
              <Text style={styles.dropdownText}>{salaryType}</Text>
              <ChevronDown size={14} color="#12271F" />
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

          {selectedField ? (
            <Pressable
              style={styles.selectedChip}
              onPress={() => {
                setSelectedField(null);
                setFieldQuery('');
              }}
            >
              <Text style={styles.selectedChipText}>{selectedField}</Text>
              <X size={13} color="#04342C" />
            </Pressable>
          ) : (
            <>
              <TextInput
                style={styles.input}
                value={fieldQuery}
                onChangeText={setFieldQuery}
                placeholder="Start typing, e.g. hospitality"
                placeholderTextColor="#8FA69B"
                autoCorrect={false}
              />
              <View style={styles.chipRow}>
                {fieldMatches.map((f) => (
                  <Pressable
                    key={f}
                    style={styles.chip}
                    onPress={() => {
                      setSelectedField(f);
                      setFieldQuery('');
                    }}
                  >
                    <Text style={styles.chipText}>{f}</Text>
                  </Pressable>
                ))}
              </View>
            </>
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
            <MapPin
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
            <MapIcon
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
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DCE5E0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    fontSize: 14,
    color: '#12271F',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DCE5E0',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: { fontSize: 12, color: '#12271F' },
  selectedChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EAF6EF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  selectedChipText: { fontSize: 13, color: '#04342C', fontWeight: '500' },

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