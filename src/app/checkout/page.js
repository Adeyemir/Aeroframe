'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <main style={{ textAlign: 'center', padding: '80px 0' }}>
        <div className="spinner" style={{ margin: '0 auto 16px' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Loading checkout...</p>
      </main>
    }>
      <CheckoutContent />
    </Suspense>
  );
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('id');

  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const pollingRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/orders/status?id=${orderId}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setOrder(data);

      if (data.status === 'paid' && pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    } catch (err) {
      console.error('Status fetch error:', err);
    }
  }, [orderId]);

  useEffect(() => {
    fetchStatus();
    pollingRef.current = setInterval(fetchStatus, 3000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchStatus]);

  useEffect(() => {
    if (!order?.depositAddress) return;
    import('qrcode').then((QRCode) => {
      QRCode.toDataURL(order.depositAddress, {
        width: 200,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      }).then(setQrDataUrl);
    });
  }, [order?.depositAddress]);

  async function copyAddress() {
    if (!order?.depositAddress) return;
    try {
      await navigator.clipboard.writeText(order.depositAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement('textarea');
      el.value = order.depositAddress;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  // Get block explorer URL based on which chain paid
  function getExplorerUrl(chain, txHash) {
    if (!txHash) return null;
    const explorers = {
      'Arc Testnet': 'https://testnet.arcscan.app/tx/',
      'Ethereum Sepolia': 'https://sepolia.etherscan.io/tx/',
      'Base Sepolia': 'https://sepolia.basescan.org/tx/',
      'Arbitrum Sepolia': 'https://sepolia.arbiscan.io/tx/',
      'Polygon Amoy': 'https://amoy.polygonscan.com/tx/',
      'Avalanche Fuji': 'https://testnet.snowtrace.io/tx/',
      'OP Sepolia': 'https://sepolia-optimism.etherscan.io/tx/',
      'Unichain Sepolia': 'https://sepolia.uniscan.xyz/tx/',
    };
    const base = explorers[chain] || 'https://sepolia.basescan.org/tx/';
    return `${base}${txHash}`;
  }

  // Get short chain name for badges
  function shortChainName(name) {
    return name?.replace(' Sepolia', '').replace(' Testnet', '').replace(' Amoy', '').replace(' Fuji', '');
  }

  if (error) {
    return (
      <main style={{ textAlign: 'center', padding: '80px 0' }}>
        <h2 style={{ marginBottom: 8 }}>Order not found</h2>
        <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
        <a href="/" className="btn btn-secondary" style={{ marginTop: 24 }}>
          &larr; Back to store
        </a>
      </main>
    );
  }

  if (!order) {
    return (
      <main style={{ textAlign: 'center', padding: '80px 0' }}>
        <div className="spinner" style={{ margin: '0 auto 16px' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Loading order...</p>
      </main>
    );
  }

  // ─── Success / Receipt State ───
  if (order.status === 'paid') {
    const explorerUrl = getExplorerUrl(order.paidChain, order.txHash);
    const paidDate = order.paidAt ? new Date(order.paidAt) : new Date();

    return (
      <main className="receipt-wrapper">
        <div className="receipt-card">
          {/* Receipt header */}
          <div className="receipt-header">
            <div className="receipt-logo">AEROFRAME</div>
            <div className="receipt-badge-paid">PAID</div>
          </div>

          <div className="receipt-title-section">
            <div className="receipt-check">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="receipt-title">Payment Confirmed</h2>
            <p className="receipt-subtitle">Your payment has been received and verified on-chain.</p>
          </div>

          <div className="receipt-divider" />

          {/* Order details */}
          <div className="receipt-section">
            <div className="receipt-section-label">Order Details</div>
            <div className="receipt-row">
              <span className="receipt-row-label">Order ID</span>
              <span className="mono receipt-row-value">{order.id}</span>
            </div>
            <div className="receipt-row">
              <span className="receipt-row-label">Product</span>
              <span className="receipt-row-value">{order.item}</span>
            </div>
            <div className="receipt-row">
              <span className="receipt-row-label">Amount</span>
              <span className="receipt-row-value receipt-amount">${order.amount.toFixed(2)} USDC</span>
            </div>
            <div className="receipt-row">
              <span className="receipt-row-label">Date</span>
              <span className="receipt-row-value">
                {paidDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                {' at '}
                {paidDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          <div className="receipt-divider" />

          {/* Customer details */}
          <div className="receipt-section">
            <div className="receipt-section-label">Customer</div>
            <div className="receipt-row">
              <span className="receipt-row-label">Name</span>
              <span className="receipt-row-value">{order.customerName}</span>
            </div>
            {order.email && (
              <div className="receipt-row">
                <span className="receipt-row-label">Email</span>
                <span className="receipt-row-value">{order.email}</span>
              </div>
            )}
            {order.deliveryAddress && (
              <div className="receipt-row">
                <span className="receipt-row-label">Delivery</span>
                <span className="receipt-row-value">{order.deliveryAddress}</span>
              </div>
            )}
          </div>

          {/* Transaction details */}
          <div className="receipt-divider" />
          <div className="receipt-section">
            <div className="receipt-section-label">Transaction</div>
            <div className="receipt-row">
              <span className="receipt-row-label">Network</span>
              <span className="receipt-row-value">{order.paidChain || 'EVM'} (Testnet)</span>
            </div>
            {order.depositedToUB && (
              <div className="receipt-row">
                <span className="receipt-row-label">Unified Balance</span>
                <span className="receipt-row-value" style={{ color: 'var(--success)' }}>
                  ✓ Deposited
                </span>
              </div>
            )}
            {order.txHash && (
              <div className="receipt-row">
                <span className="receipt-row-label">Tx Hash</span>
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="receipt-tx-link mono"
                >
                  {order.txHash.slice(0, 10)}...{order.txHash.slice(-8)}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              </div>
            )}
          </div>

          <div className="receipt-divider" />

          {/* Footer */}
          <div className="receipt-footer">
            <p>Chain-agnostic payment powered by Circle Unified Balance</p>
          </div>

          <div className="receipt-actions">
            <a href="/" className="btn btn-primary" style={{ width: '100%' }}>
              Continue Shopping
            </a>
          </div>
        </div>
      </main>
    );
  }

  // ─── Pending / Awaiting Payment State ───
  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '40px 0' }}>
      <a href="/" className="checkout-back">
        &larr; Back to store
      </a>

      <div className="checkout-grid">
        <div>
          <h1 className="checkout-title">Complete payment</h1>
          <p className="checkout-subtitle">
            Send exactly the amount below to the deposit address.
          </p>

          <div className="detail-card">
            <div className="detail-label">Amount due</div>
            <div>
              <span className="amount-large">${order.amount.toFixed(2)}</span>
              <span className="amount-unit">USDC</span>
            </div>
          </div>

          <div className="detail-card">
            <div className="detail-label">Item</div>
            <div className="detail-value">{order.item}</div>
          </div>

          {/* Customer info */}
          {order.customerName && (
            <div className="detail-card">
              <div className="detail-label">Customer</div>
              <div className="detail-value">{order.customerName}</div>
              {order.deliveryAddress && (
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {order.deliveryAddress}
                </div>
              )}
            </div>
          )}

          <div className="detail-card">
            <div className="detail-label">Accepted Networks</div>
            <div className="chain-badges">
              {(order.supportedChains || []).map(chain => (
                <span key={chain} className="chain-badge">{shortChainName(chain)}</span>
              ))}
            </div>
          </div>

          <div className="waiting-card">
            <span className="status-dot pending" />
            <div style={{ flex: 1 }}>
              <div className="waiting-title">Listening for payment...</div>
              <div className="waiting-desc">
                This page updates automatically when USDC is received on any chain
              </div>
            </div>
            <div className="spinner" />
          </div>
        </div>

        <div>
          <div className="qr-card">
            <div className="qr-card-title">Send USDC to this address</div>

            {qrDataUrl && (
              <div className="qr-container" style={{ marginBottom: 20 }}>
                <img src={qrDataUrl} alt="Deposit address QR code" width={180} height={180} />
              </div>
            )}

            <div className="address-box" onClick={copyAddress}>
              <div className="address-text">{order.depositAddress}</div>
              <div className="copy-hint">
                {copied ? '\u2713 Copied!' : 'Click to copy'}
              </div>
            </div>

            <div className="checkout-supported-chains">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>
                This address accepts USDC from {(order.supportedChains || []).length} networks including{' '}
                <strong>Arc</strong>, <strong>Ethereum</strong>, <strong>Base</strong>, <strong>Arbitrum</strong>,{' '}
                <strong>Polygon</strong>, and more. Same address, any EVM chain.
              </span>
            </div>

            <div className="checkout-ref">
              Order: <span className="mono">{order.id}</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
