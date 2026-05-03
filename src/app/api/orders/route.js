/**
 * Dashboard Data Endpoint
 * GET /api/orders
 * 
 * Returns all orders + balance stats.
 * Uses order amounts for available balance (fast) instead of querying UB on every load.
 */

import { NextResponse } from 'next/server';
import { getAllOrders } from '@/lib/orders';
import { getListenerStatus, startListener } from '@/lib/listener';

export async function GET() {
  // Auto-restart listener if it died (e.g. after hot-reload)
  startListener();

  const allOrders = getAllOrders();
  // Strip private keys before sending to frontend
  const orders = allOrders.map(({ depositPrivateKey, ...order }) => order);

  const paidOrders = allOrders.filter(o => o.status === 'paid');
  const unspentOrders = paidOrders.filter(o => !o.spent);
  const spentOrders = paidOrders.filter(o => o.spent);
  const totalRevenue = paidOrders.reduce((sum, o) => sum + (parseFloat(o.amountPaid) || o.amount), 0);
  const availableBalance = unspentOrders.reduce((sum, o) => sum + (parseFloat(o.amountPaid) || o.amount), 0);
  const totalWithdrawn = spentOrders.reduce((sum, o) => sum + (parseFloat(o.amountPaid) || o.amount), 0);

  // Categorize funds by source
  const arcFunds = unspentOrders.filter(o => o.paidChain === 'Arc Testnet');
  const ubFunds = unspentOrders.filter(o => o.depositedToUB);
  const pendingUB = unspentOrders.filter(o => o.paidChain !== 'Arc Testnet' && !o.depositedToUB);

  const stats = {
    total: orders.length,
    paid: paidOrders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    totalRevenue,
    availableBalance,
    totalWithdrawn,
    // Fund sources
    arcBalance: arcFunds.reduce((sum, o) => sum + (parseFloat(o.amountPaid) || o.amount), 0),
    ubBalance: ubFunds.reduce((sum, o) => sum + (parseFloat(o.amountPaid) || o.amount), 0),
    pendingDeposits: pendingUB.length,
    spentCount: spentOrders.length,
  };

  const listener = getListenerStatus();

  return NextResponse.json({
    orders: orders.map(({ depositPrivateKey, ...o }) => o),
    stats,
    listener,
  });
}
