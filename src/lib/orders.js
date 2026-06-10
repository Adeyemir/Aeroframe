/**
 * Order Store (Vercel KV)
 *
 * Production storage on Vercel KV (Redis-backed). All orders live under a
 * single key ("orders") so the API matches the previous file-based store
 * and call sites only need `await` added.
 */

import { kv } from '@vercel/kv';

const ORDERS_KEY = 'orders';

async function readOrders() {
  try {
    const data = await kv.get(ORDERS_KEY);
    return data || {};
  } catch (err) {
    console.error('[DB] Failed to read orders:', err.message);
    return {};
  }
}

async function writeOrders(data) {
  try {
    await kv.set(ORDERS_KEY, data);
  } catch (err) {
    console.error('[DB] Failed to save orders:', err.message);
  }
}

export async function createOrder(input) {
  const data = typeof input === 'number' ? { amount: input } : input;
  const id = data.id || `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const order = {
    id,
    customerName: data.customerName || null,
    email: data.email || null,
    deliveryAddress: data.deliveryAddress || null,
    item: data.item || null,
    amount: data.amount || 0,
    status: 'pending',
    createdAt: new Date().toISOString(),
    depositAddress: null,
    depositPrivateKey: null,
    depositedToUB: false,
    swept: false,
    sweepTxHash: null,
    sweepChain: null,
    spent: false,
    spendTxHash: null,
    spendChain: null,
    txHash: null,
    amountPaid: null,
    paidAt: null,
    paidChain: null
  };

  const orders = await readOrders();
  orders[id] = order;
  await writeOrders(orders);
  return order;
}

export async function getOrder(id) {
  const orders = await readOrders();
  return orders[id] || null;
}

export async function updateOrder(id, updates) {
  const orders = await readOrders();
  if (orders[id]) {
    orders[id] = { ...orders[id], ...updates };
    await writeOrders(orders);
    return orders[id];
  }
  return null;
}

export async function getAllOrders() {
  const orders = await readOrders();
  return Object.values(orders).sort((a, b) =>
    new Date(b.createdAt) - new Date(a.createdAt)
  );
}
