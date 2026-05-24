/**
 * USDC Balance Reader
 *
 * Used by the multi-chain listener to detect incoming USDC at a DCW deposit
 * address. Read-only — no private keys, no signing.
 *
 * Wallet generation lives in src/lib/circleDcw.js now (Circle Developer-Controlled
 * Wallets). The legacy ethers.Wallet.createRandom() flow was replaced in v3.
 */

import { ethers } from 'ethers';

/**
 * Check USDC balance at an address on a specific chain.
 * Uses the ERC-20 balanceOf() call with a 5-second timeout so dead RPCs
 * don't block the entire scan.
 */
export async function getUSDCBalance(address, rpcUrl, usdcContractAddress) {
  const fetchReq = new ethers.FetchRequest(rpcUrl);
  fetchReq.timeout = 5000;
  const provider = new ethers.JsonRpcProvider(fetchReq, undefined, {
    staticNetwork: true,
  });

  const usdcAbi = ['function balanceOf(address) view returns (uint256)'];
  const usdc = new ethers.Contract(usdcContractAddress, usdcAbi, provider);

  const balance = await usdc.balanceOf(address);
  return ethers.formatUnits(balance, 6);
}
