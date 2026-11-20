/**
 * Checkbox and notice wording, copied verbatim from Part 3 of the owner's
 * legal template. Do not reword without the owner's (lawyer's) approval.
 * "[Terms of Service]" / "[Privacy Policy]" are rendered as links by
 * <ConsentCheckbox>; "[Company name]" is an unfilled owner placeholder.
 */
export const CONSENT_WORDING = {
  signup:
    "I confirm that I am 18 years old or older and legally able to enter into this agreement. I have read and agree to the [Terms of Service] and [Privacy Policy].",
  jobPosting:
    "I confirm that I am 18 or older and authorized to hire. This job is real and accurately described, is legal in the place where the work will be done, does not charge applicants any fee, and does not discriminate unlawfully.",
  purchase:
    "I agree to the payment terms, including that boosts and subscription periods are non-refundable once started, and that subscriptions renew automatically until cancelled.",
  applicantWarning:
    "Never pay money to get a job and never share bank details or passwords. [Company name] does not employ, vet, or guarantee any employer. Report suspicious listings with the Report button.",
  marketing: "Send me job alerts and updates by email. You can unsubscribe at any time.",
} as const;
