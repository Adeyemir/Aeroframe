/**
 * Circle App Kit Integration
 * 
 * Wraps Circle's Unified Balance SDK for:
 * - deposit()       → move received USDC into unified balance pool
 * - getBalances()   → check total unified balance across all chains
 * - spend()         → withdraw/send USDC from unified balance
 * 
 * Uses @circle-fin/app-kit + @circle-fin/adapter-viem-v2
 * 
 * SDK Reference: https://docs.arc.network/app-kit/references/sdk-reference
 */

import { AppKit } from '@circle-fin/app-kit';
import { createViemAdapterFromPrivateKey } from '@circle-fin/adapter-viem-v2';

// Singleton kit instance
let kit = null;

/**
 * Get or create the AppKit instance.
 */
export function getKit() {
  if (!kit) {
    kit = new AppKit();
  }
  return kit;
}

/**
 * Create a viem adapter from a private key.
 * Used to sign deposit/spend transactions.
 */
export function createAdapter(privateKey) {
  return createViemAdapterFromPrivateKey({
    privateKey: privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`,
  });
}

/**
 * Deposit USDC into the Unified Balance pool.
 * Called after the multi-chain listener detects a payment.
 * 
 * @param {string} chain - e.g., 'Base_Sepolia', 'Ethereum_Sepolia', 'Arbitrum_Sepolia'
 * @param {string} privateKey - private key of the wallet holding the USDC
 * @param {string} amount - amount of USDC to deposit (e.g., '12.00')
 */
export async function depositToUnifiedBalance(chain, privateKey, amount) {
  const appKit = getKit();
  const adapter = createAdapter(privateKey);

  const result = await appKit.unifiedBalance.deposit({
    from: { adapter, chain },
    amount,
    token: 'USDC',
  });

  console.log(`[Circle] Deposited ${amount} USDC from ${chain} into Unified Balance`);
  console.log(`[Circle] TX: ${result.txHash}`);

  return result;
}

/**
 * Get unified balance for an address.
 * Used by the dashboard to show total balance across all chains.
 * 
 * @param {string} address - the account address to check
 */
export async function getUnifiedBalance(address) {
  if (!address) return null;

  try {
    // Direct HTTP call to Circle Gateway API — bypasses SDK caching
    const res = await fetch('https://gateway-api-testnet.circle.com/v1/balances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: 'USDC',
        sources: [{ depositor: address }],
      }),
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`Gateway API returned ${res.status}`);
    }

    const data = await res.json();
    
    // Sum up confirmed and pending across all domains
    let totalConfirmed = 0;
    let totalPending = 0;
    for (const entry of data.balances || []) {
      totalConfirmed += parseFloat(entry.balance || '0');
      totalPending += parseFloat(entry.pendingBatch || '0');
    }

    return {
      token: 'USDC',
      totalConfirmedBalance: totalConfirmed.toFixed(6),
      totalPendingBalance: totalPending.toFixed(6),
      breakdown: data.balances || [],
    };
  } catch (err) {
    console.error('[Circle] Error fetching unified balance:', err.message);
    return {
      token: 'USDC',
      totalConfirmedBalance: '0.00',
      totalPendingBalance: '0.00',
      breakdown: [],
    };
  }
}

/**
 * Spend USDC from the Unified Balance.
 * Can target any supported chain.
 * 
 * @param {string} privateKey - signer's private key
 * @param {string} amount - amount to spend
 * @param {string} toChain - destination chain (e.g., 'Arc_Testnet')
 * @param {string} recipientAddress - recipient's address
 * @param {string} sourceAccount - (optional) spend from a specific account
 */
export async function spendFromUnifiedBalance(privateKey, amount, toChain, recipientAddress, sourceAccount) {
  const appKit = getKit();
  const adapter = createAdapter(privateKey);

  const fromConfig = sourceAccount
    ? [{ adapter, sourceAccount }]
    : [{ adapter }];

  const result = await appKit.unifiedBalance.spend({
    amount,
    token: 'USDC',
    from: fromConfig,
    to: {
      adapter,
      chain: toChain,
      recipientAddress,
    },
  });

  console.log(`[Circle] Spent ${amount} USDC to ${recipientAddress} on ${toChain}`);
  return result;
}

/**
 * Get supported chains for unified balance operations.
 */
export function getSupportedChains() {
  const appKit = getKit();
  return appKit.getSupportedChains('unifiedBalance');
}
