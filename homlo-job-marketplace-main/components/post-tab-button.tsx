import { useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { usePathname, useRouter } from "expo-router";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { haptic } from "@/lib/haptics";
import { useAuth } from "@/hooks/use-auth";

export function PostTabButton() {
  const router = useRouter();
  const pathname = usePathname();
  const lockUntilRef = useRef(0);
  const { loading: authLoading } = useAuth();

  const openEmployerHub = () => {
    const now = Date.now();
    if (pathname === "/employer" || authLoading || now < lockUntilRef.current) return;
    lockUntilRef.current = now + 700;
    haptic.light();
    router.push("/employer" as never);
  };

  return (
    <View style={styles.slot} pointerEvents="box-none">
      <Pressable
        accessibilityLabel="Post a job"
        accessibilityRole="button"
        onPress={openEmployerHub}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <IconSymbol name="plus" size={27} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { alignItems: "center", flex: 1 },
  button: { alignItems: "center", backgroundColor: "#16803C", borderColor: "#FFFFFF", borderRadius: 27, borderWidth: 5, height: 54, justifyContent: "center", marginTop: -24, shadowColor: "#0F5C2B", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.18, shadowRadius: 10, width: 54 },
  pressed: { opacity: 0.86, transform: [{ scale: 0.94 }] },
});