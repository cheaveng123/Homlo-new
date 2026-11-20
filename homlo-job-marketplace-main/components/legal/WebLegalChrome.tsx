import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";

import { getCookieChoice, setCookieChoice } from "@/lib/cookie-consent";
import { colorsNew } from "@/src/new/theme/tokensNew";
import { LegalFooter } from "./LegalUI";

/**
 * Web only: the Terms/Privacy footer under every page, and the cookie banner.
 * Native apps show the same links in Profile, sign-up, posting and checkout.
 */
export function WebLegalChrome() {
  const pathname = usePathname();
  const router = useRouter();
  const [choice, setChoice] = useState(() => getCookieChoice());
  if (Platform.OS !== "web") return null;

  // Screens built on TrustScreen already render the footer inside their scroll view.
  const hasOwnFooter = ["/terms", "/privacy", "/appeal", "/admin", "/account/verify", "/account/settings"].includes(pathname);
  const decide = (accept: boolean) => {
    setCookieChoice({ analytics: accept, marketing: accept });
    setChoice(getCookieChoice() ?? { analytics: accept, marketing: accept, decidedAt: "" });
  };

  return (
    <>
      {!hasOwnFooter ? <LegalFooter style={styles.footer} /> : null}
      {!choice ? (
        <View accessibilityRole="alert" style={styles.banner}>
          <Text style={styles.text}>
            We use necessary cookies to keep you signed in. With your permission we would also use analytics and marketing cookies.{" "}
            <Text accessibilityRole="link" style={styles.link} onPress={() => router.push("/privacy" as never)}>
              Privacy Policy
            </Text>
          </Text>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={() => decide(false)} style={[styles.btn, styles.btnGhost]}>
              <Text style={styles.btnGhostText}>Necessary only</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => decide(true)} style={styles.btn}>
              <Text style={styles.btnText}>Accept all</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  footer: { backgroundColor: colorsNew.white, borderTopWidth: 1, borderTopColor: colorsNew.border, paddingVertical: 6 },
  banner: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    maxWidth: 720,
    alignSelf: "center",
    marginHorizontal: "auto" as never,
    backgroundColor: colorsNew.deep,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    zIndex: 1000,
  },
  text: { color: colorsNew.white, fontSize: 14, lineHeight: 20 },
  link: { color: colorsNew.tint2, textDecorationLine: "underline" },
  actions: { flexDirection: "row", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" },
  btn: { backgroundColor: colorsNew.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  btnText: { color: colorsNew.white, fontWeight: "700" },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: colorsNew.tint2 },
  btnGhostText: { color: colorsNew.white, fontWeight: "700" },
});
