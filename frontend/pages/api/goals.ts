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
        const { data: goals, error: getError } = await supabase
          .from('goals')
          .select('*')
          .eq('owner_type', 'user')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false })

        if (getError) throw getError
        
        // Convert snake_case to camelCase
        const formattedGoals = (goals || []).map((g: any) => ({
          id: g.id,
          name: g.name,
          details: g.details,
          dueDate: g.due_date,
          parentId: g.parent_id,
          isCompleted: g.is_completed,
          createdAt: g.created_at,
          updatedAt: g.updated_at
        }))

        return res.json(formattedGoals)

      case 'POST':
        const payload = req.body
        const now = new Date().toISOString()
        
        const { data: newGoal, error: createError } = await supabase
          .from('goals')
          .insert({
            name: payload.name,
            details: payload.details,
            due_date: payload.dueDate,
            parent_id: payload.parentId,
            owner_type: 'user',
            owner_id: user.id,
            is_completed: false,
            created_at: now,
            updated_at: now
          })
          .select()
          .single()

        if (createError) throw createError

        return res.json({
          id: newGoal.id,
          name: newGoal.name,
          details: newGoal.details,
          dueDate: newGoal.due_date,
          parentId: newGoal.parent_id,
          isCompleted: newGoal.is_completed,
          createdAt: newGoal.created_at,
          updatedAt: newGoal.updated_at
        })

      default:
        return res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error: any) {
    console.error('Goals API Error:', error)
    return res.status(500).json({ error: error.message })
  }
}