// Minimal smoke test for Goal dueDate updates.
// Usage: node scripts/smoke-goal-dueDate.mjs
// Requires backend running on http://localhost:4000

const BASE = process.env.API_BASE ?? 'http://localhost:4000'

async function main() {
  const goalsRes = await fetch(`${BASE}/goals`)
  const goalsText = await goalsRes.text()
  if (!goalsRes.ok) {
    throw new Error(`GET /goals failed: ${goalsRes.status}\n${goalsText}`)
  }
  const goals = JSON.parse(goalsText)
  const g = goals[0]
  if (!g) {
    console.log('No goals found. Create one in the UI first.')
    return
  }

  const dueDate = '2026-02-01'
  const patchRes = await fetch(`${BASE}/goals/${g.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dueDate }),
  })
  const patchText = await patchRes.text()
  if (!patchRes.ok) {
    throw new Error(`PATCH /goals/:id failed: ${patchRes.status}\n${patchText}`)
  }

  const updated = JSON.parse(patchText)
  if (!updated.dueDate) {
    throw new Error('Expected updated goal to have dueDate, but it was missing')
  }

  console.log('OK: updated dueDate')
  console.log({ id: updated.id, dueDate: updated.dueDate })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
