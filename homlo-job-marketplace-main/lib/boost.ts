export const BOOST_STATE_KEY = "homlo.boosts";

export const BOOST_INTRO_SEEN_KEY = "homlo.boostIntroSeen";

export type BoostPlanId = "starter" | "local" | "standard" | "urgent" | "strong" | "maximum";

export type BoostPlan = {
  id: BoostPlanId;
  name: string;
  price: number;
  proPrice: number;
  duration: string;
  uploads: number;
  badge?: string;
  benefits: string[];
};

export const boostPlans: BoostPlan[] = [
  { id: "starter", name: "Starter", price: 2.99, proPrice: 2.49, duration: "3 days", uploads: 1, benefits: ["Increased job visibility", "More exposure in relevant searches", "Boosted placement compared with standard listings"] },
  { id: "local", name: "Local", price: 6.99, proPrice: 5.99, duration: "5 days", uploads: 1, benefits: ["Increased visibility to nearby candidates", "Improved local search placement", "More candidate exposure in the selected area"] },
  { id: "standard", name: "Standard", price: 9.99, proPrice: 7.99, duration: "7 days", uploads: 1, badge: "Recommended", benefits: ["Increased visibility", "Better search placement", "More candidate exposure", "Featured boost treatment", "Improved placement among relevant opportunities"] },
  { id: "urgent", name: "Urgent Hire", price: 14.99, proPrice: 11.99, duration: "3 days", uploads: 1, benefits: ["Higher visibility for a short period", "Priority exposure", "Designed for jobs that need applicants quickly"] },
  { id: "strong", name: "Strong", price: 19.99, proPrice: 15.99, duration: "7 days", uploads: 1, benefits: ["High visibility", "Stronger search placement", "Greater candidate exposure", "Designed for competitive job categories"] },
  { id: "maximum", name: "Maximum", price: 39.99, proPrice: 31.99, duration: "14 days", uploads: 1, benefits: ["Maximum campaign visibility", "Highest boost level", "Extended 14-day promotion", "Maximum candidate exposure available through the standard boost system"] },
];

export type BoostActivation = {
  jobId: string;
  planId: BoostPlanId;
  paymentMethod: "card" | "aba";
  activatedAt: string;
};

export function getBoostPlan(planId: BoostPlanId | undefined) {
  return boostPlans.find((plan) => plan.id === planId) ?? boostPlans[2];
}
