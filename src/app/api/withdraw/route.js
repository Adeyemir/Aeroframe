/**
 * Withdraw / Spend Endpoint (v3 — Circle DCW edition)
 * POST /api/withdraw
 *
 * Strategy:
 *   For each paid, unspent order:
 *     1. Read the DCW's confirmed Unified Balance
 *     2. If UB > 0:      spendFromUB → merchant address on the chosen target chain
 *        Else (Arc-held): trigger UB deposit first, then spend (best-effort)
 *
 * All signing is via Circle's DCW; gas is sponsored by Circle's paymaster.
 */

import { NextResponse } from 'next/server';
import { getAllOrders, updateOrder } from '@/lib/orders';
import { getUBBalance, spendFromUB, depositToUB } from '@/lib/circleDcw';

const MERCHANT_ADDRESS = process.env.MERCHANT_ADDRESS;
const FEE_BUFFER = 0.05; // leave a small buffer for Circle fee accounting

export async function POST(request) {
  if (!MERCHANT_ADDRESS) {
    return NextResponse.json({ error: 'MERCHANT_ADDRESS not configured' }, { status: 500 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const targetChain = body.chain || 'Arc_Testnet';

    const allOrders = getAllOrders();
    const eligibleOrders = allOrders.filter(
      o => o.status === 'paid' && !o.spent && o.depositAddress
    );

    if (eligibleOrders.length === 0) {
      return NextResponse.json({
        error: 'No funds available to withdraw',
        message: 'No paid orders with available funds.',
      }, { status: 400 });
    }

    const results = [];
    let totalSpent = 0;

    for (const order of eligibleOrders) {
      try {
        // Check the DCW's confirmed UB.
        let balance = await getUBBalance(order.depositAddress);
        let ubAvailable = parseFloat(balance?.totalConfirmedBalance || '0');

        // If the payment was on Arc, USDC sits in the DCW directly — deposit it
        // into UB first before spending. Best-effort; if it fails we surface it.
        if (ubAvailable < 0.10 && order.paidChain === 'Arc Testnet' && !order.depositedToUB) {
          try {
            await depositToUB(order.depositAddress, 'Arc_Testnet', order.amountPaid || order.amount.toString());
            updateOrder(order.id, { depositedToUB: true });
            balance = await getUBBalance(order.depositAddress);
            ubAvailable = parseFloat(balance?.totalConfirmedBalance || '0');
          } catch (depositErr) {
            console.warn(`[Withdraw] Late UB deposit failed for ${order.id}:`, depositErr.message);
          }
        }

        if (ubAvailable < 0.10) {
          results.push({
            orderId: order.id,
            status: 'no_balance',
            message: `UB balance too low (${ubAvailable.toFixed(2)} USDC). Funds may still be pending deposit (~15 min).`,
          });
          continue;
        }

        const spendAmount = (ubAvailable - FEE_BUFFER).toFixed(2);
        console.log(`[Withdraw] Spending ${spendAmount} USDC from UB(${order.depositAddress}) → ${MERCHANT_ADDRESS} on ${targetChain}`);

        const result = await spendFromUB(
          order.depositAddress,
          spendAmount,
          targetChain,
          MERCHANT_ADDRESS,
        );

        updateOrder(order.id, {
          spent: true,
          spendTxHash: result?.txHash || null,
          spendChain: targetChain.replace('_', ' '),
        });

        totalSpent += parseFloat(spendAmount);
        results.push({
          orderId: order.id,
          status: 'success',
          method: 'ub_spend',
          amount: spendAmount,
          chain: targetChain.replace('_', ' '),
          txHash: result?.txHash || null,
        });
      } catch (err) {
        console.error(`[Withdraw] Failed for order ${order.id}:`, err.message);
        results.push({
          orderId: order.id,
          status: 'error',
          error: err.message,
        });
      }
    }

    return NextResponse.json({
      success: totalSpent > 0,
      message: totalSpent > 0
        ? `Withdrew ${totalSpent.toFixed(2)} USDC`
        : 'No funds were withdrawn',
      amount: totalSpent.toFixed(2),
      chain: targetChain.replace('_', ' '),
      merchantAddress: MERCHANT_ADDRESS,
      results,
    });
  } catch (error) {
    console.error('[Withdraw] Error:', error);
    return NextResponse.json({ error: 'Withdrawal failed', details: error.message }, { status: 500 });
  }
}

export async function GET() {
  const orders = getAllOrders();
  const paidOrders = orders.filter(o => o.status === 'paid');
  const spentOrders = paidOrders.filter(o => o.spent);
  const unspentOrders = paidOrders.filter(o => !o.spent);

  let totalAvailable = 0;
  for (const order of unspentOrders) {
    totalAvailable += parseFloat(order.amountPaid || '0');
  }

  return NextResponse.json({
    merchantAddress: MERCHANT_ADDRESS || null,
    availableBalance: totalAvailable.toFixed(2),
    paidOrders: paidOrders.length,
    spentOrders: spentOrders.length,
  });
}
