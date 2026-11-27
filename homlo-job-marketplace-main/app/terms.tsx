import { Text, View } from "react-native";

import { LegalMarkdown } from "@/components/legal/LegalUI";
import { TrustScreen, trustStyles } from "@/components/legal/TrustScreen";
import { TERMS } from "@/lib/legal/legal-docs.generated";

/** /terms: generated from legal/terms.md (run scripts/build-legal-content.mjs after editing). */
export default function TermsScreen() {
  return (
    <TrustScreen title={TERMS.title}>
      <View style={trustStyles.pill}>
        <Text style={trustStyles.pillText}>
          Version {TERMS.version} · Effective date: {TERMS.effectiveDate}
        </Text>
      </View>
      <LegalMarkdown source={TERMS.body} />
    </TrustScreen>
  );
}
