import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const authHeader = req.headers.authorization
    if (!authHeader) {
      // ゲストユーザーとして返す
      return res.json({
        actor: {
          type: 'guest',
          id: 'guest-' + Math.random().toString(36).substr(2, 9)
        }
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      // ゲストユーザーとして返す
      return res.json({
        actor: {
          type: 'guest',
          id: 'guest-' + Math.random().toString(36).substr(2, 9)
        }
      })
    }

    return res.json({
      actor: {
        type: 'user',
        id: user.id,
        email: user.email
      }
    })
  } catch (error: any) {
    console.error('Me API Error:', error)
    return res.status(500).json({ error: error.message })
  }
}