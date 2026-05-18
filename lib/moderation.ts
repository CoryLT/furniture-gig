/**
 * Sightengine image moderation helper.
 *
 * Single function used by ALL upload paths. Returns whether an image
 * passed moderation, and if not, what the reason was.
 *
 * Models we run (strictest setting):
 *   - nudity-2.1   → sexual content, suggestive content
 *   - weapon       → guns, knives, etc.
 *   - recreational_drug → drugs, paraphernalia
 *   - gore-2.0     → blood, wounds, corpses
 *   - violence     → fights, assault, etc.
 *   - offensive-2.0 → hate symbols, gestures
 *
 * Each model = 1 operation. So one image = 6 operations from the
 * Sightengine quota.
 */

const SIGHTENGINE_URL = 'https://api.sightengine.com/1.0/check.json'

// Thresholds: a score above this counts as "this content is present"
// Sightengine returns floats from 0 to 1. We're being strict (low threshold).
const THRESHOLDS = {
  // For nudity-2.1, several sub-classes — we block if any "sexual" or
  // "suggestive" class is above this
  nudity_sexual: 0.4,
  nudity_suggestive: 0.5,
  weapon: 0.5,
  drugs: 0.5,
  gore: 0.4,
  violence: 0.5,
  offensive: 0.5,
  // Minor detection — 0.6 is a balanced default. People near 18 sit
  // around 0.5; we want to clearly flag kids while letting young adults
  // through. The Sightengine docs explicitly note ambiguity here.
  minor: 0.6,
}

export type ModerationResult =
  | { ok: true; rawScores: unknown }
  | { ok: false; reason: ModerationReason; rawScores: unknown }
  | { ok: false; reason: 'service_error'; rawScores: null; errorMessage: string }

export type ModerationReason =
  | 'nudity'
  | 'weapon'
  | 'drugs'
  | 'gore'
  | 'violence'
  | 'offensive'
  | 'minor'
  | 'service_error'

/**
 * Send an image file to Sightengine and decide whether to allow it.
 *
 * Important: if Sightengine itself errors out (network, bad key,
 * quota exhausted), we return ok: false with reason 'service_error'.
 * The caller decides whether to fail closed (block) or fail open (allow).
 * For FlipWork we fail closed — better to block a legit image than to
 * let an explicit one through.
 */
export async function moderateImage(file: File): Promise<ModerationResult> {
  const apiUser = process.env.SIGHTENGINE_API_USER
  const apiSecret = process.env.SIGHTENGINE_API_SECRET

  if (!apiUser || !apiSecret) {
    return {
      ok: false,
      reason: 'service_error',
      rawScores: null,
      errorMessage: 'Sightengine credentials not configured',
    }
  }

  const formData = new FormData()
  formData.append('media', file)
  formData.append(
    'models',
    'nudity-2.1,weapon,recreational_drug,gore-2.0,violence,offensive-2.0,face-attributes'
  )
  formData.append('api_user', apiUser)
  formData.append('api_secret', apiSecret)

  let data: Record<string, unknown>
  try {
    const res = await fetch(SIGHTENGINE_URL, {
      method: 'POST',
      body: formData,
    })
    data = (await res.json()) as Record<string, unknown>
  } catch (err) {
    return {
      ok: false,
      reason: 'service_error',
      rawScores: null,
      errorMessage: err instanceof Error ? err.message : 'Network error',
    }
  }

  if (data.status !== 'success') {
    return {
      ok: false,
      reason: 'service_error',
      rawScores: null,
      errorMessage:
        typeof data.error === 'object' && data.error !== null && 'message' in data.error
          ? String((data.error as { message: string }).message)
          : 'Sightengine returned a failure',
    }
  }

  // Evaluate scores
  const nudity = data['nudity'] as Record<string, number> | undefined
  // nudity-2.1 returns categories like 'sexual_activity', 'sexual_display',
  // 'erotica', 'sextoy', 'mildly_suggestive', etc.
  if (nudity) {
    const sexualKeys = [
      'sexual_activity',
      'sexual_display',
      'erotica',
      'very_suggestive',
      'sextoy',
    ]
    const suggestiveKeys = ['suggestive', 'mildly_suggestive']
    for (const k of sexualKeys) {
      const v = nudity[k]
      if (typeof v === 'number' && v > THRESHOLDS.nudity_sexual) {
        return { ok: false, reason: 'nudity', rawScores: data }
      }
    }
    for (const k of suggestiveKeys) {
      const v = nudity[k]
      if (typeof v === 'number' && v > THRESHOLDS.nudity_suggestive) {
        return { ok: false, reason: 'nudity', rawScores: data }
      }
    }
  }

  const weapon = data['weapon'] as Record<string, number> | number | undefined
  // 'weapon' may be a flat number or an object depending on model version
  const weaponScore =
    typeof weapon === 'number'
      ? weapon
      : weapon && typeof weapon === 'object' && 'classes' in weapon
        ? Math.max(...Object.values((weapon as { classes: Record<string, number> }).classes ?? {}))
        : weapon && typeof weapon === 'object'
          ? Math.max(...Object.values(weapon).filter((v): v is number => typeof v === 'number'))
          : 0
  if (weaponScore > THRESHOLDS.weapon) {
    return { ok: false, reason: 'weapon', rawScores: data }
  }

  const drugs = data['recreational_drug'] as
    | { prob?: number; classes?: Record<string, number> }
    | number
    | undefined
  const drugsScore =
    typeof drugs === 'number'
      ? drugs
      : drugs?.prob ??
        (drugs?.classes ? Math.max(...Object.values(drugs.classes)) : 0)
  if (drugsScore > THRESHOLDS.drugs) {
    return { ok: false, reason: 'drugs', rawScores: data }
  }

  const gore = data['gore'] as
    | { prob?: number; classes?: Record<string, number> }
    | number
    | undefined
  const goreScore =
    typeof gore === 'number'
      ? gore
      : gore?.prob ??
        (gore?.classes ? Math.max(...Object.values(gore.classes)) : 0)
  if (goreScore > THRESHOLDS.gore) {
    return { ok: false, reason: 'gore', rawScores: data }
  }

  const violence = data['violence'] as
    | { prob?: number; classes?: Record<string, number> }
    | number
    | undefined
  const violenceScore =
    typeof violence === 'number'
      ? violence
      : violence?.prob ??
        (violence?.classes ? Math.max(...Object.values(violence.classes)) : 0)
  if (violenceScore > THRESHOLDS.violence) {
    return { ok: false, reason: 'violence', rawScores: data }
  }

  const offensive = data['offensive'] as
    | { prob?: number; classes?: Record<string, number> }
    | number
    | undefined
  const offensiveScore =
    typeof offensive === 'number'
      ? offensive
      : offensive?.prob ??
        (offensive?.classes ? Math.max(...Object.values(offensive.classes)) : 0)
  if (offensiveScore > THRESHOLDS.offensive) {
    return { ok: false, reason: 'offensive', rawScores: data }
  }

  // Minor detection — check the "minor" attribute on each detected face.
  // Sightengine returns a `faces` array where each face has attributes
  // including a `minor` score from 0 to 1.
  const faces = data['faces'] as
    | Array<{ attributes?: { minor?: number } }>
    | undefined
  if (Array.isArray(faces)) {
    for (const face of faces) {
      const minorScore = face?.attributes?.minor
      if (typeof minorScore === 'number' && minorScore > THRESHOLDS.minor) {
        return { ok: false, reason: 'minor', rawScores: data }
      }
    }
  }

  return { ok: true, rawScores: data }
}

/**
 * Log a moderation check to the database for later analysis.
 * Failures here are silent — we never want logging to break uploads.
 */
export async function logModerationCheck(params: {
  supabase: {
    from: (table: string) => {
      insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>
    }
  }
  userId: string | null
  uploadSource: string
  filePath: string | null
  passed: boolean
  blockReason: string | null
  rawScores: unknown
}): Promise<void> {
  try {
    await params.supabase.from('moderation_log').insert({
      user_id: params.userId,
      upload_source: params.uploadSource,
      file_path: params.filePath,
      passed: params.passed,
      block_reason: params.blockReason,
      raw_scores: params.rawScores,
    })
  } catch {
    // Silent — logging must never break the upload flow.
  }
}
