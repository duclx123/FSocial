/**
 * Next.js API Route - Proxy for Post Reactions API
 * Bypass CORS by calling AWS API from server-side
 */

import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://t7jsx5rea0.execute-api.us-east-1.amazonaws.com/dev';

export async function POST(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization) {
      return NextResponse.json({ error: 'Missing authorization' }, { status: 401 });
    }

    const body = await request.json();
    const { postId } = params;

    const response = await fetch(`${API_BASE_URL}/v1/reactions`, {
      method: 'POST',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...body,
        target_id: postId,
        target_type: 'post',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[Proxy] Reaction error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
