import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    const authHeader = req.headers.authorization
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header required' })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    switch (req.method) {
      case 'GET':
        const { data: activities, error: getError } = await supabase
          .from('activities')
          .select('*')
          .eq('owner_type', 'user')
          .eq('owner_id', user.id)
          .order('timestamp', { ascending: false })

        if (getError) throw getError
        
        // Convert snake_case to camelCase
        const formattedActivities = (activities || []).map((a: any) => ({
          id: a.id,
          kind: a.kind,
          habitId: a.habit_id,
          habitName: a.habit_name,
          timestamp: a.timestamp,
          amount: a.amount,
          prevCount: a.prev_count,
          newCount: a.new_count,
          durationSeconds: a.duration_seconds
        }))

        return res.json(formattedActivities)

      case 'POST':
        const payload = req.body
        
        const { data: newActivity, error: createError } = await supabase
          .from('activities')
          .insert({
            kind: payload.kind,
            habit_id: payload.habitId,
            habit_name: payload.habitName,
            timestamp: payload.timestamp || new Date().toISOString(),
            amount: payload.amount,
            prev_count: payload.prevCount,
            new_count: payload.newCount,
            duration_seconds: payload.durationSeconds,
            owner_type: 'user',
            owner_id: user.id
          })
          .select()
          .single()

        if (createError) throw createError

        return res.json({
          id: newActivity.id,
          kind: newActivity.kind,
          habitId: newActivity.habit_id,
          habitName: newActivity.habit_name,
          timestamp: newActivity.timestamp,
          amount: newActivity.amount,
          prevCount: newActivity.prev_count,
          newCount: newActivity.new_count,
          durationSeconds: newActivity.duration_seconds
        })

      default:
        return res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error: any) {
    console.error('Activities API Error:', error)
    return res.status(500).json({ error: error.message })
  }
}