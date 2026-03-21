/**
 * Completion validation pipeline.
 *
 * Runs a generated completion through multiple stages before it's shown as a
 * ghost-text suggestion. Stages run cheapest-first so bad completions are
 * rejected early without hitting the model again.
 *
 * Stage 1 — Structural checks  (regex / length, instant)
 * Stage 2 — Repetition check   (prevent echoing what was just typed)
 * Stage 3 — Keyword relevance  (does the completion share vocabulary with the context?)
 */

export interface ValidationResult {
  valid: boolean
  /** 0–1 quality score (higher = more relevant) */
  score: number
  stage: 'structural' | 'repetition' | 'relevance' | 'pass'
  reason?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  'a','an','the','is','are','was','were','be','been','being','have','has',
  'had','do','does','did','will','would','could','should','may','might',
  'shall','can','that','this','these','those','it','its','of','in','on',
  'at','to','for','with','by','from','up','about','into','than','then',
  'so','but','and','or','not','no','nor','my','your','his','her','we',
  'they','i','you','he','she','us','them','me','him','also','just','very',
])

function keywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w))
  )
}

// ---------------------------------------------------------------------------
// Stage 1 — Structural checks
// ---------------------------------------------------------------------------

function structuralCheck(completion: string): ValidationResult | null {
  const t = completion.trim()

  if (t.length < 3)
    return { valid: false, score: 0, stage: 'structural', reason: 'too short' }

  // Only digits / punctuation — no real words
  if (/^[\d\s.,!?;:'"()\-–—]+$/.test(t))
    return { valid: false, score: 0, stage: 'structural', reason: 'no meaningful words' }

  // Starts with closing punctuation (model glitch)
  if (/^[)}\].,!?;:]/.test(t))
    return { valid: false, score: 0, stage: 'structural', reason: 'starts with closing punctuation' }

  // Looks like a prompt leak (model echoed its system message)
  if (/you are (a|an) (helpful|assistant|AI)/i.test(t))
    return { valid: false, score: 0, stage: 'structural', reason: 'prompt leak' }

  return null
}

// ---------------------------------------------------------------------------
// Stage 2 — Repetition check
// ---------------------------------------------------------------------------

function repetitionCheck(context: string, completion: string): ValidationResult | null {
  const contextTail = context.trim().split(/\s+/).slice(-6).join(' ').toLowerCase()
  const completionLower = completion.trim().toLowerCase()

  // Completion starts with the last few words of the context
  if (contextTail.length > 12 && completionLower.startsWith(contextTail))
    return { valid: false, score: 0, stage: 'repetition', reason: 'repeats context tail' }

  // More than 60% of completion words already appear consecutively in context
  const contextWords = context.toLowerCase().split(/\s+/)
  const completionWords = completionLower.split(/\s+/)
  let matches = 0
  for (const w of completionWords) {
    if (contextWords.includes(w)) matches++
  }
  const repeatRatio = completionWords.length > 0 ? matches / completionWords.length : 0
  if (repeatRatio > 0.75 && completionWords.length >= 4)
    return { valid: false, score: repeatRatio, stage: 'repetition', reason: `high repetition (${(repeatRatio * 100).toFixed(0)}%)` }

  return null
}

// ---------------------------------------------------------------------------
// Stage 3 — Keyword relevance
// ---------------------------------------------------------------------------

function relevanceCheck(context: string, completion: string): ValidationResult {
  // Use the most recent 3 sentences as the primary relevance window
  const recentSentences = context.split(/(?<=[.!?])\s+/).slice(-3).join(' ')
  const recentKw = keywords(recentSentences)
  const fullKw = keywords(context)
  const completionKw = keywords(completion)

  if (recentKw.size === 0 || completionKw.size === 0) {
    // Not enough signal to judge — let it through with neutral score
    return { valid: true, score: 0.5, stage: 'pass', reason: 'insufficient keywords' }
  }

  let recentOverlap = 0
  let broadOverlap = 0
  for (const w of completionKw) {
    if (recentKw.has(w)) recentOverlap++
    else if (fullKw.has(w)) broadOverlap++
  }

  // Weighted score: recent context match counts more
  const score = (recentOverlap * 1.0 + broadOverlap * 0.4) / completionKw.size

  // Reject if no overlap at all AND the completion has enough words to judge
  if (score === 0 && completionKw.size >= 3) {
    return {
      valid: false,
      score: 0,
      stage: 'relevance',
      reason: `no keyword overlap with context (completion: [${[...completionKw].join(', ')}])`,
    }
  }

  return { valid: true, score: Math.min(1, score + 0.2), stage: 'pass' }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run the full validation pipeline on a candidate completion.
 *
 * @param context   Text before the cursor (used for relevance scoring)
 * @param completion Candidate completion string from the model
 */
export function validateCompletion(context: string, completion: string): ValidationResult {
  // Stage 1
  const s1 = structuralCheck(completion)
  if (s1) return s1

  // Stage 2
  const s2 = repetitionCheck(context, completion)
  if (s2) return s2

  // Stage 3
  return relevanceCheck(context, completion)
}

/**
 * Convenience: returns true only when the completion passes all stages.
 */
export function isGoodCompletion(context: string, completion: string): boolean {
  return validateCompletion(context, completion).valid
}
