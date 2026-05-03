'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const PRODUCTS = [
  {
    id: 'dji-mini-4',
    image: 'https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=600&h=400&fit=crop',
    name: 'DJI Mini 4 Pro — 3D Model File',
    description: 'High-poly 3D model, Blender & OBJ formats, PBR textures included',
    price: 12.00,
  },
  {
    id: 'sony-a7iv',
    image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&h=400&fit=crop',
    name: 'Sony A7 IV — Preset Pack',
    description: '24 cinematic color presets for Lightroom & Capture One',
    price: 8.00,
  },
  {
    id: 'gopro-hero12',
    image: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&h=400&fit=crop',
    name: 'GoPro HERO 12 — Editing Templates',
    description: '15 Premiere Pro templates, transitions & LUTs for action footage',
    price: 5.00,
  },
  {
    id: 'canon-85mm',
    image: 'https://images.unsplash.com/photo-1617005082133-548c4dd27f35?w=600&h=400&fit=crop',
    name: 'Canon 85mm — Lightroom Preset',
    description: 'Portrait-optimized preset pack, warm tones & bokeh enhancement',
    price: 6.00,
  },
  {
    id: 'fpv-drone',
    image: 'https://images.unsplash.com/photo-1579829366248-204fe8413f31?w=600&h=400&fit=crop',
    name: 'FPV Drone — Flight Sim License',
    description: '12-month simulator access, 50+ tracks, multiplayer racing',
    price: 10.00,
  },
  {
    id: 'dji-rc',
    image: 'https://images.unsplash.com/photo-1508444845599-5c89863b1c44?w=600&h=400&fit=crop',
    name: 'DJI Controller — Setup Guide Pro',
    description: 'Complete video course, custom mapping profiles & cheat sheets',
    price: 5.00,
  },
];

export default function StorePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [modalProduct, setModalProduct] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('Digital delivery');

  function openModal(product) {
    setModalProduct(product);
  }

  function closeModal() {
    if (loading) return;
    setModalProduct(null);
  }

  async function handleProceed() {
    if (!name.trim()) {
      alert('Please enter your full name');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: name.trim(),
          email: email.trim() || null,
          deliveryAddress: deliveryAddress.trim() || 'Digital delivery',
          item: modalProduct.name,
          amount: modalProduct.price,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create order');
      }

      router.push(`/checkout?id=${data.order.id}`);
    } catch (err) {
      console.error('Buy error:', err);
      alert(`Error: ${err.message}`);
      setLoading(false);
    }
  }

  return (
    <main>
      <section className="hero">
        <div className="hero-label">Digital Assets for Creators</div>
        <h1>
          Premium digital goods.<br />
          <span className="hero-light">Paid with stablecoins.</span>
        </h1>
        <p>
          Presets, templates, 3D models &amp; more for drone and camera creators.
          Pay with USDC from any chain. Instant. Borderless. No banks.
        </p>
      </section>

      {/* Products */}
      <div className="products-header">
        <h2 className="products-title">All Products</h2>
        <span className="products-count">{PRODUCTS.length} items</span>
      </div>

      <div className="products-grid">
        {PRODUCTS.map((product) => (
          <div key={product.id} className="product-card">
            <div className="product-image-wrapper">
              <img
                src={product.image}
                alt={product.name}
                className="product-image"
                loading="lazy"
              />
            </div>
            <div className="product-body">
              <div className="product-name">{product.name}</div>
              <div className="product-desc">{product.description}</div>
              <div className="product-footer">
                <div className="product-price">
                  ${product.price.toFixed(2)} <span>USDC</span>
                </div>
                <button
                  className="btn btn-primary product-btn"
                  onClick={() => openModal(product)}
                >
                  Pay with USDC
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* How it works */}
      <section className="how-section">
        <h2>How it works</h2>
        <p className="how-subtitle">Three steps. No middleman.</p>
        <div className="grid-3">
          {[
            { step: '01', title: 'Choose your gear', desc: 'Browse the collection and select Pay with USDC. A unique deposit address is generated instantly.' },
            { step: '02', title: 'Send USDC', desc: 'Send the exact amount from any wallet — Arc, Ethereum, Base, Arbitrum, Polygon, Avalanche, Optimism, or Unichain. Payment is detected automatically.' },
            { step: '03', title: 'Confirmed', desc: 'Payment verified and deposited into the merchant\'s unified USDC balance via Circle. Done.' },
          ].map((s) => (
            <div key={s.step} className="step-card">
              <div className="step-number">{s.step}</div>
              <div className="step-title">{s.title}</div>
              <div className="step-desc">{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="demo-banner">
        Demo Store &middot; Testnet demo powered by Circle Unified Balance. Pay with USDC from 8 supported networks.
      </div>

      {/* Checkout Modal */}
      {modalProduct && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal} disabled={loading}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="modal-product-summary">
              <div className="modal-product-name">{modalProduct.name}</div>
              <div className="modal-product-price">
                ${modalProduct.price.toFixed(2)} <span>USDC</span>
              </div>
            </div>

            <div className="modal-divider" />

            <div className="modal-form">
              <div className="form-group">
                <label htmlFor="modal-name">Full name *</label>
                <input
                  id="modal-name"
                  type="text"
                  className="input"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label htmlFor="modal-email">Email address</label>
                <input
                  id="modal-email"
                  type="email"
                  className="input"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="modal-address">Delivery address</label>
                <input
                  id="modal-address"
                  type="text"
                  className="input"
                  placeholder="Digital delivery"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                />
              </div>
            </div>

            <button
              className="btn btn-primary modal-submit"
              disabled={loading}
              onClick={handleProceed}
            >
              {loading ? (
                <>
                  <span className="spinner" style={{ width: 16, height: 16, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                  Creating order...
                </>
              ) : (
                'Proceed to Payment'
              )}
            </button>

            <div className="modal-footer-note">
              You&apos;ll be redirected to a secure checkout page with your unique deposit address.
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
