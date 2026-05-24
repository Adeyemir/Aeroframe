'use client';

import { useState, useEffect, useCallback } from 'react';

export default function DashboardPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawResult, setWithdrawResult] = useState(null);
  const [withdrawChain, setWithdrawChain] = useState('Arc_Testnet');

  useEffect(() => {
    const token = localStorage.getItem('aeroframe_admin_token');
    if (token) setIsAuthenticated(true);
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const result = await res.json();
      if (result.success) {
        localStorage.setItem('aeroframe_admin_token', result.token);
        setIsAuthenticated(true);
      } else {
        setAuthError('Incorrect password');
      }
    } catch {
      setAuthError('Something went wrong');
    } finally {
      setAuthLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('aeroframe_admin_token');
    setIsAuthenticated(false);
    setData(null);
  }

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/orders');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [isAuthenticated, fetchData]);

  // ─── Login Screen ───
  if (!isAuthenticated) {
    return (
      <main style={{ maxWidth: 400, margin: '0 auto', padding: '120px 24px', textAlign: 'center' }}>
        <div style={{
          background: 'var(--bg-white)', borderRadius: 'var(--radius-lg)',
          padding: '48px 36px', boxShadow: 'var(--shadow-lg)',
        }}>
          <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase', color: 'var(--text-dim)' }}>
            AEROFRAME
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.5px' }}>
            Merchant Dashboard
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 32 }}>
            Enter admin password to continue
          </p>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input type="password" className="input" placeholder="Admin password"
              value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
            {authError && (
              <div style={{ fontSize: 13, color: 'var(--error)', textAlign: 'left' }}>{authError}</div>
            )}
            <button type="submit" className="btn btn-primary" disabled={authLoading || !password} style={{ width: '100%' }}>
              {authLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          <p style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 20 }}>
            This dashboard is for store administrators only.
          </p>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main style={{ textAlign: 'center', padding: '80px 0' }}>
        <div className="spinner" style={{ margin: '0 auto 16px' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Loading dashboard...</p>
      </main>
    );
  }

  const { orders = [], stats = {}, listener = {} } = data || {};

  const paidOrders = orders.filter(o => o.status === 'paid');
  const totalRevenue = paidOrders.reduce((sum, o) => sum + (parseFloat(o.amountPaid) || o.amount), 0);
  const unspentOrders = paidOrders.filter(o => !o.spent);
  const availableBalance = unspentOrders.reduce((sum, o) => sum + (parseFloat(o.amountPaid) || o.amount), 0);

  // Group revenue by chain
  const revenueByChain = paidOrders.reduce((acc, o) => {
    const chain = o.paidChain || 'Unknown';
    acc[chain] = (acc[chain] || 0) + (parseFloat(o.amountPaid) || o.amount);
    return acc;
  }, {});

  async function handleWithdraw() {
    setWithdrawing(true);
    setWithdrawResult(null);
    try {
      const res = await fetch('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chain: withdrawChain }),
      });
      const result = await res.json();
      setWithdrawResult(result);
      fetchData();
    } catch (err) {
      setWithdrawResult({ error: err.message });
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <main>
      <div className="dashboard-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="dashboard-tag">AEROFRAME</div>
          <button onClick={handleLogout} style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            color: 'var(--text-dim)', fontFamily: 'var(--font)',
          }}>Sign Out</button>
        </div>
        <h1>Merchant Dashboard</h1>
        <p>Real-time view of all stablecoin payments across chains</p>
      </div>

      {/* ─── Stats Row ─── */}
      <div className="grid-3" style={{ marginBottom: 32 }}>
        <div className="stat-card">
          <div className="stat-label">Total Orders</div>
          <div className="stat-value">{stats.total || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Paid</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.paid || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Revenue (USDC)</div>
          <div className="stat-value">${totalRevenue.toFixed(2)}</div>
        </div>
      </div>

      {/* ─── Available Balance ─── */}
      <div className="balance-breakdown-card" style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Available Balance
        </h3>
        <div style={{ display: 'flex', gap: 32, alignItems: 'baseline', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 32, fontWeight: 700 }}>
              ${availableBalance.toFixed(2)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
              {availableBalance > 0 ? 'Ready to withdraw' : 'No unspent funds'}
            </div>
          </div>
        </div>

        {/* Fund source breakdown */}
        {availableBalance > 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>
            {stats.arcBalance > 0 && <span>${stats.arcBalance.toFixed(2)} on Arc · </span>}
            {stats.availableBalance > 0 && <span>${parseFloat(stats.availableBalance).toFixed(2)} in Unified Balance · </span>}
            {unspentOrders.length} order(s) available
          </div>
        )}

        {/* Withdraw button + chain selector */}
        {availableBalance > 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
            <button onClick={handleWithdraw} disabled={withdrawing}
              className="btn btn-primary">
              {withdrawing ? 'Withdrawing...' : `Withdraw $${availableBalance.toFixed(2)} USDC`}
            </button>
            <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>to</span>
            <select
              value={withdrawChain}
              onChange={(e) => setWithdrawChain(e.target.value)}
              className="input"
              style={{ width: 'auto', minWidth: 160, padding: '8px 12px', fontSize: 13 }}
            >
              <option value="Arc_Testnet">Arc</option>
              <option value="Base_Sepolia">Base</option>
              <option value="Ethereum_Sepolia">Ethereum</option>
              <option value="Arbitrum_Sepolia">Arbitrum</option>
              <option value="Avalanche_Fuji">Avalanche</option>
              <option value="OP_Sepolia">Optimism</option>
              <option value="Unichain_Sepolia">Unichain</option>
            </select>
          </div>
        )}

        {/* Pending UB deposits */}
        {stats.pendingDeposits > 0 && (
          <div style={{
            padding: 12, borderRadius: 'var(--radius-sm)',
            background: '#fffbeb', fontSize: 13, color: '#92400e', marginBottom: 8,
          }}>
            {stats.pendingDeposits} payment(s) pending Unified Balance confirmation (~15 min).
            You can still withdraw these on their source chain.
          </div>
        )}

        {/* Withdraw result */}
        {withdrawResult && (
          <div style={{
            padding: 14, borderRadius: 'var(--radius-sm)', marginTop: 8,
            background: withdrawResult.success ? '#f0faf0' : '#fff3f3',
            fontSize: 13,
          }}>
            {withdrawResult.success ? (
              <div>
                <div style={{ fontWeight: 600, color: 'var(--success)', marginBottom: 4 }}>
                  {withdrawResult.message}
                </div>
                {withdrawResult.results?.map((r, i) => (
                  r.txHash && (
                    <div key={i} className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                      {r.method === 'direct_transfer' ? '↗ Direct' : '↗ UB Spend'}: {r.txHash.slice(0, 20)}...
                    </div>
                  )
                ))}
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                  To: {withdrawResult.merchantAddress}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontWeight: 600, color: 'var(--error)', marginBottom: 4 }}>
                  {withdrawResult.error || withdrawResult.message}
                </div>
                {withdrawResult.results?.map((r, i) => (
                  r.error && (
                    <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {r.orderId}: {r.error}
                    </div>
                  )
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Revenue by Chain ─── */}
      {Object.keys(revenueByChain).length > 0 && (
        <div className="balance-breakdown-card" style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Revenue by Chain
          </h3>
          <div className="balance-breakdown-grid">
            {Object.entries(revenueByChain).map(([chain, amount]) => (
              <div key={chain} className="chain-balance-row">
                <span className="chain-balance-name">{chain}</span>
                <span className="chain-balance-amount">${amount.toFixed(2)} USDC</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Recent Withdrawals ─── */}
      {orders.filter(o => o.spent).length > 0 && (
        <div className="balance-breakdown-card" style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Withdrawal History
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {orders.filter(o => o.spent).map(order => {
              const explorers = {
                'Arc Testnet': 'https://testnet.arcscan.app/tx/',
                'Base Sepolia': 'https://sepolia.basescan.org/tx/',
                'Ethereum Sepolia': 'https://sepolia.etherscan.io/tx/',
                'Arbitrum Sepolia': 'https://sepolia.arbiscan.io/tx/',
                'Polygon Amoy': 'https://amoy.polygonscan.com/tx/',
                'Avalanche Fuji': 'https://testnet.snowtrace.io/tx/',
                'OP Sepolia': 'https://sepolia-optimism.etherscan.io/tx/',
                'Unichain Sepolia': 'https://sepolia.uniscan.xyz/tx/',
              };
              const explorerBase = explorers[order.spendChain] || 'https://sepolia.basescan.org/tx/';
              return (
                <div key={order.id} style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)'
                }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>${parseFloat(order.amountPaid).toFixed(2)} USDC</div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                      Sent to {order.spendChain}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {order.spendTxHash && (
                      <a href={`${explorerBase}${order.spendTxHash}`} target="_blank" rel="noopener noreferrer" 
                        style={{ fontSize: 12, color: 'var(--primary)', textDecoration: 'none' }}>
                        View Transaction ↗
                      </a>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                      {order.paidAt ? new Date(order.paidAt).toLocaleTimeString() : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Listener Status ─── */}
      <div className="listener-status" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`status-dot ${listener.running ? 'paid' : 'pending'}`} />
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Multi-chain listener: {listener.running ? 'Active' : 'Inactive'}
            {listener.scanCount > 0 && ` · ${listener.scanCount} scans`}
            {listener.lastScanTime && ` · Last: ${new Date(listener.lastScanTime).toLocaleTimeString()}`}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
          {(listener.chains || []).map(chain => (
            <span key={chain} className="chain-badge chain-badge-sm">
              {chain.replace(' Sepolia', '').replace(' Testnet', '').replace(' Amoy', '').replace(' Fuji', '')}
            </span>
          ))}
        </div>
      </div>

      {/* ─── Orders Table ─── */}
      <div className="orders-card">
        <div className="orders-header">
          <h2>Recent Orders</h2>
          <span className="live-indicator">Live</span>
        </div>

        {orders.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>
              No orders yet. Go to the{' '}
              <a href="/" style={{ color: 'var(--text)', textDecoration: 'none', fontWeight: 600 }}>store</a>{' '}
              and create one.
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Item</th>
                  <th>Amount</th>
                  <th>Chain</th>
                  <th>Status</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td><span className="mono" style={{ fontSize: 12 }}>{order.id.slice(0, 20)}...</span></td>
                    <td style={{ fontWeight: 500 }}>{order.customerName}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.item}</td>
                    <td style={{ fontWeight: 700 }}>${order.amount.toFixed(2)}</td>
                    <td>
                      {order.paidChain ? (
                        <span className="chain-badge chain-badge-sm">
                          {order.paidChain.replace(' Sepolia', '').replace(' Testnet', '').replace(' Amoy', '').replace(' Fuji', '')}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>--</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${order.spent ? 'badge-paid' : order.status === 'paid' ? 'badge-paid' : 'badge-pending'}`}>
                        <span className={`status-dot ${order.status}`} />
                        {order.spent ? 'withdrawn' : order.status}
                        {order.depositedToUB && !order.spent && ' · UB'}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {order.paidAt ? new Date(order.paidAt).toLocaleTimeString() : new Date(order.createdAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="info-card">
        <div className="info-icon">&#9889;</div>
        <div>
          <div className="info-title">Powered by Circle Unified Balance</div>
          <div className="info-text">
            Payments are accepted across 8 chains. Arc payments settle instantly.
            Other chains are deposited into Unified Balance via CCTP, enabling
            cross-chain withdrawals to any network. One balance. Any chain.
          </div>
        </div>
      </div>
    </main>
  );
}
