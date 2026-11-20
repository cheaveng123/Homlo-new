import { Text, View } from "react-native";

import { LegalMarkdown } from "@/components/legal/LegalUI";
import { TrustScreen, trustStyles } from "@/components/legal/TrustScreen";
import { PRIVACY } from "@/lib/legal/legal-docs.generated";

/** /privacy: generated from legal/privacy.md (run scripts/build-legal-content.mjs after editing). */
export default function PrivacyScreen() {
  return (
    <TrustScreen title={PRIVACY.title}>
      <View style={trustStyles.pill}>
        <Text style={trustStyles.pillText}>
          Version {PRIVACY.version} · Effective date: {PRIVACY.effectiveDate}
        </Text>
      </View>
      <LegalMarkdown source={PRIVACY.body} />
    </TrustScreen>
  );
}
