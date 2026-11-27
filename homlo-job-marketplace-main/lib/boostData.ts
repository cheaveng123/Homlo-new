import type { ImageSourcePropType } from "react-native";

import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

export type BoostPlanId = "starter" | "local" | "standard" | "urgent" | "strong" | "maximum";

export type BoostPlan = {
  id: BoostPlanId;
  name: string;
  price: number;
  proPrice: number;
  days: number;
  tag: string;
  features: string[];
  image: ImageSourcePropType;
};

// Static requires, one per plan id, so Metro can trace every asset at build
// time. Do not build these paths dynamically — that breaks release bundling.
export const BOOST_IMAGES: Record<BoostPlanId, ImageSourcePropType> = {
  starter: require("../assets/images/Starterboost.png"),
  local: require("../assets/images/Local.png"),
  standard: require("../assets/images/standard.png"),
  urgent: require("../assets/images/Urgent.png"),
  strong: require("../assets/images/strong.png"),
  maximum: require("../assets/images/Maximum.png"),
};

export const BOOST_PLANS: BoostPlan[] = [
  {
    id: "starter",
    name: "Starter",
    price: 2.99,
    proPrice: 2.49,
    days: 3,
    tag: "CHEAPEST",
    image: BOOST_IMAGES.starter,
    features: [
      "Increased job visibility",
      "More exposure in relevant searches",
      "Boosted placement compared with standard listings",
    ],
  },
  {
    id: "local",
    name: "Local",
    price: 6.99,
    proPrice: 5.99,
    days: 5,
    tag: "LOCAL",
    image: BOOST_IMAGES.local,
    features: [
      "Increased visibility to nearby candidates",
      "Improved local search placement",
      "More candidate exposure in the selected area",
    ],
  },
  {
    id: "standard",
    name: "Standard",
    price: 9.99,
    proPrice: 7.99,
    days: 7,
    tag: "RECOMMENDED",
    image: BOOST_IMAGES.standard,
    features: [
      "Priority placement in search and feeds",
      "A Boosted badge on the listing",
      "Wider candidate exposure",
      "Views and applications reporting",
    ],
  },
  {
    id: "urgent",
    name: "Urgent Hire",
    price: 14.99,
    proPrice: 11.99,
    days: 3,
    tag: "FAST RESULTS",
    image: BOOST_IMAGES.urgent,
    features: [
      "Higher visibility for a short campaign",
      "Priority exposure to relevant candidates",
      "A clear signal that the role is urgent",
      "Views and applications reporting",
    ],
  },
  {
    id: "strong",
    name: "Strong",
    price: 19.99,
    proPrice: 15.99,
    days: 7,
    tag: "HIGH IMPACT",
    image: BOOST_IMAGES.strong,
    features: [
      "Top-of-feed placement throughout the campaign",
      "Featured treatment for the listing",
      "Greater exposure to matching candidates",
      "City-wide reach",
      "Detailed performance reporting",
    ],
  },
  {
    id: "maximum",
    name: "Maximum",
    price: 39.99,
    proPrice: 31.99,
    days: 14,
    tag: "MAXIMUM REACH",
    image: BOOST_IMAGES.maximum,
    features: [
      "Maximum visibility for 14 days",
      "Featured treatment and home-feed exposure",
      "Repeated exposure to matching candidates",
      "City-wide reach",
      "Detailed performance reporting",
    ],
  },
];

export const RECOMMENDED_INDEX = 2;
export const fmt = (value: number) => `$${value.toFixed(2)}`;
export const priceFor = (plan: BoostPlan, isPro: boolean) => (isPro ? plan.proPrice : plan.price);
export const findPlan = (id?: string | null) => BOOST_PLANS.find((plan) => plan.id === id) ?? BOOST_PLANS[RECOMMENDED_INDEX];

export function useIsPro(): boolean {
  const { user } = useAuth();
  const accountQuery = trpc.homlo.account.get.useQuery(undefined, { enabled: Boolean(user) });
  const account = (accountQuery.data as { account?: { plan?: string | null; plan_status?: string | null } | null } | undefined)?.account;
  return account?.plan === "pro" && account.plan_status === "active";
}
