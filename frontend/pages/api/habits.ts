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
        const { data: habits, error: getError } = await supabase
          .from('habits')
          .select('*')
          .eq('owner_type', 'user')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false })

        if (getError) throw getError
        
        // Convert snake_case to camelCase
        const formattedHabits = (habits || []).map((h: any) => ({
          id: h.id,
          goalId: h.goal_id,
          name: h.name,
          active: h.active,
          type: h.type,
          count: h.count,
          must: h.must,
          duration: h.duration,
          reminders: h.reminders,
          dueDate: h.due_date,
          time: h.time,
          endTime: h.end_time,
          repeat: h.repeat,
          timings: h.timings,
          outdates: h.outdates,
          allDay: h.all_day,
          notes: h.notes,
          workloadUnit: h.workload_unit,
          workloadTotal: h.workload_total,
          workloadPerCount: h.workload_per_count,
          completed: h.completed,
          lastCompletedAt: h.last_completed_at,
          createdAt: h.created_at,
          updatedAt: h.updated_at
        }))

        return res.json(formattedHabits)

      case 'POST':
        const payload = req.body
        
        // goalIdが指定されていない場合、デフォルトゴールを作成または取得
        let goalId = payload.goalId
        if (!goalId) {
          goalId = await getOrCreateDefaultGoal(user.id)
        }

        const now = new Date().toISOString()
        const { data: newHabit, error: createError } = await supabase
          .from('habits')
          .insert({
            goal_id: goalId,
            name: payload.name,
            type: payload.type,
            active: true,
            count: 0,
            must: payload.must,
            duration: payload.duration,
            reminders: payload.reminders,
            due_date: payload.dueDate,
            time: payload.time,
            end_time: payload.endTime,
            repeat: payload.repeat,
            timings: payload.timings,
            all_day: payload.allDay,
            notes: payload.notes,
            workload_unit: payload.workloadUnit,
            workload_total: payload.workloadTotal,
            workload_per_count: payload.workloadPerCount || 1,
            completed: false,
            owner_type: 'user',
            owner_id: user.id,
            created_at: now,
            updated_at: now
          })
          .select()
          .single()

        if (createError) throw createError

        return res.json({
          id: newHabit.id,
          goalId: newHabit.goal_id,
          name: newHabit.name,
          active: newHabit.active,
          type: newHabit.type,
          count: newHabit.count,
          must: newHabit.must,
          duration: newHabit.duration,
          reminders: newHabit.reminders,
          dueDate: newHabit.due_date,
          time: newHabit.time,
          endTime: newHabit.end_time,
          repeat: newHabit.repeat,
          timings: newHabit.timings,
          allDay: newHabit.all_day,
          notes: newHabit.notes,
          workloadUnit: newHabit.workload_unit,
          workloadTotal: newHabit.workload_total,
          workloadPerCount: newHabit.workload_per_count,
          completed: newHabit.completed,
          lastCompletedAt: newHabit.last_completed_at,
          createdAt: newHabit.created_at,
          updatedAt: newHabit.updated_at
        })

      default:
        return res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error: any) {
    console.error('API Error:', error)
    return res.status(500).json({ error: error.message })
  }
}

async function getOrCreateDefaultGoal(userId: string): Promise<string> {
  // 既存のデフォルトゴールを検索
  const { data: existingGoals, error: searchError } = await supabase
    .from('goals')
    .select('*')
    .eq('owner_type', 'user')
    .eq('owner_id', userId)
    .eq('name', 'My Goals')
    .limit(1)

  if (searchError) throw searchError

  if (existingGoals && existingGoals.length > 0) {
    return existingGoals[0].id
  }

  // デフォルトゴールを作成
  const now = new Date().toISOString()
  const { data: newGoal, error: createError } = await supabase
    .from('goals')
    .insert({
      name: 'My Goals',
      details: 'Default goal for organizing habits',
      owner_type: 'user',
      owner_id: userId,
      is_completed: false,
      created_at: now,
      updated_at: now
    })
    .select()
    .single()

  if (createError) throw createError
  return newGoal.id
}