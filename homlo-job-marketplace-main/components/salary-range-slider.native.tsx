import MultiSlider from "@ptomasroos/react-native-multi-slider";
import { StyleSheet, useWindowDimensions, View } from "react-native";

export function SalaryRangeSlider({ maximum, minimum, onChange }: { minimum: number; maximum: number; onChange: (values: [number, number]) => void }) {
  const { width } = useWindowDimensions();
  return <View style={styles.wrap}><MultiSlider allowOverlap={false} containerStyle={styles.slider} enableLabel={false} markerStyle={styles.marker} max={2000} min={0} selectedStyle={styles.selectedTrack} sliderLength={Math.max(240, width - 86)} step={50} trackStyle={styles.track} values={[minimum, maximum]} onValuesChange={(values) => onChange([values[0], values[1]])} /></View>;
}

const styles = StyleSheet.create({ wrap: { alignItems: "center", marginTop: 27 }, slider: { height: 42 }, marker: { backgroundColor: "#FFFFFF", borderColor: "#08675F", borderRadius: 15, borderWidth: 4, height: 30, shadowColor: "#153E37", shadowOpacity: 0.18, shadowRadius: 4, width: 30 }, selectedTrack: { backgroundColor: "#08675F", height: 6 }, track: { backgroundColor: "#D7E5E1", height: 6 } });
