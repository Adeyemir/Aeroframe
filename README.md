# AEROFRAME

A stablecoin-powered e-commerce storefront with cross-chain USDC checkout. Each order gets a fresh Circle Developer-Controlled Wallet (gasless via paymaster), customers pay with USDC from any supported EVM chain, payments deposit into Unified Balance automatically, and the merchant withdraws to any chain. Built with Next.js 14 and the full Circle stack (DCW + Unified Balance Kit + Gateway).

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![USDC](https://img.shields.io/badge/USDC-7%20chains-2775CA)
![Circle](https://img.shields.io/badge/Powered%20by-Circle%20Unified%20Balance-111111)

## How It Works

```
Customer clicks "Pay with USDC"
        │
        ▼
Modal collects name, email, delivery address
        │
        ▼
Backend creates order + provisions a fresh Circle DCW (SCA, same address across EVM chains)
        │
        ▼
Checkout page shows QR + address, polls for payment status every 3s
        │
        ▼
Customer sends USDC from ANY supported chain (Arc, Ethereum, Base, Arbitrum, Avalanche, OP, Unichain)
        │
        ▼
Multi-chain listener detects the payment, identifies the source chain
        │
        ▼
Arc payments  → DCW holds USDC natively (no CCTP needed)
Other chains  → DCW deposits into Unified Balance (Circle paymaster sponsors gas)
        │
        ▼
Order marked PAID, customer sees receipt
        │
        ▼
Merchant dashboard reads live Unified Balance aggregated across every per-order DCW
Merchant withdraws to any supported chain → DCW spends from UB (gas sponsored)
```

**Zero ETH required.** Customers don't need native gas tokens beyond what their source chain requires for the inbound transfer. The store never funds anything with ETH/MATIC/AVAX — Circle's paymaster handles every signing operation.

## Features

- **Single-Address Cross-Chain Checkout** — one EVM address accepts USDC from 7 chains
- **Multi-Chain Payment Listener** — polls all supported chains every 10s for incoming USDC
- **Hybrid Settlement** — Arc payments stay native (instant); non-Arc payments auto-deposit to Unified Balance via CCTP
- **Unified Balance Dashboard** — merchant sees one total balance across all chains, with per-chain breakdown
- **Cross-Chain Withdrawals** — withdraw to any of 8 chains. Smart routing: direct transfer when funds are still in the deposit wallet, UB spend when funds are already in Unified Balance.
- **QR Code Checkout** — scan-to-pay with real-time payment detection
- **Merchant Authentication** — password-gated dashboard
- **Live Order Feed** — auto-refreshing orders table with status, chain, and revenue tracking

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Frontend | React 18, CSS (no UI library) |
| Wallets | Circle Developer-Controlled Wallets (`@circle-fin/developer-controlled-wallets`) |
| Unified Balance | Circle App Kit + Unified Balance Kit + Circle Wallets Adapter |
| Cross-chain USDC | CCTP V2 (under the hood) |
| Gas | Sponsored by Circle's paymaster (SCA model) |
| Supported chains | Arc Testnet, Ethereum Sepolia, Base Sepolia, Arbitrum Sepolia, Avalanche Fuji, OP Sepolia, Unichain Sepolia |
| QR Codes | `qrcode` npm package |
| State | File-backed JSON (swap for Postgres/Supabase in production) |

## Project Structure

```
src/
├── app/
│   ├── page.js                    # Storefront — product grid + checkout modal
│   ├── checkout/page.js           # Payment page — QR, address, receipt
│   ├── dashboard/page.js          # Merchant dashboard — unified balance + orders + withdrawals
│   ├── layout.js                  # Root layout
│   ├── globals.css                # All styles
│   └── api/
│       ├── auth/route.js          # POST — admin password check
│       ├── orders/
│       │   ├── create/route.js    # POST — create order + generate deposit address
│       │   ├── status/route.js    # GET  — poll order status (checkout page)
│       │   └── route.js           # GET  — all orders + stats + listener status (dashboard)
│       ├── webhook/route.js       # POST — webhook handler (optional path)
│       └── withdraw/route.js      # POST — withdraw to any chain (hybrid: direct + UB)
├── lib/
│   ├── orders.js                  # Order store (in-memory Map)
│   ├── wallet.js                  # Wallet helpers (HD derivation, USDC balance reads)
│   ├── circle.js                  # Circle App Kit integration (deposit, spend, getBalances)
│   └── listener.js                # Multi-chain background listener (scans all chains every 10s)
```

## Getting Started

### Prerequisites

- Node.js 18+
- A merchant wallet address (any EVM address you control)
- A gas wallet with small ETH balances on each supported testnet (for funding deposit-wallet gas)
- Circle App Kit access (handled via the SDK)

### 1. Clone and install

```bash
git clone https://github.com/Adeyemir/Aeroframe.git
cd Aeroframe
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Merchant — where unified balance is withdrawn to
MERCHANT_ADDRESS=0xYourMerchantWalletAddress

# Gas wallet — funds deposit wallets so they can sign deposit() / transfer() txs
GAS_WALLET_PRIVATE_KEY=0xYourGasWalletPrivateKey

# Admin password for the dashboard
ADMIN_PASSWORD=your_password

# RPC endpoints (defaults shown — override if you have private RPCs)
RPC_ARC_TESTNET=https://rpc.testnet.arc.network
RPC_ETH_SEPOLIA=https://ethereum-sepolia.publicnode.com
RPC_BASE_SEPOLIA=https://base-sepolia-rpc.publicnode.com
RPC_ARB_SEPOLIA=https://sepolia-rollup.arbitrum.io/rpc
RPC_AVAX_FUJI=https://api.avax-test.network/ext/bc/C/rpc
RPC_OP_SEPOLIA=https://sepolia.optimism.io
RPC_UNICHAIN_SEPOLIA=https://sepolia.unichain.org

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The multi-chain listener starts automatically and watches all configured chains every 10 seconds.

### 4. Test a payment

1. Go to the storefront and click **Pay with USDC** on any product
2. Fill in your details and click **Proceed to Payment**
3. Send testnet USDC to the displayed deposit address from any of the supported chains
4. Watch the checkout page auto-update when payment is confirmed
5. View it on the **Merchant Dashboard** at `/dashboard`
6. Withdraw the unified balance to any chain from the dashboard

### 5. Get testnet USDC

| Chain | Faucet |
|-------|--------|
| Arc Testnet | https://faucet.arc.network |
| Ethereum Sepolia | https://faucet.circle.com |
| Base Sepolia | https://faucet.circle.com |
| Arbitrum Sepolia | https://faucet.circle.com |
| Avalanche Fuji | https://faucet.circle.com |
| OP Sepolia | https://faucet.circle.com |
| Unichain Sepolia | https://faucet.circle.com |

## API Reference

### `POST /api/orders/create`

Creates a new order and generates a unique deposit address.

**Request body:**
```json
{
  "customerName": "John Doe",
  "email": "john@example.com",
  "deliveryAddress": "Digital delivery",
  "item": "DJI Mini 4 Pro — 3D Model File",
  "amount": 12.00
}
```

**Response:**
```json
{
  "id": "order_xxx",
  "depositAddress": "0x...",
  "amount": 12.00,
  "supportedChains": ["Arc Testnet", "Ethereum Sepolia", ...]
}
```

### `GET /api/orders/status?id=order_xxx`

Returns the current status of an order. Polled by the checkout page every 3 seconds.

### `GET /api/orders`

Returns all orders with aggregate stats and the multi-chain listener status. Used by the merchant dashboard.

### `POST /api/withdraw`

Withdraws all available funds to the merchant address on a target chain. Hybrid strategy:

- **Direct transfer:** if USDC is still sitting in the deposit wallet (e.g. Arc-native payments), do a direct ERC-20 transfer.
- **UB spend:** if USDC has been deposited into Unified Balance via CCTP, call `unifiedBalance.spend()` to mint on the target chain.

**Request body:**
```json
{
  "chain": "Arc_Testnet"
}
```

Supported chains: `Arc_Testnet`, `Base_Sepolia`, `Ethereum_Sepolia`, `Arbitrum_Sepolia`, `Avalanche_Fuji`, `Optimism_Sepolia`, `Unichain_Sepolia`.

## Production Notes

- Replace the in-memory order store (`src/lib/orders.js`) with a database (Postgres, Supabase, etc.)
- Move private keys out of env vars into a KMS (AWS KMS, Google Cloud KMS, etc.)
- Add per-merchant authentication beyond the single shared password
- Switch RPC endpoints to private/paid providers (Alchemy, Infura, QuickNode) for production reliability
- Run the multi-chain listener as a separate worker process instead of in-server
- Add Sentry / structured logging for the listener and withdraw paths
- Switch USDC contract addresses and chain RPCs to mainnet equivalents

## Why Cross-Chain Matters

Most e-commerce stablecoin checkouts force customers to bridge or hold tokens on a specific chain before they can pay. Aeroframe accepts USDC from wherever the customer already holds it — Arc, Ethereum, Base, Arbitrum, Avalanche, Optimism, or Unichain — to a single address. The merchant sees one balance and withdraws to whichever chain suits their treasury.

This is the actual user experience stablecoins promised: borderless, chain-agnostic value transfer with no bridging friction at checkout.

## Author

**Ade** — [@_OxAde](https://x.com/_OxAde) — [github.com/Adeyemir](https://github.com/Adeyemir)

## License

ISC
