/** View-model types. The views are presentational only: the existing screen/hook maps its data into these. */

export type PlnQzxPlan = {
  id: string;
  name: string;
  tagline: string;
  price: number; // numeric value, formatted by formatPrice
  activeJobs: number;
  postsPerMonth: number;
  popular?: boolean;
  features: { label: string; included: boolean }[];
};

/** Every string comes from the app's EXISTING translation calls. Do not add or rename translation keys. */
export type PlnQzxCopy = {
  // plans
  title: string; subtitle: string; perMonth: string; currentTag: string; popularTag: string;
  activeJobs: string; postsPerMonth: string; note: string; backLabel: string;
  ctaCurrent: string; ctaChange: (planName: string) => string;
  // confirm
  confirmTitle: (planName: string) => string; confirmSub: string;
  rowPlan: string; rowToday: string; rowRenews: string; payWith: string; payCta: (price: string) => string;
  // processing
  procTitle: string; procSub: string; procSteps: [string, string, string];
  // success
  okTitle: (planName: string) => string; okSub: string;
  rowJobs: string; rowPosts: string; rowPaid: string; rowAmount: string; okPrimary: string; okSecondary: string;
  // failure
  failTitle: string; failSub: string; failReasonTitle: string; failReasonBody: string;
  failPrimary: string; failSecondary: string;
};
