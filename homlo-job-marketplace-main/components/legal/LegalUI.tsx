/**
 * Small, dependency-free building blocks for the legal & trust features:
 *  - LegalMarkdown: renders the subset of Markdown used in legal/*.md
 *  - LegalFooter: Terms · Privacy links (shown on every web page)
 *  - ConsentCheckbox: an unticked, required checkbox with linked doc names
 *  - SafetyNotice: the boxed warning shown to applicants
 */
import { Fragment, type ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useRouter } from "@/lib/router";

import { colorsNew } from "@/src/new/theme/tokensNew";

// ---------------------------------------------------------------------------
// Markdown (headings, paragraphs, bullet and numbered lists, **bold**)
// ---------------------------------------------------------------------------

function inline(text: string, key: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <Text key={`${key}-${i}`} style={styles.bold}>
        {part.slice(2, -2)}
      </Text>
    ) : (
      <Fragment key={`${key}-${i}`}>{part}</Fragment>
    ),
  );
}

export function LegalMarkdown({ source }: { source: string }) {
  const blocks = source.split(/\n{2,}/);
  return (
    <View>
      {blocks.map((block, bi) => {
        const lines = block.split("\n");
        const first = lines[0];
        if (first.startsWith("### ")) return <Text key={bi} accessibilityRole="header" style={styles.h3}>{first.slice(4)}</Text>;
        if (first.startsWith("## ")) return <Text key={bi} accessibilityRole="header" style={styles.h2}>{first.slice(3)}</Text>;
        if (first.startsWith("# ")) return <Text key={bi} accessibilityRole="header" style={styles.h1}>{first.slice(2)}</Text>;
        if (lines.every((l) => /^(- |\d+\. )/.test(l))) {
          return (
            <View key={bi} style={styles.list}>
              {lines.map((line, li) => {
                const numbered = line.match(/^(\d+)\. (.*)$/);
                return (
                  <View key={li} style={styles.listItem}>
                    <Text style={styles.bullet}>{numbered ? `${numbered[1]}.` : "•"}</Text>
                    <Text style={styles.p}>{inline(numbered ? numbered[2] : line.slice(2), `${bi}-${li}`)}</Text>
                  </View>
                );
              })}
            </View>
          );
        }
        return (
          <Text key={bi} style={[styles.p, styles.para]}>
            {inline(lines.join("\n"), String(bi))}
          </Text>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Footer links
// ---------------------------------------------------------------------------

export function LegalFooter({ style }: { style?: StyleProp<ViewStyle> }) {
  const router = useRouter();
  const link = (label: string, href: string) => (
    <Text accessibilityRole="link" onPress={() => router.push(href as never)} style={styles.footerLink}>
      {label}
    </Text>
  );
  return (
    <View style={[styles.footer, style]}>
      {link("Terms of Service", "/terms")}
      <Text style={styles.footerDot}>·</Text>
      {link("Privacy Policy", "/privacy")}
      <Text style={styles.footerDot}>·</Text>
      {link("Appeal a decision", "/appeal")}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Consent checkbox (never pre-ticked; the caller owns `checked`)
// ---------------------------------------------------------------------------

export function ConsentCheckbox({
  label,
  checked,
  onChange,
  required = true,
  testID,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  required?: boolean;
  testID?: string;
}) {
  const router = useRouter();
  // "[Terms of Service]" and "[Privacy Policy]" become links; other brackets stay as typed.
  const parts = label.split(/(\[Terms of Service\]|\[Privacy Policy\])/g);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label.replace(/[[\]]/g, "")}
      onPress={() => onChange(!checked)}
      style={styles.checkRow}
    >
      <View style={[styles.box, checked && styles.boxOn]}>{checked ? <Text style={styles.tick}>✓</Text> : null}</View>
      <Text style={styles.checkText}>
        {parts.map((part, i) =>
          part === "[Terms of Service]" || part === "[Privacy Policy]" ? (
            <Text
              key={i}
              accessibilityRole="link"
              style={styles.inlineLink}
              onPress={() => router.push((part === "[Terms of Service]" ? "/terms" : "/privacy") as never)}
            >
              {part.slice(1, -1)}
            </Text>
          ) : (
            <Fragment key={i}>{part}</Fragment>
          ),
        )}
        {required ? <Text style={styles.required}> (required)</Text> : <Text style={styles.optional}> (optional)</Text>}
      </Text>
    </Pressable>
  );
}

export function SafetyNotice({ text, title = "Stay safe" }: { text: string; title?: string }) {
  return (
    <View accessibilityRole="alert" style={styles.notice}>
      <Text style={styles.noticeTitle}>{title}</Text>
      <Text style={styles.noticeText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 24, fontWeight: "800", color: colorsNew.deep, marginTop: 8, marginBottom: 12 },
  h2: { fontSize: 18, fontWeight: "700", color: colorsNew.deep, marginTop: 20, marginBottom: 8 },
  h3: { fontSize: 15, fontWeight: "700", color: colorsNew.deep, marginTop: 14, marginBottom: 6 },
  p: { flex: 1, fontSize: 15, lineHeight: 23, color: colorsNew.text },
  para: { marginBottom: 10 },
  bold: { fontWeight: "700" },
  list: { marginBottom: 10, gap: 6 },
  listItem: { flexDirection: "row", gap: 8, paddingRight: 4 },
  bullet: { width: 20, fontSize: 15, lineHeight: 23, color: colorsNew.muted },
  footer: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 6, paddingVertical: 12, paddingHorizontal: 16 },
  footerLink: { fontSize: 13, color: colorsNew.primary, textDecorationLine: "underline", ...(Platform.OS === "web" ? { cursor: "pointer" as never } : null) },
  footerDot: { fontSize: 13, color: colorsNew.muted },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 8 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colorsNew.muted, alignItems: "center", justifyContent: "center", marginTop: 1, backgroundColor: colorsNew.white },
  boxOn: { backgroundColor: colorsNew.primary, borderColor: colorsNew.primary },
  tick: { color: colorsNew.white, fontSize: 14, fontWeight: "800", lineHeight: 16 },
  checkText: { flex: 1, fontSize: 14, lineHeight: 20, color: colorsNew.text },
  inlineLink: { color: colorsNew.primary, textDecorationLine: "underline" },
  required: { color: colorsNew.muted, fontSize: 12 },
  optional: { color: colorsNew.muted, fontSize: 12 },
  notice: { borderRadius: 12, borderWidth: 1, borderColor: colorsNew.cream2, backgroundColor: colorsNew.cream, padding: 14, gap: 4 },
  noticeTitle: { fontSize: 14, fontWeight: "800", color: colorsNew.creamStrong },
  noticeText: { fontSize: 14, lineHeight: 20, color: colorsNew.creamInk },
});
