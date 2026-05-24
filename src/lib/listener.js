/**
 * Multi-Chain USDC Listener (v3 — Circle DCW edition)
 *
 * For each pending order, polls the DCW deposit address on every supported
 * chain. When USDC is detected:
 *   - Arc Testnet:  USDC is native — leave in the DCW (or transfer directly later)
 *   - Other chains: trigger UB deposit via Circle DCW + Unified Balance Kit.
 *                   Gas is sponsored by Circle's paymaster, no native funding.
 *
 * Withdrawals are handled separately in /api/withdraw.
 */

import { getUSDCBalance } from './wallet.js';
import { depositToUB } from './circleDcw.js';
import { getAllOrders, updateOrder } from './orders.js';

const CHAIN_CONFIG = {
  'Arc_Testnet': {
    displayName: 'Arc Testnet',
    rpcUrl: process.env.RPC_ARC_TESTNET || 'https://rpc.testnet.arc.network',
    usdcAddress: process.env.USDC_ARC_TESTNET || '0x3600000000000000000000000000000000000000',
    explorerTx: 'https://testnet.arcscan.app/tx/',
    isArc: true,
  },
  'Ethereum_Sepolia': {
    displayName: 'Ethereum Sepolia',
    rpcUrl: process.env.RPC_ETH_SEPOLIA || 'https://ethereum-sepolia.publicnode.com',
    usdcAddress: process.env.USDC_ETH_SEPOLIA || '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    explorerTx: 'https://sepolia.etherscan.io/tx/',
  },
  'Base_Sepolia': {
    displayName: 'Base Sepolia',
    rpcUrl: process.env.RPC_BASE_SEPOLIA || 'https://base-sepolia-rpc.publicnode.com',
    usdcAddress: process.env.USDC_BASE_SEPOLIA || '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    explorerTx: 'https://sepolia.basescan.org/tx/',
  },
  'Arbitrum_Sepolia': {
    displayName: 'Arbitrum Sepolia',
    rpcUrl: process.env.RPC_ARB_SEPOLIA || 'https://sepolia-rollup.arbitrum.io/rpc',
    usdcAddress: process.env.USDC_ARB_SEPOLIA || '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    explorerTx: 'https://sepolia.arbiscan.io/tx/',
  },
  'Avalanche_Fuji': {
    displayName: 'Avalanche Fuji',
    rpcUrl: process.env.RPC_AVAX_FUJI || 'https://api.avax-test.network/ext/bc/C/rpc',
    usdcAddress: process.env.USDC_AVAX_FUJI || '0x5425890298aed601595a70AB815c96711a31Bc65',
    explorerTx: 'https://testnet.snowtrace.io/tx/',
  },
  'Optimism_Sepolia': {
    displayName: 'OP Sepolia',
    rpcUrl: process.env.RPC_OP_SEPOLIA || 'https://sepolia.optimism.io',
    usdcAddress: process.env.USDC_OP_SEPOLIA || '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
    explorerTx: 'https://sepolia-optimism.etherscan.io/tx/',
  },
  'Unichain_Sepolia': {
    displayName: 'Unichain Sepolia',
    rpcUrl: process.env.RPC_UNICHAIN_SEPOLIA || 'https://sepolia.unichain.org',
    usdcAddress: process.env.USDC_UNICHAIN_SEPOLIA || '0x31d0220469e10c4E71834a79b1f276d740d3768F',
    explorerTx: 'https://sepolia.uniscan.xyz/tx/',
  },
};

let listenerInterval = null;
let isScanning = false;
let lastScanTime = null;
let scanCount = 0;

/**
 * Scan all pending orders across all chains.
 */
export async function scanAllChains() {
  if (isScanning) {
    return { skipped: true };
  }

  isScanning = true;
  const results = [];

  try {
    const orders = getAllOrders().filter(o => o.status === 'pending' && o.depositAddress);

    if (orders.length === 0) {
      lastScanTime = new Date().toISOString();
      scanCount++;
      return { scanned: 0, detected: 0 };
    }

    console.log(`[Listener] Scanning ${orders.length} pending order(s) across ${Object.keys(CHAIN_CONFIG).length} chains...`);

    for (const order of orders) {
      for (const [chainId, config] of Object.entries(CHAIN_CONFIG)) {
        try {
          const balance = await getUSDCBalance(
            order.depositAddress,
            config.rpcUrl,
            config.usdcAddress
          );

          const balanceNum = parseFloat(balance);

          if (balanceNum > 0 && balanceNum >= order.amount) {
            console.log(`[Listener] Payment detected: ${balance} USDC on ${config.displayName} for order ${order.id}`);

            updateOrder(order.id, {
              status: 'paid',
              paidChain: config.displayName,
              paidChainId: chainId,
              amountPaid: balance,
              paidAt: new Date().toISOString(),
            });

            if (config.isArc) {
              // USDC on Arc is native — no CCTP/UB deposit needed. The DCW
              // holds it and the withdraw flow will move it to the merchant.
              console.log(`[Listener] Arc payment — DCW holds USDC, no UB deposit needed`);
            } else {
              // Non-Arc payment — deposit into Unified Balance via the DCW.
              // Circle's paymaster sponsors gas; the DCW doesn't need native tokens.
              try {
                const depositResult = await depositToUB(
                  order.depositAddress,
                  chainId,
                  balance,
                );

                updateOrder(order.id, {
                  depositedToUB: true,
                  depositTxHash: depositResult?.txHash || null,
                });

                console.log(`[Listener] DCW deposit to UB submitted for order ${order.id}`);
              } catch (depositErr) {
                // Payment is still valid — UB deposit will be retried via /api/withdraw
                console.warn(`[Listener] Could not auto-deposit to UB for order ${order.id}:`, depositErr.message);
              }
            }

            results.push({
              orderId: order.id,
              chain: config.displayName,
              amount: balance,
            });

            break;
          }
        } catch (err) {
          if (!err.message?.includes('timeout')) {
            console.error(`[Listener] Error checking ${config.displayName} for order ${order.id}:`, err.message);
          }
        }
      }
    }

    lastScanTime = new Date().toISOString();
    scanCount++;

    if (results.length > 0) {
      console.log(`[Listener] Scan complete: ${results.length} payment(s) detected`);
    }

    return { scanned: orders.length, detected: results.length, results };
  } finally {
    isScanning = false;
  }
}

export function startListener(intervalMs = 10000) {
  if (listenerInterval) return false;

  console.log(`[Listener] Starting multi-chain listener (every ${intervalMs / 1000}s)...`);
  console.log(`[Listener] Watching chains: ${Object.values(CHAIN_CONFIG).map(c => c.displayName).join(', ')}`);

  scanAllChains().catch(err => console.error('[Listener] Initial scan error:', err));
  listenerInterval = setInterval(() => {
    scanAllChains().catch(err => console.error('[Listener] Scan error:', err));
  }, intervalMs);

  return true;
}

export function stopListener() {
  if (listenerInterval) {
    clearInterval(listenerInterval);
    listenerInterval = null;
    return true;
  }
  return false;
}

export function getListenerStatus() {
  return {
    running: listenerInterval !== null,
    isScanning,
    lastScanTime,
    scanCount,
    chains: Object.values(CHAIN_CONFIG).map(c => c.displayName),
  };
}

export function getChainConfig() {
  return CHAIN_CONFIG;
}

export function getExplorerUrl(chainDisplayName, txHash) {
  const chain = Object.values(CHAIN_CONFIG).find(c => c.displayName === chainDisplayName);
  if (!chain || !txHash) return null;
  return `${chain.explorerTx}${txHash}`;
}
