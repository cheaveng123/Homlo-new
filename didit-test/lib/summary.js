// Turns a Didit decision (GET /v3/session/{id}/decision/ or webhook `decision`) into the small
// summary this app shows. Only text fields are copied: image/video URLs are never kept.
// Field names checked against https://docs.didit.me/openapi-25.json (SessionDecision).

export const TERMINAL_STATUSES = new Set([
  'Approved', 'Declined', 'In Review', 'Expired', 'Kyc Expired', 'Abandoned',
]);

const first = (arr) => (Array.isArray(arr) && arr.length ? arr[0] : null);

/** Whole years between an ISO date (YYYY-MM-DD) and today, in UTC. */
export function ageFromDob(dob, today = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob ?? '');
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let age = today.getUTCFullYear() - y;
  const beforeBirthday =
    today.getUTCMonth() + 1 < mo || (today.getUTCMonth() + 1 === mo && today.getUTCDate() < d);
  if (beforeBirthday) age -= 1;
  return age >= 0 && age < 150 ? age : null;
}

function isPast(isoDate, today = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(isoDate ?? '')) return false;
  return isoDate.slice(0, 10) < today.toISOString().slice(0, 10);
}

function pickWarnings(feature, list) {
  return (Array.isArray(list) ? list : []).map((w) => ({
    feature: w.feature ?? feature,
    risk: w.risk ?? null,
    level: w.log_type ?? null,
    message: w.short_description ?? w.long_description ?? null,
  }));
}

export function summarize(decision, today = new Date()) {
  const idv = first(decision.id_verifications);
  const live = first(decision.liveness_checks);
  const fm = first(decision.face_matches);
  const ip = first(decision.ip_analyses);

  const dob = idv?.date_of_birth ?? null;
  const computedAge = ageFromDob(dob, today);

  const warnings = [
    ...pickWarnings('ID_VERIFICATION', idv?.warnings),
    ...pickWarnings('LIVENESS', live?.warnings),
    ...pickWarnings('FACE_MATCH', fm?.warnings),
    ...pickWarnings('IP_ANALYSIS', ip?.warnings),
  ];

  // Local sanity checks on top of Didit's own warnings.
  if (idv?.expiration_date && isPast(idv.expiration_date, today)) {
    warnings.push({ feature: 'APP_CHECK', risk: 'DOCUMENT_EXPIRED', level: 'warning',
      message: `Document expired on ${idv.expiration_date}` });
  }
  if (computedAge != null && Number.isInteger(idv?.age) && idv.age !== computedAge) {
    warnings.push({ feature: 'APP_CHECK', risk: 'AGE_MISMATCH', level: 'information',
      message: `Didit age ${idv.age} differs from age computed from DOB (${computedAge})` });
  }

  const features = [
    ['ID verification', idv?.status],
    ['Liveness', live?.status],
    ['Face match', fm?.status],
    ['IP analysis', ip?.status],
  ].filter(([, s]) => s);

  return {
    status: decision.status ?? null,
    environment: decision.environment ?? null,
    // "Reasons" = every feature that did not come back Approved.
    reasons: features.filter(([, s]) => s !== 'Approved').map(([name, s]) => `${name}: ${s}`),
    features: Object.fromEntries(features),
    document: idv && {
      fullName: idv.full_name || [idv.first_name, idv.last_name].filter(Boolean).join(' ') || null,
      firstName: idv.first_name ?? null,
      lastName: idv.last_name ?? null,
      dateOfBirth: dob,
      documentType: idv.document_type ?? null,
      documentNumber: idv.document_number ?? null,
      expirationDate: idv.expiration_date ?? null,
      nationality: idv.nationality ?? null,
      issuingState: idv.issuing_state ?? null,
    },
    age: {
      fromDob: computedAge,
      diditAge: Number.isInteger(idv?.age) ? idv.age : null,
      isAdult: computedAge == null ? null : computedAge >= 18,
      // Selfie-based estimate; only filled when the workflow runs age estimation.
      estimatedFromSelfie: typeof live?.age_estimation === 'number' ? live.age_estimation : null,
    },
    liveness: live && { status: live.status ?? null, method: live.method ?? null, score: live.score ?? null },
    faceMatch: fm && { status: fm.status ?? null, score: fm.score ?? null },
    ipAnalysis: ip && {
      status: ip.status ?? null, country: ip.ip_country ?? null,
      vpnOrTor: ip.is_vpn_or_tor ?? null, dataCenter: ip.is_data_center ?? null,
    },
    warnings,
  };
}
