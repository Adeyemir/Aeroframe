/**
 * Withdraw / Spend Endpoint
 * POST /api/withdraw
 * 
 * Two modes:
 * 1. DIRECT TRANSFER: If USDC is still in the deposit wallet (e.g. Arc payments
 *    where deposit() didn't burn), transfer directly to merchant.
 * 2. UB SPEND: If USDC was burned into Unified Balance, call spend() to mint
 *    on the target chain.
 */

import { NextResponse } from 'next/server';
import { getAllOrders, updateOrder } from '@/lib/orders';
import { getUnifiedBalance, spendFromUnifiedBalance } from '@/lib/circle';

const MERCHANT_ADDRESS = process.env.MERCHANT_ADDRESS;

export async function POST(request) {
  if (!MERCHANT_ADDRESS) {
    return NextResponse.json({ error: 'MERCHANT_ADDRESS not configured' }, { status: 500 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const targetChain = body.chain || 'Arc_Testnet';
    const { ethers } = await import('ethers');

    const allOrders = getAllOrders();
    // Find paid orders that haven't been withdrawn yet
    const eligibleOrders = allOrders.filter(o => o.status === 'paid' && !o.spent && o.depositPrivateKey);

    if (eligibleOrders.length === 0) {
      return NextResponse.json({
        error: 'No funds available to withdraw',
        message: 'No paid orders with available funds.',
      }, { status: 400 });
    }

    const results = [];
    let totalSpent = 0;

    const chainRpcs = {
      'Arc_Testnet': 'https://rpc.testnet.arc.network',
      'Base_Sepolia': 'https://base-sepolia-rpc.publicnode.com',
      'Ethereum_Sepolia': 'https://ethereum-sepolia.publicnode.com',
      'Arbitrum_Sepolia': 'https://sepolia-rollup.arbitrum.io/rpc',
      'Polygon_Amoy': 'https://rpc-amoy.polygon.technology',
      'Avalanche_Fuji': 'https://api.avax-test.network/ext/bc/C/rpc',
      'Optimism_Sepolia': 'https://sepolia.optimism.io',
      'Unichain_Sepolia': 'https://sepolia.unichain.org',
    };

    // USDC contract addresses (for ERC-20 balance checks on non-Arc chains)
    const usdcContracts = {
      'Base_Sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      'Ethereum_Sepolia': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      'Arbitrum_Sepolia': '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
      'Polygon_Amoy': '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
      'Avalanche_Fuji': '0x5425890298aed601595a70AB815c96711a31Bc65',
      'Optimism_Sepolia': '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
      'Unichain_Sepolia': '0x31d0220469e10c4E71834a79b1f276d740d3768F',
    };

    for (const order of eligibleOrders) {
      try {
        const paidChainKey = order.paidChain?.replace(' ', '_').replace('Testnet', 'Testnet') || '';
        // Normalize: "Arc Testnet" -> "Arc_Testnet", "Base Sepolia" -> "Base_Sepolia"
        const normalizedPaidChain = Object.keys(chainRpcs).find(k => 
          k.replace('_', ' ').toLowerCase() === (order.paidChain || '').toLowerCase()
        ) || '';

        // ─── Strategy 1: Check if USDC is still in the deposit wallet ───
        // This happens when deposit() didn't actually burn (e.g. Arc payments)
        let walletBalance = 0;

        if (normalizedPaidChain && chainRpcs[normalizedPaidChain]) {
          const rpc = chainRpcs[normalizedPaidChain];
          const fetchReq = new ethers.FetchRequest(rpc);
          fetchReq.timeout = 10000;
          const provider = new ethers.JsonRpcProvider(fetchReq, undefined, { staticNetwork: true });

          if (normalizedPaidChain === 'Arc_Testnet') {
            // On Arc, USDC is native — use getBalance
            const bal = await provider.getBalance(order.depositAddress);
            walletBalance = parseFloat(ethers.formatEther(bal));
          } else {
            // On other chains, check ERC-20 USDC balance
            const usdcAddr = usdcContracts[normalizedPaidChain];
            if (usdcAddr) {
              const erc20 = new ethers.Contract(usdcAddr, [
                'function balanceOf(address) view returns (uint256)'
              ], provider);
              const bal = await erc20.balanceOf(order.depositAddress);
              walletBalance = parseFloat(ethers.formatUnits(bal, 6));
            }
          }
        }

        // If deposit wallet still has USDC, do a DIRECT TRANSFER to merchant
        if (walletBalance > 0.01) {
          console.log(`[Withdraw] Direct transfer: ${walletBalance.toFixed(2)} USDC from deposit wallet on ${normalizedPaidChain}`);

          const rpc = chainRpcs[normalizedPaidChain];
          const fetchReq = new ethers.FetchRequest(rpc);
          fetchReq.timeout = 10000;
          const provider = new ethers.JsonRpcProvider(fetchReq, undefined, { staticNetwork: true });
          const depositWallet = new ethers.Wallet(order.depositPrivateKey, provider);

          let txHash;

          if (normalizedPaidChain === 'Arc_Testnet') {
            // On Arc: native USDC transfer — leave gas for tx fee
            const bal = await provider.getBalance(order.depositAddress);
            const gasEstimate = ethers.parseEther('0.001');
            const sendAmount = bal - gasEstimate;

            if (sendAmount > 0n) {
              const tx = await depositWallet.sendTransaction({
                to: MERCHANT_ADDRESS,
                value: sendAmount,
              });
              const receipt = await tx.wait();
              txHash = receipt.hash;
              totalSpent += parseFloat(ethers.formatEther(sendAmount));
              console.log(`[Withdraw] Sent ${ethers.formatEther(sendAmount)} USDC on Arc → ${MERCHANT_ADDRESS}`);
            }
          } else {
            // On other chains: ERC-20 transfer
            const usdcAddr = usdcContracts[normalizedPaidChain];
            const erc20 = new ethers.Contract(usdcAddr, [
              'function transfer(address to, uint256 amount) returns (bool)',
              'function balanceOf(address) view returns (uint256)',
            ], depositWallet);
            const bal = await erc20.balanceOf(order.depositAddress);
            const tx = await erc20.transfer(MERCHANT_ADDRESS, bal);
            const receipt = await tx.wait();
            txHash = receipt.hash;
            totalSpent += parseFloat(ethers.formatUnits(bal, 6));
            console.log(`[Withdraw] Sent ${ethers.formatUnits(bal, 6)} USDC on ${normalizedPaidChain} → ${MERCHANT_ADDRESS}`);
          }

          if (txHash) {
            updateOrder(order.id, {
              spent: true,
              spendTxHash: txHash,
              spendChain: normalizedPaidChain.replace('_', ' '),
            });
            results.push({
              orderId: order.id,
              status: 'success',
              method: 'direct_transfer',
              amount: walletBalance.toFixed(2),
              chain: normalizedPaidChain.replace('_', ' '),
              txHash,
            });
            continue;
          }
        }

        // ─── Strategy 2: Check Unified Balance (for cross-chain spend) ───
        const balance = await getUnifiedBalance(order.depositAddress);
        const ubAvailable = parseFloat(balance?.totalConfirmedBalance || '0');

        if (ubAvailable > 0.10) {
          const FEE_BUFFER = 0.10;
          const spendAmount = ubAvailable - FEE_BUFFER;

          // Fund deposit wallet with gas on target chain
          const gasKey = process.env.GAS_WALLET_PRIVATE_KEY;
          if (gasKey) {
            const rpc = chainRpcs[targetChain];
            if (rpc) {
              const fetchReq = new ethers.FetchRequest(rpc);
              fetchReq.timeout = 10000;
              const provider = new ethers.JsonRpcProvider(fetchReq, undefined, { staticNetwork: true });
              const depositBal = await provider.getBalance(order.depositAddress);
              if (depositBal < ethers.parseEther('0.00005')) {
                const gasWallet = new ethers.Wallet(gasKey, provider);
                const gasWalletBal = await provider.getBalance(gasWallet.address);
                // Send half of what the gas wallet has (leave some for its own tx fees)
                const sendAmount = gasWalletBal / 2n;
                if (sendAmount > 0n) {
                  const tx = await gasWallet.sendTransaction({
                    to: order.depositAddress,
                    value: sendAmount,
                  });
                  await tx.wait();
                  console.log(`[Withdraw] Gas funded on ${targetChain}: ${ethers.formatEther(sendAmount)} ETH`);
                }
              }
            }
          }

          console.log(`[Withdraw] UB Spend: ${spendAmount.toFixed(2)} USDC → ${MERCHANT_ADDRESS} on ${targetChain}`);
          const result = await spendFromUnifiedBalance(
            order.depositPrivateKey,
            spendAmount.toFixed(2),
            targetChain,
            MERCHANT_ADDRESS
          );

          updateOrder(order.id, {
            spent: true,
            spendTxHash: result.txHash || null,
            spendChain: targetChain.replace('_', ' '),
          });

          totalSpent += spendAmount;
          results.push({
            orderId: order.id,
            status: 'success',
            method: 'ub_spend',
            amount: spendAmount.toFixed(2),
            chain: targetChain.replace('_', ' '),
            txHash: result.txHash,
          });
          continue;
        }

        // No funds found anywhere
        results.push({
          orderId: order.id,
          status: 'no_balance',
          message: 'No funds found in wallet or Unified Balance',
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
