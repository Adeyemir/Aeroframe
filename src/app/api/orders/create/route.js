/**
 * Create Order Endpoint
 * POST /api/orders/create
 * 
 * Called when customer clicks "Pay with USDC" on a product.
 * 
 * Steps:
 * 1. Generate a unique order ID
 * 2. Create the order in our store
 * 3. Generate a wallet using ethers.js (works on all EVM chains)
 * 4. Start the multi-chain listener (if not already running)
 * 5. Return the order + deposit address to the frontend
 */

import { NextResponse } from 'next/server';
import { createOrder, updateOrder } from '@/lib/orders';
import { generateOrderWallet } from '@/lib/wallet';
import { startListener, getListenerStatus } from '@/lib/listener';

export async function POST(request) {
  try {
    const { customerName, email, deliveryAddress, item, amount } = await request.json();

    // Validate input
    if (!customerName || !item || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: customerName, item, amount' },
        { status: 400 }
      );
    }

    // 1. Generate unique order ID
    const orderId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // 2. Create order in store (status: pending)
    const order = createOrder({
      id: orderId,
      customerName,
      email,
      deliveryAddress,
      item,
      amount: parseFloat(amount),
    });

    // 3. Generate EVM wallet (same address works on Eth, Base, Arb)
    const { address, privateKey } = generateOrderWallet();

    // 4. Link the deposit address + private key to our order
    updateOrder(orderId, {
      depositAddress: address,
      depositPrivateKey: privateKey,
      blockchain: 'evm-multi',
    });

    // 5. Ensure the multi-chain listener is running
    startListener();

    // 6. Return everything the frontend needs
    // NOTE: never expose privateKey to the frontend
    return NextResponse.json({
      success: true,
      order: {
        id: orderId,
        item,
        amount: parseFloat(amount),
        depositAddress: address,
        blockchain: 'evm-multi',
        supportedChains: getListenerStatus().chains,
        status: 'pending',
      },
    });

  } catch (error) {
    console.error('Create order error:', error);
    return NextResponse.json(
      { error: 'Failed to create order', details: error.message },
      { status: 500 }
    );
  }
}
