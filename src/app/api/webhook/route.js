/**
 * Listener Control Endpoint
 * 
 * POST /api/webhook — trigger a manual scan (replaces old Blockradar webhook)
 * GET  /api/webhook — get listener status
 * 
 * The multi-chain listener runs in the background and auto-detects payments.
 * This endpoint lets you trigger a scan manually or check status.
 */

import { NextResponse } from 'next/server';
import { scanAllChains, getListenerStatus, startListener } from '@/lib/listener';

export async function POST() {
  try {
    // Ensure listener is running
    startListener();
    
    // Trigger immediate scan
    const result = await scanAllChains();
    
    return NextResponse.json({
      success: true,
      scan: result,
      listener: getListenerStatus(),
    });
  } catch (error) {
    console.error('Manual scan error:', error);
    return NextResponse.json(
      { error: 'Scan failed', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    listener: getListenerStatus(),
    message: 'POST to this endpoint to trigger a manual scan',
  });
}
