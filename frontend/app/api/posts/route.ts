/**
 * Next.js API Route - Proxy for Posts API
 * Bypass CORS by calling AWS API from server-side
 */

import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://t7jsx5rea0.execute-api.us-east-1.amazonaws.com/dev';

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization) {
      return NextResponse.json({ error: 'Missing authorization' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '20';

    console.log('[Proxy] Getting feed, limit:', limit);

    const response = await fetch(`${API_BASE_URL}/v1/posts/feed?limit=${limit}`, {
      headers: {
        'Authorization': authorization,
      },
    });

    console.log('[Proxy] Feed response:', response.status);

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization) {
      return NextResponse.json({ error: 'Missing authorization' }, { status: 401 });
    }

    const body = await request.json();

    console.log('[Proxy] Calling AWS API:', `${API_BASE_URL}/posts`);
    console.log('[Proxy] Authorization:', authorization.substring(0, 50) + '...');
    
    // Test token with a working endpoint first
    console.log('[Proxy] Testing token with /v1/cooking/history...');
    const testResponse = await fetch(`${API_BASE_URL}/v1/cooking/history`, {
      headers: { 'Authorization': authorization }
    });
    console.log('[Proxy] Test response:', testResponse.status);

    const response = await fetch(`${API_BASE_URL}/v1/posts`, {
      method: 'POST',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    console.log('[Proxy] AWS Response:', response.status, response.statusText);

    const data = await response.json();
    console.log('[Proxy] AWS Response data:', data);

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
