/**
 * Order Status Endpoint
 * GET /api/orders/status?id=order_xxx
 * 
 * The checkout page polls this every 3 seconds.
 * When the multi-chain listener marks the order as "paid",
 * this endpoint returns the updated status and the
 * checkout page shows the success confirmation.
 */

import { NextResponse } from 'next/server';
import { getOrder } from '@/lib/orders';
import { getListenerStatus } from '@/lib/listener';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get('id');

  if (!orderId) {
    return NextResponse.json({ error: 'Missing order ID' }, { status: 400 });
  }

  const order = getOrder(orderId);

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: order.id,
    customerName: order.customerName,
    email: order.email,
    deliveryAddress: order.deliveryAddress,
    item: order.item,
    amount: order.amount,
    status: order.status,
    depositAddress: order.depositAddress,
    paidChain: order.paidChain,
    depositedToUB: order.depositedToUB,
    txHash: order.txHash,
    paidAt: order.paidAt,
    createdAt: order.createdAt,
    supportedChains: getListenerStatus().chains,
  });
}
