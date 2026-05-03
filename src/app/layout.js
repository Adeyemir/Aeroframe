import './globals.css';

export const metadata = {
  title: 'AEROFRAME \u2014 Cameras & Drones | Pay with USDC',
  description: 'Premium cameras and drones. Pay with USDC from any chain. Instant, borderless checkout powered by Circle Unified Balance.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <nav className="nav">
            <a href="/" className="nav-logo">
              AEROFRAME
            </a>
            <ul className="nav-links">
              <li><a href="/">Store</a></li>
              <li><a href="/dashboard">Dashboard</a></li>
            </ul>
          </nav>
          {children}
          <footer className="powered-by">
            Chain-agnostic USDC payments powered by{' '}
            <a href="https://docs.arc.network/app-kit" target="_blank" rel="noopener">
              Circle Unified Balance
            </a>
          </footer>
        </div>
      </body>
    </html>
  );
}
