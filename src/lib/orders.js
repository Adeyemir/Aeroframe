/**
 * Order Store (Persistent)
 * Saves orders to a local JSON file to survive server restarts.
 */

import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'orders.json');

// Initialize store from file or empty map
let orders = new Map();

function loadFromDisk() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
      orders = new Map(Object.entries(data));
      console.log(`[DB] Loaded ${orders.size} orders from disk.`);
    }
  } catch (err) {
    console.error('[DB] Failed to load orders:', err.message);
  }
}

function saveToDisk() {
  try {
    const data = Object.fromEntries(orders);
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('[DB] Failed to save orders:', err.message);
  }
}

// Initial load
loadFromDisk();

export function createOrder(input) {
  // Accept either a number (amount) or an object with fields
  const data = typeof input === 'number' ? { amount: input } : input;
  const id = data.id || `order_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  
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
  
  orders.set(id, order);
  saveToDisk();
  return order;
}

export function getOrder(id) {
  return orders.get(id);
}

export function updateOrder(id, updates) {
  const order = orders.get(id);
  if (order) {
    const updated = { ...order, ...updates };
    orders.set(id, updated);
    saveToDisk();
    return updated;
  }
  return null;
}

export function getAllOrders() {
  return Array.from(orders.values()).sort((a, b) => 
    new Date(b.createdAt) - new Date(a.createdAt)
  );
}
