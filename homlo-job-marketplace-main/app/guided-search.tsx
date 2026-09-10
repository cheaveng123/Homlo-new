import { useEffect } from "react";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";

export default function GuidedSearchRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/jobs" as never);
  }, [router]);
  return <ScreenContainer className="flex-1" containerClassName="bg-background"><View style={{ flex: 1 }} /></ScreenContainer>;
}
