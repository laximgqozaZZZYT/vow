import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    switch (req.method) {
      case 'GET':
        // デフォルトレイアウトを返す
        return res.json({ 
          sections: ['next', 'activity', 'calendar', 'statics', 'diary'] 
        })

      case 'POST':
        const { sections } = req.body
        // レイアウト設定を保存（現在は単純に返すだけ）
        return res.json({ sections })

      default:
        return res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error: any) {
    console.error('Layout API Error:', error)
    return res.status(500).json({ error: error.message })
  }
}