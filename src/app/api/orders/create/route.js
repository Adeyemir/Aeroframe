/**
 * Create Order Endpoint
 * POST /api/orders/create
 *
 * Steps:
 * 1. Generate a unique order ID
 * 2. Create the order in our store
 * 3. Provision a Circle Developer-Controlled Wallet (SCA, same address across EVM chains)
 * 4. Start the multi-chain listener (if not already running)
 * 5. Return the order + deposit address to the frontend
 *
 * The DCW receives USDC on any supported chain, then the listener triggers a
 * Unified Balance deposit. Gas is sponsored by Circle — no need to fund the
 * wallet with native tokens. No private keys live in our env.
 */

import { NextResponse } from 'next/server';
import { createOrder, updateOrder } from '@/lib/orders';
import { createDepositWallet } from '@/lib/circleDcw';
import { startListener, getListenerStatus } from '@/lib/listener';

export async function POST(request) {
  try {
    const { customerName, email, deliveryAddress, item, amount } = await request.json();

    if (!customerName || !item || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: customerName, item, amount' },
        { status: 400 }
      );
    }

    const orderId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    createOrder({
      id: orderId,
      customerName,
      email,
      deliveryAddress,
      item,
      amount: parseFloat(amount),
    });

    // Provision a fresh Circle DCW for this order. The returned address is the
    // canonical SCA address that works on every supported EVM chain.
    const { walletId, address, walletRecords } = await createDepositWallet(orderId);

    updateOrder(orderId, {
      depositAddress: address,
      circleWalletId: walletId,
      circleWalletRecords: walletRecords,
      blockchain: 'evm-multi',
    });

    startListener();

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
