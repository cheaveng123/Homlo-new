/**
 * Privacy policy and Terms of service shown under Profile.
 *
 * PLACEHOLDER: these are section outlines only, not legal text. Replace every
 * `body` with Homlo's official, reviewed wording (and update `updated`) before
 * release. `isPlaceholder` drives a visible notice on the page until then.
 */
export type LegalDoc = {
  title: string;
  updated: string;
  isPlaceholder: boolean;
  sections: { heading: string; body: string }[];
};

const PENDING = 'The official wording for this section will be published here.';

export const PRIVACY_POLICY: LegalDoc = {
  title: 'Privacy policy',
  updated: 'Not yet published',
  isPlaceholder: true,
  sections: [
    { heading: 'Information we collect', body: PENDING },
    { heading: 'How we use your information', body: PENDING },
    { heading: 'Sharing with employers and workers', body: PENDING },
    { heading: 'Your choices and rights', body: PENDING },
    { heading: 'Data retention and security', body: PENDING },
    { heading: 'Contact us', body: PENDING },
  ],
};

export const TERMS_OF_SERVICE: LegalDoc = {
  title: 'Terms of service',
  updated: 'Not yet published',
  isPlaceholder: true,
  sections: [
    { heading: 'Using Homlo', body: PENDING },
    { heading: 'Accounts', body: PENDING },
    { heading: 'Posting and applying for jobs', body: PENDING },
    { heading: 'Plans, boosts and payments', body: PENDING },
    { heading: 'Ending your account', body: PENDING },
    { heading: 'Changes to these terms', body: PENDING },
  ],
};
