import { json, listSubmissions, requireDb } from '../../_lib/db.js'

export async function onRequestPatch(context) {
  try {
    const db = requireDb(context.env)
    const { id } = context.params
    const body = await context.request.json()
    const status = body?.status

    if (!['review', 'ready', 'done'].includes(status)) {
      return json({ error: 'Invalid status.' }, { status: 400 })
    }

    const reviewedAt = status === 'done' ? new Date().toISOString() : null
    await db
      .prepare('UPDATE submissions SET status = ?, reviewed_at = ? WHERE id = ?')
      .bind(status, reviewedAt, id)
      .run()

    return json({ submissions: await listSubmissions(context.env) })
  } catch (error) {
    return json({ error: error.message }, { status: 400 })
  }
}

export async function onRequestDelete(context) {
  try {
    const db = requireDb(context.env)
    const { id } = context.params
    await db.prepare('DELETE FROM submissions WHERE id = ?').bind(id).run()
    return json({ submissions: await listSubmissions(context.env) })
  } catch (error) {
    return json({ error: error.message }, { status: 400 })
  }
}
