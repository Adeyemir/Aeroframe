/**
 * Dashboard Data Endpoint
 * GET /api/orders
 *
 * Returns all orders, stats, and the aggregated live Unified Balance across
 * every per-order Circle DCW.
 */

import { NextResponse } from 'next/server';
import { getAllOrders } from '@/lib/orders';
import { getListenerStatus, startListener } from '@/lib/listener';
import { aggregateUBBalances } from '@/lib/circleDcw';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Auto-restart listener if it died (e.g. after hot-reload)
  startListener();

  const allOrders = getAllOrders();
  // Strip any legacy private key fields before sending to the frontend.
  const orders = allOrders.map(({ depositPrivateKey, ...order }) => order);

  const paidOrders = allOrders.filter(o => o.status === 'paid');
  const unspentOrders = paidOrders.filter(o => !o.spent);
  const spentOrders = paidOrders.filter(o => o.spent);
  const totalRevenue = paidOrders.reduce((sum, o) => sum + (parseFloat(o.amountPaid) || o.amount), 0);
  const totalWithdrawn = spentOrders.reduce((sum, o) => sum + (parseFloat(o.amountPaid) || o.amount), 0);

  // Live unified-balance aggregation across the DCWs of unspent paid orders.
  // We only query addresses for orders that haven't been withdrawn yet — older,
  // already-spent orders have no UB left and would just add load.
  const liveAddresses = [...new Set(unspentOrders.map(o => o.depositAddress).filter(Boolean))];

  let unifiedBalance = { totalConfirmed: '0.00', totalPending: '0.00', byAddress: [] };
  try {
    unifiedBalance = await aggregateUBBalances(liveAddresses);
  } catch (err) {
    console.warn('[Dashboard] UB aggregation failed:', err.message);
  }

  const arcFunds = unspentOrders.filter(o => o.paidChain === 'Arc Testnet');
  const pendingUB = unspentOrders.filter(o => o.paidChain !== 'Arc Testnet' && !o.depositedToUB);

  const stats = {
    total: orders.length,
    paid: paidOrders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    totalRevenue,
    // Live numbers from Circle Gateway API:
    availableBalance: parseFloat(unifiedBalance.totalConfirmed),
    pendingBalance: parseFloat(unifiedBalance.totalPending),
    ubByAddress: unifiedBalance.byAddress,
    totalWithdrawn,
    // Order-derived breakdowns for the UI hints:
    arcBalance: arcFunds.reduce((sum, o) => sum + (parseFloat(o.amountPaid) || o.amount), 0),
    pendingDeposits: pendingUB.length,
    spentCount: spentOrders.length,
  };

  const listener = getListenerStatus();

  return NextResponse.json({
    orders,
    stats,
    listener,
  });
}
