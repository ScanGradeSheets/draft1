// A teacher-style 8 is one continuous figure-eight pen stroke. Start at the
// top, sweep down through the centre into the lower loop, return through the
// centre, then finish the upper loop. This is the ordinary handwritten motion,
// rather than two separately appearing circles.
export const TEACHER_SCORE_EIGHT_STROKES = Object.freeze([
  Object.freeze([
    [0.04, -0.43],
    [-0.16, -0.37],
    [-0.22, -0.2],
    [-0.05, -0.01],
    [0.19, 0.18],
    [0.22, 0.34],
    [0.01, 0.43],
    [-0.21, 0.34],
    [-0.22, 0.14],
    [-0.04, 0],
    [0.2, -0.18],
    [0.21, -0.35],
    [0.04, -0.43],
  ]),
])
