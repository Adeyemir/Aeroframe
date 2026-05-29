/**
 * Circle Developer-Controlled Wallets + Unified Balance Integration
 *
 * Per-order DCW model:
 *   - Each order creates a fresh Circle DCW (SCA on EVM, same address across chains)
 *   - Customer sends USDC to that address on any supported chain
 *   - Listener detects deposit and triggers UB deposit through the DCW
 *   - Merchant withdraws via UB spend, also signed by the DCW
 *   - Gas is sponsored by Circle's paymaster — no native token funding needed
 *
 * Replaces the legacy HD-derived deposit wallets + gas-funding mechanism.
 */

import {
  initiateDeveloperControlledWalletsClient,
} from '@circle-fin/developer-controlled-wallets';
import { createCircleWalletsAdapter } from '@circle-fin/adapter-circle-wallets';
import { AppKit } from '@circle-fin/app-kit';

// SCA wallets derive the same address across EVM chains (CREATE2), so we
// provision on one chain and the address receives USDC on any EVM chain.
// The Circle Wallets adapter handles per-chain signing for deposits/spends.
const FACTORY_BLOCKCHAIN = 'BASE-SEPOLIA';

let dcwClient = null;
let circleAdapter = null;
let appKit = null;

function getApiKey() {
  const key = process.env.CIRCLE_API_KEY;
  if (!key) throw new Error('CIRCLE_API_KEY not configured');
  return key;
}

function getEntitySecret() {
  const secret = process.env.CIRCLE_ENTITY_SECRET;
  if (!secret) throw new Error('CIRCLE_ENTITY_SECRET not configured');
  return secret;
}

function getWalletSetId() {
  const id = process.env.CIRCLE_WALLET_SET_ID;
  if (!id) throw new Error('CIRCLE_WALLET_SET_ID not configured');
  return id;
}

/**
 * Singleton DCW client for raw wallet operations.
 */
export function getDcwClient() {
  if (!dcwClient) {
    dcwClient = initiateDeveloperControlledWalletsClient({
      apiKey: getApiKey(),
      entitySecret: getEntitySecret(),
    });
  }
  return dcwClient;
}

/**
 * Singleton AppKit adapter that signs through the Circle Wallets API.
 * Used for Unified Balance operations.
 */
export function getCircleAdapter() {
  if (!circleAdapter) {
    circleAdapter = createCircleWalletsAdapter({
      apiKey: getApiKey(),
      entitySecret: getEntitySecret(),
    });
  }
  return circleAdapter;
}

/**
 * Singleton AppKit instance.
 */
export function getAppKit() {
  if (!appKit) {
    appKit = new AppKit();
  }
  return appKit;
}

/**
 * Create a fresh DCW for an order across all supported EVM testnets.
 * Returns the canonical SCA address (same across EVM chains).
 *
 * @param {string} orderId - used as wallet metadata for traceability
 * @returns {Promise<{ walletId: string, address: string, walletRecords: object[] }>}
 */
export async function createDepositWallet(orderId) {
  const client = getDcwClient();
  const walletSetId = getWalletSetId();

  // One SCA wallet on the factory chain. Its address receives USDC on any EVM
  // chain; the adapter signs deposits/spends per-chain. metadata length must
  // match count (1), so a single metadata entry.
  const response = await client.createWallets({
    walletSetId,
    blockchains: [FACTORY_BLOCKCHAIN],
    count: 1,
    accountType: 'SCA',
    metadata: [{ name: `order:${orderId}`, refId: orderId }],
  });

  const wallets = response.data?.wallets ?? [];
  if (wallets.length === 0) {
    throw new Error('Circle createWallets returned no wallets');
  }

  const canonicalAddress = wallets[0].address;
  const primaryWalletId = wallets[0].id;

  console.log(`[CircleDcw] Created wallet for order ${orderId} at ${canonicalAddress}`);

  return {
    walletId: primaryWalletId,
    address: canonicalAddress,
    walletRecords: [{ id: wallets[0].id, blockchain: wallets[0].blockchain, address: wallets[0].address }],
  };
}

/**
 * Deposit USDC from a DCW into Unified Balance.
 * Gas is sponsored by Circle's paymaster (no native token needed in the DCW).
 *
 * @param {string} dcwAddress - the DCW address holding the USDC
 * @param {string} chain - source chain (e.g., 'Base_Sepolia')
 * @param {string} amount - USDC amount as decimal string (e.g., '12.00')
 */
export async function depositToUB(dcwAddress, chain, amount) {
  const kit = getAppKit();
  const adapter = getCircleAdapter();

  const result = await kit.unifiedBalance.deposit({
    from: { adapter, chain, address: dcwAddress },
    amount,
    token: 'USDC',
  });

  console.log(`[CircleDcw] Deposited ${amount} USDC from ${chain} (${dcwAddress}) into UB`);
  return result;
}

/**
 * Spend USDC from a DCW's Unified Balance to any address on any supported chain.
 * Gas sponsored.
 *
 * @param {string} dcwAddress - the DCW whose UB is being spent
 * @param {string} amount - USDC amount as decimal string
 * @param {string} toChain - destination chain (e.g., 'Arc_Testnet')
 * @param {string} recipient - recipient address on toChain
 */
export async function spendFromUB(dcwAddress, amount, toChain, recipient) {
  const kit = getAppKit();
  const adapter = getCircleAdapter();

  const result = await kit.unifiedBalance.spend({
    amount,
    token: 'USDC',
    from: [{ adapter, address: dcwAddress }],
    to: { adapter, chain: toChain, recipientAddress: recipient },
  });

  console.log(`[CircleDcw] Spent ${amount} USDC from UB(${dcwAddress}) to ${recipient} on ${toChain}`);
  return result;
}

/**
 * Get unified balance for a DCW address by querying the Gateway API directly.
 * Bypasses SDK caching for fresh reads.
 */
export async function getUBBalance(dcwAddress) {
  if (!dcwAddress) return null;

  try {
    const res = await fetch('https://gateway-api-testnet.circle.com/v1/balances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: 'USDC',
        sources: [{ depositor: dcwAddress }],
      }),
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`Gateway API returned ${res.status}`);
    }

    const data = await res.json();

    let totalConfirmed = 0;
    let totalPending = 0;
    for (const entry of data.balances || []) {
      totalConfirmed += parseFloat(entry.balance || '0');
      totalPending += parseFloat(entry.pendingBatch || '0');
    }

    return {
      address: dcwAddress,
      token: 'USDC',
      totalConfirmedBalance: totalConfirmed.toFixed(6),
      totalPendingBalance: totalPending.toFixed(6),
      breakdown: data.balances || [],
    };
  } catch (err) {
    console.error(`[CircleDcw] Error fetching UB for ${dcwAddress}:`, err.message);
    return {
      address: dcwAddress,
      token: 'USDC',
      totalConfirmedBalance: '0.00',
      totalPendingBalance: '0.00',
      breakdown: [],
    };
  }
}

/**
 * Aggregate UB balances across many DCW addresses.
 * Used by the merchant dashboard to show total across all per-order DCWs.
 *
 * @param {string[]} addresses
 * @returns {Promise<{ totalConfirmed: string, totalPending: string, byAddress: object[] }>}
 */
export async function aggregateUBBalances(addresses) {
  if (!addresses || addresses.length === 0) {
    return { totalConfirmed: '0.00', totalPending: '0.00', byAddress: [] };
  }

  const results = await Promise.all(addresses.map(addr => getUBBalance(addr)));

  let totalConfirmed = 0;
  let totalPending = 0;
  for (const r of results) {
    if (r) {
      totalConfirmed += parseFloat(r.totalConfirmedBalance || '0');
      totalPending += parseFloat(r.totalPendingBalance || '0');
    }
  }

  return {
    totalConfirmed: totalConfirmed.toFixed(6),
    totalPending: totalPending.toFixed(6),
    byAddress: results,
  };
}
