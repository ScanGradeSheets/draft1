import { json, listSubmissions, requireDb } from '../../_lib/db.js'

export async function onRequestGet(context) {
  try {
    return json({ submissions: await listSubmissions(context.env) })
  } catch (error) {
    return json({ error: error.message }, { status: 503 })
  }
}

export async function onRequestPost(context) {
  try {
    const db = requireDb(context.env)
    const body = await context.request.json()
    if (!body?.id || !body?.studentName || !body?.savedAt) {
      return json({ error: 'Missing required submission fields.' }, { status: 400 })
    }

    await db
      .prepare(
        `INSERT INTO submissions (
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        body.id,
        body.studentName,
        body.savedAt,
        body.status || 'ready',
        JSON.stringify(Array.isArray(body.digits) ? body.digits : []),
        JSON.stringify(Array.isArray(body.confidences) ? body.confidences : []),
        body.correct == null ? null : JSON.stringify(body.correct),
        body.avgConfidence ?? null,
        body.totalTime ?? null,
        body.template_id ?? null,
        body.sheet_instance_id ?? null,
        body.needsReview ? 1 : 0,
        body.reviewedAt ?? null
      )
      .run()

    return json({ submission: body }, { status: 201 })
  } catch (error) {
    return json({ error: error.message }, { status: 400 })
  }
}

export async function onRequestDelete(context) {
  try {
    const db = requireDb(context.env)
    await db.prepare('DELETE FROM submissions').run()
    return json({ submissions: [] })
  } catch (error) {
    return json({ error: error.message }, { status: 400 })
  }
}
