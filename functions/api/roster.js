import { json, requireDb } from '../_lib/db.js'

export async function onRequestGet(context) {
  try {
    const db = requireDb(context.env)
    const { results } = await db
      .prepare(`SELECT display_name FROM class_roster ORDER BY sort_order ASC, display_name COLLATE NOCASE ASC`)
      .all()
    return json({
      students: (results || []).map((row) => row.display_name)
    })
  } catch (error) {
    return json({ error: error.message }, { status: 503 })
  }
}

export async function onRequestPut(context) {
  try {
    const db = requireDb(context.env)
    const body = await context.request.json()
    const students = Array.isArray(body?.students)
      ? body.students.map((value) => String(value || '').trim()).filter(Boolean)
      : []

    await db.prepare('DELETE FROM class_roster').run()

    if (students.length) {
      const statements = students.map((name, index) =>
        db.prepare(
          'INSERT INTO class_roster (display_name, sort_order) VALUES (?, ?)'
        ).bind(name, index)
      )
      await db.batch(statements)
    }

    return json({ students })
  } catch (error) {
    return json({ error: error.message }, { status: 400 })
  }
}
