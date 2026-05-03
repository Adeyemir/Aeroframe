/**
 * Admin Auth Endpoint
 * POST /api/auth
 * 
 * Simple password-based admin authentication for the dashboard.
 * In production, replace with proper OAuth/JWT.
 */

import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { password } = await request.json();
    const adminPassword = process.env.ADMIN_PASSWORD || 'aeroframe2026';

    if (password === adminPassword) {
      // Return a simple session token (in production, use JWT)
      const token = Buffer.from(`admin:${Date.now()}`).toString('base64');
      return NextResponse.json({ success: true, token });
    }

    return NextResponse.json(
      { error: 'Invalid password' },
      { status: 401 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Auth failed' },
      { status: 500 }
    );
  }
}
