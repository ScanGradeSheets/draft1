export const TEACHER_GREEN_INK = '#126c39'
export const TEACHER_RED_INK = '#a03731'

// One shared felt-pen recipe for checks and final scores. The broad translucent
// pass supplies restrained paper bleed; the narrower passes add pressure and
// slight hand variation without turning the mark fuzzy.
export const TEACHER_GREEN_PEN_PASSES = Object.freeze([
  Object.freeze({ alpha: 0.08, widthScale: 1.72, spread: 0.22 }),
  Object.freeze({ alpha: 0.18, widthScale: 1.18, spread: 0.13 }),
  Object.freeze({ alpha: 0.64, widthScale: 0.86, spread: 0.08 }),
  Object.freeze({ alpha: 0.16, widthScale: 0.38, spread: 0.04 }),
])

export function teacherScoreRevealMaskWidth(inkWidth) {
  const width = Number(inkWidth)
  if (!Number.isFinite(width) || width <= 0) return 8
  // Cover the widest pen pass plus its seeded drift, but remain narrow enough
  // that writing one score stroke cannot reveal a neighbouring future stroke.
  return Math.max(8, width * 2.2)
}
