import { createElement } from "react";
import { StyleSheet, View } from "react-native";

export function SalaryRangeSlider({ maximum, minimum, onChange }: { minimum: number; maximum: number; onChange: (values: [number, number]) => void }) {
  const updateMinimum = (value: number) => onChange([Math.min(value, maximum - 50), maximum]);
  const updateMaximum = (value: number) => onChange([minimum, Math.max(value, minimum + 50)]);
  return <View style={styles.wrap}>{createElement("input", { type: "range", min: 0, max: 2000, step: 50, value: minimum, onChange: (event: React.ChangeEvent<HTMLInputElement>) => updateMinimum(Number(event.target.value)), style: { accentColor: "#14324A", height: 24, left: 0, position: "absolute", width: "100%" } })}{createElement("input", { type: "range", min: 0, max: 2000, step: 50, value: maximum, onChange: (event: React.ChangeEvent<HTMLInputElement>) => updateMaximum(Number(event.target.value)), style: { accentColor: "#14324A", height: 24, left: 0, position: "absolute", width: "100%" } })}</View>;
}
const styles = StyleSheet.create({ wrap: { height: 36, marginTop: 27, position: "relative" } });
