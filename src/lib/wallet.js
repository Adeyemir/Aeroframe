/**
 * Wallet Generator (ethers.js)
 * 
 * Replaces Blockradar's address generation.
 * Generates a single EVM wallet per order — the same address
 * works on Ethereum, Base, and Arbitrum (all EVM chains share address format).
 * 
 * The private key is stored with the order so the backend can later
 * sign Circle Unified Balance deposit() calls.
 */

import { ethers } from 'ethers';

/**
 * Generate a new wallet for an order.
 * Returns the address (public) and privateKey (stored server-side only).
 */
export function generateOrderWallet() {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
}

/**
 * Get an ethers.Wallet instance from a stored private key.
 * Used when we need to sign transactions (e.g., depositing into Unified Balance).
 */
export function getWalletFromPrivateKey(privateKey, rpcUrl) {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  return new ethers.Wallet(privateKey, provider);
}

/**
 * Check USDC balance at an address on a specific chain.
 * Uses the ERC-20 balanceOf() call with a 5-second timeout
 * so dead RPCs don't block the entire scan.
 */
export async function getUSDCBalance(address, rpcUrl, usdcContractAddress) {
  // Create provider with timeout to avoid hanging on dead RPCs
  const fetchReq = new ethers.FetchRequest(rpcUrl);
  fetchReq.timeout = 5000; // 5 second timeout
  const provider = new ethers.JsonRpcProvider(fetchReq, undefined, {
    staticNetwork: true, // skip network detection (avoids extra RPC call)
  });
  
  const usdcAbi = ['function balanceOf(address) view returns (uint256)'];
  const usdc = new ethers.Contract(usdcContractAddress, usdcAbi, provider);
  
  const balance = await usdc.balanceOf(address);
  // USDC has 6 decimals
  return ethers.formatUnits(balance, 6);
}
