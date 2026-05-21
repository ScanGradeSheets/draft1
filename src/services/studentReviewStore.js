const ROSTER_KEY = 'scangrade.classRoster.v1'
const SUBMISSIONS_KEY = 'scangrade.savedSubmissions.v1'
const MAX_SUBMISSIONS = 200
const REVIEW_CONFIDENCE_THRESHOLD = 0.86

function hasStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function parseJson(value, fallback) {
  if (!value) return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function sanitizeRosterNames(names) {
  const seen = new Set()
  const out = []
  for (const raw of names) {
    const name = String(raw || '').trim()
    if (!name) continue
    const key = name.toLocaleLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out
}

function localLoadClassRoster() {
  if (!hasStorage()) return []
  const parsed = parseJson(window.localStorage.getItem(ROSTER_KEY), [])
  return Array.isArray(parsed) ? sanitizeRosterNames(parsed) : []
}

function localSaveClassRoster(names) {
  const roster = sanitizeRosterNames(names)
  if (hasStorage()) {
    window.localStorage.setItem(ROSTER_KEY, JSON.stringify(roster))
  }
  return roster
}

function localLoadSavedSubmissions() {
  if (!hasStorage()) return []
  const parsed = parseJson(window.localStorage.getItem(SUBMISSIONS_KEY), [])
  if (!Array.isArray(parsed)) return []
  return parsed.sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')))
}

function persistLocalSubmissions(submissions) {
  const next = submissions.slice(0, MAX_SUBMISSIONS)
  if (hasStorage()) {
    window.localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(next))
  }
  return next
}

function buildSubmissionRecord({ studentName, result }) {
  const student = String(studentName || '').trim()
  if (!student) throw new Error('Student name is required.')
  if (!result || result.error) throw new Error('Only successful scan results can be saved.')

  const confidences = Array.isArray(result.confidences) ? result.confidences : []
  const avgConfidence = confidences.length
    ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
    : null
  const needsReview = !!result.needsReview || confidences.some((value) => value < REVIEW_CONFIDENCE_THRESHOLD)
  return {
    id: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    studentName: student,
    savedAt: new Date().toISOString(),
    status: needsReview ? 'review' : 'ready',
    digits: Array.isArray(result.digits) ? result.digits : [],
    confidences,
    correct: Array.isArray(result.correct) ? result.correct : null,
    questionCorrect: Array.isArray(result.questionCorrect) ? result.questionCorrect : null,
    questionCount: Number.isFinite(result.questionCount) ? result.questionCount : null,
    questionScore: Number.isFinite(result.questionScore) ? result.questionScore : null,
    avgConfidence,
    totalTime: result.totalTime ?? null,
    template_id: result.template_id ?? null,
    sheet_instance_id: result.sheet_instance_id ?? null,
    needsReview,
    reviewedAt: null
  }
}

async function apiFetchJson(path, options = {}) {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return null
  try {
    const response = await fetch(path, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    })
    if (!response.ok) return null
    if (response.status === 204) return {}
    return await response.json()
  } catch {
    return null
  }
}

export async function loadClassRoster() {
  const data = await apiFetchJson('/api/roster')
  if (data?.students && Array.isArray(data.students)) {
    return sanitizeRosterNames(data.students)
  }
  return localLoadClassRoster()
}

export async function saveClassRoster(names) {
  const roster = sanitizeRosterNames(names)
  const data = await apiFetchJson('/api/roster', {
    method: 'PUT',
    body: JSON.stringify({ students: roster })
  })
  if (data?.students && Array.isArray(data.students)) {
    return sanitizeRosterNames(data.students)
  }
  return localSaveClassRoster(roster)
}

export async function loadSavedSubmissions() {
  const data = await apiFetchJson('/api/submissions')
  if (data?.submissions && Array.isArray(data.submissions)) {
    return data.submissions
  }
  return localLoadSavedSubmissions()
}

export async function saveSubmission({ studentName, result }) {
  const record = buildSubmissionRecord({ studentName, result })
  const data = await apiFetchJson('/api/submissions', {
    method: 'POST',
    body: JSON.stringify(record)
  })
  if (data?.submission) {
    return data.submission
  }
  const submissions = localLoadSavedSubmissions()
  submissions.unshift(record)
  persistLocalSubmissions(submissions)
  return record
}

export async function updateSubmissionStatus(id, status) {
  const data = await apiFetchJson(`/api/submissions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  })
  if (data?.submissions && Array.isArray(data.submissions)) {
    return data.submissions
  }
  const submissions = localLoadSavedSubmissions()
  const next = submissions.map((submission) =>
    submission.id === id
      ? { ...submission, status, reviewedAt: status === 'done' ? new Date().toISOString() : null }
      : submission
  )
  return persistLocalSubmissions(next)
}

export async function deleteSubmission(id) {
  const data = await apiFetchJson(`/api/submissions/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  })
  if (data?.submissions && Array.isArray(data.submissions)) {
    return data.submissions
  }
  const submissions = localLoadSavedSubmissions()
  return persistLocalSubmissions(submissions.filter((submission) => submission.id !== id))
}

export async function clearSavedSubmissions() {
  const data = await apiFetchJson('/api/submissions', {
    method: 'DELETE'
  })
  if (data?.submissions && Array.isArray(data.submissions)) {
    return data.submissions
  }
  if (hasStorage()) {
    window.localStorage.removeItem(SUBMISSIONS_KEY)
  }
  return []
}
