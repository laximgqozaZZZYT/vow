import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    const response = await fetch(`${BACKEND_URL}/layout`, {
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { 'Authorization': authHeader })
      }
    })
    
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch layout' },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Layout API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const body = await request.json()
    
    const response = await fetch(`${BACKEND_URL}/layout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { 'Authorization': authHeader })
      },
      body: JSON.stringify(body)
    })
    
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to update layout' },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Update layout API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}