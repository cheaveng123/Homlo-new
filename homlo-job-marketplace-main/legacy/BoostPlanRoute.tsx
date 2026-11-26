import React, { useEffect, useRef, useState } from "react";
import {
  LayoutAnimation,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { useLocalSearchParams, useRouter } from "@/lib/router";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { BoostHeader } from "@/components/BoostHeader";
import { BoostPlanImage } from "@/components/BoostPlanImage";
import { PlanCard } from "@/components/PlanCard";
import { PriceRange } from "@/components/PriceRange";
import {
  BOOST_PLANS,
  RECOMMENDED_INDEX,
  fmt,
  priceFor,
  useIsPro,
} from "@/lib/boostData";
import { colors, fonts } from '@/theme';

const CARD_PADDING = 18;
const CARD_GAP = 12;
const HERO_IMAGE_SIZE = 120;

export default function BoostPlanScreen() {
  const router = useRouter();
  const { jobId } = useLocalSearchParams<{ jobId?: string }>();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(RECOMMENDED_INDEX);
  // Measured, not window-derived: on web useWindowDimensions includes the
  // scrollbar, which pushed the cards and the price range past the right edge.
  const [viewportWidth, setViewportWidth] = useState(0);
  const carouselRef = useRef<ScrollView>(null);
  const carouselPositioned = useRef(false);
  const isPro = useIsPro();
  const plan = BOOST_PLANS[index];
  const amount = priceFor(plan, isPro);
  const cardWidth =
    viewportWidth > 0 ? viewportWidth - CARD_PADDING * 2 : 0;
  const cardStride = cardWidth + CARD_GAP;

  const selectPlan = (nextIndex: number) => {
    if (nextIndex === index) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIndex(nextIndex);
  };

  useEffect(() => {
    if (cardStride <= CARD_GAP) return;
    carouselRef.current?.scrollTo({
      animated: carouselPositioned.current,
      x: index * cardStride,
    });
    carouselPositioned.current = true;
  }, [cardStride, index]);

  const handleCarouselMomentum = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    if (cardStride <= CARD_GAP) return;
    const nextIndex = Math.max(
      0,
      Math.min(
        BOOST_PLANS.length - 1,
        Math.round(event.nativeEvent.contentOffset.x / cardStride),
      ),
    );
    selectPlan(nextIndex);
  };

  const handleViewportLayout = (event: LayoutChangeEvent) => {
    const measured = event.nativeEvent.layout.width;
    setViewportWidth((current) =>
      Math.abs(current - measured) < 1 ? current : measured,
    );
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={["top", "bottom"]} style={styles.root}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View onLayout={handleViewportLayout} style={styles.hero}>
            <BoostHeader step={1} />
            <View style={styles.headingRow}>
              <View style={styles.headingBlock}>
                <Text style={styles.eyebrow}>BOOST BUDGET</Text>
                <Text
                  adjustsFontSizeToFit
                  numberOfLines={1}
                  style={styles.amount}
                >
                  {fmt(amount)}
                </Text>
                <Text style={styles.meta}>
                  <Text style={styles.planName}>{plan.name}</Text> · {plan.days}{" "}
                  days ·{" "}
                  {isPro ? "Pro member price" : `Pro ${fmt(plan.proPrice)}`}
                </Text>
              </View>
              <View style={styles.heroImage}>
                <BoostPlanImage
                  height={HERO_IMAGE_SIZE}
                  index={index}
                  width={HERO_IMAGE_SIZE}
                />
              </View>
            </View>
            {viewportWidth > 0 ? (
              <PriceRange
                index={index}
                isPro={isPro}
                onChange={selectPlan}
                plans={BOOST_PLANS}
                recommendedIndex={RECOMMENDED_INDEX}
                width={viewportWidth}
              />
            ) : null}
          </View>
          <Svg
            height={22}
            preserveAspectRatio="none"
            viewBox="0 0 340 22"
            width="100%"
          >
            <Path
              d="M0 0H340V8C290 26 230 2 170 12S50 24 0 8Z"
              fill={colors.mint}
            />
          </Svg>
          <View style={styles.cards}>
            {cardWidth > 0 ? (
              <ScrollView
                ref={carouselRef}
                accessibilityLabel="Boost plan options"
                contentContainerStyle={styles.carouselContent}
                decelerationRate="fast"
                horizontal
                onMomentumScrollEnd={handleCarouselMomentum}
                scrollEventThrottle={16}
                showsHorizontalScrollIndicator={false}
                snapToAlignment="start"
                snapToInterval={cardStride}
              >
                {BOOST_PLANS.map((item, itemIndex) => (
                  <PlanCard
                    isPro={isPro}
                    key={item.id}
                    onPress={() => selectPlan(itemIndex)}
                    plan={item}
                    selected={itemIndex === index}
                    style={{
                      marginRight:
                        itemIndex === BOOST_PLANS.length - 1 ? 0 : CARD_GAP,
                      width: cardWidth,
                    }}
                  />
                ))}
              </ScrollView>
            ) : null}
          </View>
        </ScrollView>
        <Pressable
          accessibilityRole="button"
          disabled={!jobId}
          onPress={() => {
            if (!jobId) return;
            router.push({
              pathname: "/boost/payment",
              params: { jobId, planId: plan.id },
            } as never);
          }}
          style={[styles.cta, !jobId && styles.ctaDisabled]}
        >
          <Text style={styles.ctaText}>Continue · {fmt(amount)}</Text>
        </Pressable>
      </SafeAreaView>
      <View
        pointerEvents="none"
        style={[styles.statusBarBackground, { height: insets.top }]}
      />
      <StatusBar backgroundColor={colors.mint} barStyle="dark-content" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  root: { backgroundColor: colors.bg, flex: 1 },
  scrollContent: { paddingBottom: 16 },
  hero: { backgroundColor: colors.mint },
  headingRow: {
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: CARD_PADDING,
  },
  headingBlock: { flex: 1, paddingTop: 6 },
  heroImage: { flexShrink: 0, marginLeft: 12 },
  eyebrow: { color: colors.sub, fontFamily: fonts.bold, fontSize: 12 },
  amount: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 46,
    letterSpacing: -1.5,
  },
  meta: { color: "#555555", fontFamily: fonts.body, fontSize: 13 },
  planName: { color: colors.text, fontFamily: fonts.bold },
  cards: { marginTop: 8 },
  carouselContent: { paddingHorizontal: CARD_PADDING },
  statusBarBackground: {
    backgroundColor: colors.mint,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  cta: {
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: 16,
    height: 52,
    justifyContent: "center",
    marginBottom: 8,
    marginHorizontal: 18,
  },
  ctaDisabled: { opacity: 0.45 },
  ctaText: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 16 },
});
