function json(data, init = {}) {
  const headers = new Headers(init.headers || {})
  headers.set('Content-Type', 'application/json')
  return new Response(JSON.stringify(data), {
    ...init,
    headers
  })
}

function requireDb(env) {
  if (!env?.DB) {
    throw new Error('D1 binding "DB" is not configured.')
  }
  return env.DB
}

function parseJsonArray(text, fallback = []) {
  if (!text) return fallback
  try {
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

function mapSubmission(row) {
  return {
    id: row.id,
    studentName: row.student_name,
    savedAt: row.saved_at,
    status: row.status,
    digits: parseJsonArray(row.digits_json),
    confidences: parseJsonArray(row.confidences_json),
    correct: row.correct_json ? parseJsonArray(row.correct_json, null) : null,
    avgConfidence: row.avg_confidence,
    totalTime: row.total_time,
    template_id: row.template_id,
    sheet_instance_id: row.sheet_instance_id,
    needsReview: !!row.needs_review,
    reviewedAt: row.reviewed_at
  }
}

async function listSubmissions(env) {
  const db = requireDb(env)
  const { results } = await db
    .prepare(
      `SELECT
        id,
        student_name,
        saved_at,
        status,
        digits_json,
        confidences_json,
        correct_json,
        avg_confidence,
        total_time,
        template_id,
        sheet_instance_id,
        needs_review,
        reviewed_at
      FROM submissions
      ORDER BY datetime(saved_at) DESC`
    )
    .all()
  return (results || []).map(mapSubmission)
}

export { json, listSubmissions, mapSubmission, parseJsonArray, requireDb }
