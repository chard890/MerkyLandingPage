import React, { useEffect, useState, useRef, useCallback } from 'react';
import './App.css';

// Pool of HUD content
const HUD_POOL = [
  { type: 'box', content: '54' },
  { type: 'box', content: '12' },
  { type: 'box', content: '24' },
  { type: 'box', content: '0x_7F' },
  { type: 'box', content: '[RUN]' },
  { type: 'sym', content: '√y' },
  { type: 'sym', content: '∞' },
  { type: 'sym', content: '∫x' },
  { type: 'sym', content: '-15+6' },
  { type: 'sym', content: '{ }' },
  { type: 'sym', content: 'terminal' },
  { type: 'sym', content: 'exec()' },
  { type: 'sym', content: 'VS Code' },
  { type: 'sym', content: 'Spotify' },
];

// Helper: create a single HUD element spawning from the sides of the title
const createHudElement = (index) => {
  const side = Math.random() > 0.5 ? 1 : -1; // left (-1) or right (+1) side
  const startX = side * (280 + Math.random() * 80); // spawn at edge of title width (~560px wide)
  const startY = (Math.random() - 0.5) * 120; // random vertical offset within title height
  const driftX = side * (150 + Math.random() * 350); // drift further outward in the same direction
  const driftY = (Math.random() - 0.5) * 250; // some vertical drift too
  const duration = 6 + Math.random() * 6;
  const item = HUD_POOL[Math.floor(Math.random() * HUD_POOL.length)];
  return {
    id: `hud-${index}-${Date.now()}-${Math.random()}`,
    ...item,
    startX,
    startY,
    tx: startX + driftX,
    ty: startY + driftY,
    duration,
    delay: Math.random() * duration,
    depth: 0.15 + Math.random() * 0.35,
  };
};

// Floating HUD elements: spawn at center near title, drift outward, fade out, respawn
const FloatingHUD = () => {
  const [elements, setElements] = useState(() =>
    Array.from({ length: 10 }).map((_, i) => createHudElement(i))
  );

  // When an element's animation ends, replace it with a fresh one
  const handleAnimEnd = useCallback((index) => {
    setElements(prev => {
      const next = [...prev];
      next[index] = { ...createHudElement(index), delay: 0 }; // no delay on respawn
      return next;
    });
  }, []);

  return (
    <div className="hud-emitter">
      {elements.map((el, i) => (
        <div
          key={el.id}
          className={`${el.type === 'box' ? 'hud-box' : 'math-symbol'} parallax-layer hud-emit`}
          style={{
            '--hud-sx': `${el.startX}px`,
            '--hud-sy': `${el.startY}px`,
            '--hud-tx': `${el.tx}px`,
            '--hud-ty': `${el.ty}px`,
            '--hud-dur': `${el.duration}s`,
            '--hud-delay': `${el.delay}s`,
            '--depth': el.depth,
          }}
          onAnimationEnd={() => handleAnimEnd(i)}
        >
          {el.content}
        </div>
      ))}
    </div>
  );
};

// Per-particle interactive system
const ParticleField = ({ heroRef }) => {
  const particlesRef = useRef([]);
  const containerRef = useRef(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const rafRef = useRef(null);

  // Stable particle initialization
  const particleData = useRef(null);
  if (!particleData.current) {
    particleData.current = Array.from({ length: 40 }).map(() => ({
      ox: 0, oy: 0,
      size: 2 + Math.random() * 4,
      tx: (Math.random() - 0.5) * 800,
      ty: (Math.random() - 0.5) * 400,
      delay: Math.random() * 6,
      duration: 4 + Math.random() * 4,
    }));
  }

  useEffect(() => {
    // Animation loop for per-particle repulsion
    const animate = () => {
      if (!heroRef.current || !containerRef.current || !particleData.current) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      // Read mouse position from Hero CSS variables (set in App.jsx listener)
      const mxVal = parseFloat(heroRef.current.style.getPropertyValue('--mx')) || 0.5;
      const myVal = parseFloat(heroRef.current.style.getPropertyValue('--my')) || 0.5;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const heroRect = heroRef.current.getBoundingClientRect();
      
      // Calculate mouse position relative to emitter center
      const mx = (mxVal - 0.5) * heroRect.width;
      const my = (myVal - 0.5) * heroRect.height;

      particlesRef.current.forEach((el, i) => {
        if (!el) return;
        const data = particleData.current[i];
        const rect = el.getBoundingClientRect();

        // Particle position relative to center of emitter
        const px = rect.left + rect.width / 2 - containerRect.left - containerRect.width / 2;
        const py = rect.top + rect.height / 2 - containerRect.top - containerRect.height / 2;

        const dx = px - mx;
        const dy = py - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 250; // slightly larger repulsion radius

        if (dist < maxDist && dist > 1) {
          const force = (1 - dist / maxDist) * 80; // max 80px push
          const angle = Math.atan2(dy, dx);
          const targetOx = Math.cos(angle) * force;
          const targetOy = Math.sin(angle) * force;
          
          data.ox += (targetOx - data.ox) * 0.15;
          data.oy += (targetOy - data.oy) * 0.15;
        } else {
          // Spring back to origin
          data.ox *= 0.9;
          data.oy *= 0.9;
        }

        // Apply using individual translate CSS variables (avoids transform conflicts)
        if (!isNaN(data.ox) && !isNaN(data.oy)) {
          el.style.setProperty('--rx', `${data.ox}px`);
          el.style.setProperty('--ry', `${data.oy}px`);
        }
      });

      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [heroRef]);

  return (
    <div ref={containerRef} className="particle-emitter-center">
      {particleData.current.map((p, i) => (
        <div
          key={i}
          ref={el => particlesRef.current[i] = el}
          className="fx-particle"
          style={{
            width: `${p.size}px`,
            height: `${p.size}px`,
            '--tx': `${p.tx}px`,
            '--ty': `${p.ty}px`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
};

// Interactive 3D Tilt Card component
const TiltCard = ({ children, className = "", style = {} }) => {
  const cardRef = useRef(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    // Guard against division by zero/NaN
    const rotateX = centerY > 0 ? ((y - centerY) / centerY) * -10 : 0;
    const rotateY = centerX > 0 ? ((x - centerX) / centerX) * 10 : 0;
    setRotate({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setRotate({ x: 0, y: 0 });
  };

  return (
    <div
      ref={cardRef}
      className={`glass-card card-tilt-wrapper ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        ...style,
        transform: `rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`,
      }}
    >
      <div className="card-content-inner">
        {children}
      </div>
    </div>
  );
};

const App = () => {
  const [activeFaq, setActiveFaq] = useState(null);
  const heroRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      // Hero parallax mouse tracking
      if (!heroRef.current) return;
      const { left, top, width, height } = heroRef.current.getBoundingClientRect();
      const x = (e.clientX - left) / width;
      const y = (e.clientY - top) / height;
      heroRef.current.style.setProperty('--mx', x.toString());
      heroRef.current.style.setProperty('--my', y.toString());
    };

    window.addEventListener('mousemove', handleMouseMove);

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('active');
      });
    }, { threshold: 0.1 });

    const revealElements = Array.from(document.querySelectorAll('.reveal'));
    revealElements.forEach(el => observer.observe(el));

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      revealElements.forEach(el => observer.unobserve(el));
    };
  }, []);

  const toggleFaq = (index) => setActiveFaq(activeFaq === index ? null : index);

  return (
    <div className="app-wrapper">
      {/* Navigation */}
      <nav className="navbar">
        <div className="container">
          <div className="logo-area">Merky</div>
          <div className="nav-pill-container">
            <a href="#home" className="nav-link active">Home</a>
            <a href="#how-it-works" className="nav-link">How it works</a>
            <a href="#features" className="nav-link">Features</a>
            <a href="#pricing" className="nav-link">Pricing</a>
            <a href="#faq" className="nav-link">FAQ</a>
            <a href="#login" className="nav-link">Login / Register</a>
          </div>
          <div className="nav-right-actions">
            <div className="lang-selector">🌐 English ▾</div>
            <button className="fx-btn-primary" style={{ padding: '0.4rem 0.4rem 0.4rem 1.6rem', fontSize: '0.85rem' }}>
              Join Waitlist <span className="arrow-circle" style={{ width: '28px', height: '28px', fontSize: '1rem' }}>→</span>
            </button>
            <button className="fx-btn-secondary" style={{ padding: '0.4rem 1.8rem', fontSize: '0.85rem' }}>Free trial</button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section" ref={heroRef} style={{ '--mx': '0.5', '--my': '0.5' }}>
        <div className="hero-bg-visuals">
          <div className="perspective-wrapper parallax-layer" style={{ '--depth': 0.1 }}>
            <div className="grid-plane grid-plane-top"></div>
            <div className="grid-plane grid-plane-bottom"></div>
          </div>
          <div className="hero-glow-center"></div>
          <div className="v-light-beam parallax-layer" style={{ '--depth': 0.08 }}></div>
          <div className="scanlines" style={{ opacity: 0.15 }}></div>
          <div className="cursor-glow"></div>

          {/* Floating HUD elements with drift + cycling */}
          <FloatingHUD />

          {/* Per-particle interactive burst */}
          <ParticleField heroRef={heroRef} />
        </div>

        <div className="hero-content-fx">
          <div className="meta-badge-text">
            Meet <span>Merky</span>
          </div>
          <h1 className="fx-title">
            Your animated AI friend<br />
            that can operate your computer
          </h1>
          <div className="feature-row-fx">
            <div className="feature-tag-fx">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="fx-icon"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
              Talk naturally
            </div>
            <div className="feature-tag-fx">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="fx-icon"><path d="M6 11c0-2.209 1.791-4 4-4h4c2.209 0 4 1.791 4 4v7c0 1.105-.895 2-2 2H8c-1.105 0-2-.895-2-2v-7z"/><path d="M6 12h12"/><path d="M12 7V4"/><path d="M11 4h2"/><path d="M10 11v2"/><path d="M14 11v2"/></svg>
              Operate apps
            </div>
            <div className="feature-tag-fx">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="fx-icon"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Privacy first
            </div>
            <div className="feature-tag-fx">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="fx-icon"><path d="m13 2-2 10h3L11 22l2-10h-3l2-10Z"/></svg>
              Watch it happen
            </div>
          </div>
          <div className="fx-btn-container">
            <button className="fx-btn-primary">
              Get Early Access <span className="arrow-circle">→</span>
            </button>
            <button className="fx-btn-secondary">Watch Demo</button>
          </div>
        </div>

        <div className="hero-footer-hints">
          <div className="social-links-fx">
            <span style={{ marginRight: '1rem', opacity: 0.6, fontSize: '0.9rem' }}>JOIN THE COMMUNITY</span>
            <a href="#" className="social-icon-wrapper">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
            </a>
            <a href="#" className="social-icon-wrapper">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
            </a>
            <a href="#" className="social-icon-wrapper">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>
            </a>
            <a href="#" className="social-icon-wrapper">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 10l-4 4l6 6l4-16l-18 7l4 2l2 6l3-4"/></svg>
            </a>
          </div>
          <div className="scroll-hint-fx">
            Scroll to explore <span>↓</span>
          </div>
        </div>
      </section>

       {/* Feature Section — Bento Grid */}
      <section id="features" className="reveal container features-section-modern" style={{ padding: '160px 2rem' }}>
        <div className="data-dots-bg"></div>
        <div className="feature-halo" style={{ top: '15%', left: '5%' }}></div>
        <div className="feature-halo" style={{ bottom: '10%', right: '0%', opacity: 0.06 }}></div>
        
        <h2 className="section-title reveal" style={{ position: 'relative', zIndex: 1 }}>
          Designed for <span className="gradient-text" style={{ fontSize: '1.2em' }}>Freedom</span>
        </h2>
        <p className="reveal" style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '1.15rem', maxWidth: '600px', margin: '-2rem auto 4rem', position: 'relative', zIndex: 1 }}>
          Three modes. One AI. Unlimited control over your digital life.
        </p>
        
        <div className="bento-grid reveal" style={{ '--delay': '0.3s' }}>
          {/* Large left card — Friend Mode */}
          <TiltCard className="bento-card bento-card-lg">
            <div className="bento-card-glow bento-glow-1"></div>
            <div className="bento-header">
              <div className="bento-badge">
                <span className="bento-pulse"></span>
                ACTIVE
              </div>
              <span className="bento-label">01</span>
            </div>
            <div className="bento-icon-area">
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="var(--accent-neon)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <h3 className="bento-title">Friend Mode</h3>
            <p className="bento-desc">Talk naturally, react, and keep you company throughout the day. Your desktop, now with a soul.</p>
            <div className="bento-terminal">
              <div className="bento-term-bar"><span></span><span></span><span></span></div>
              <div className="bento-term-body">
                <span className="term-prompt">merky&gt;</span> Hey, what's on my calendar?<br/>
                <span className="term-response">You have 2 meetings today...</span>
              </div>
            </div>
          </TiltCard>

          {/* Right column — stacked */}
          <div className="bento-col-right">
            {/* Operator Mode */}
            <TiltCard className="bento-card bento-card-sm">
              <div className="bento-card-glow bento-glow-2"></div>
              <div className="bento-header">
                <div className="bento-badge bento-badge-blue">
                  <span className="bento-pulse bento-pulse-blue"></span>
                  PRECISION
                </div>
                <span className="bento-label">02</span>
              </div>
              <div className="bento-row">
                <div className="bento-icon-area-sm">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent-neon)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="10" x="4" y="11" rx="2"/><path d="M12 11V7"/><path d="M12 7V3"/><path d="M9 3h6"/><circle cx="10" cy="15" r="1"/><circle cx="14" cy="15" r="1"/><circle cx="12" cy="17" r="1"/></svg>
                </div>
                <div>
                  <h3 className="bento-title" style={{ fontSize: '1.4rem' }}>Operator Mode</h3>
                  <p className="bento-desc" style={{ fontSize: '0.95rem' }}>Follow complex instructions and use your desktop interface with surgical precision.</p>
                </div>
              </div>
              <div className="bento-actions-row">
                <div className="bento-action-chip"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 12 5 5L20 7"/></svg> Click</div>
                <div className="bento-action-chip"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 12 5 5L20 7"/></svg> Type</div>
                <div className="bento-action-chip"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 12 5 5L20 7"/></svg> Scroll</div>
                <div className="bento-action-chip"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 12 5 5L20 7"/></svg> Launch</div>
              </div>
            </TiltCard>

            {/* Safe & Secure */}
            <TiltCard className="bento-card bento-card-sm">
              <div className="bento-card-glow bento-glow-3"></div>
              <div className="bento-header">
                <div className="bento-badge bento-badge-purple">
                  <span className="bento-pulse bento-pulse-purple"></span>
                  PROTECTED
                </div>
                <span className="bento-label">03</span>
              </div>
              <div className="bento-row">
                <div className="bento-icon-area-sm">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent-neon)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
                </div>
                <div>
                  <h3 className="bento-title" style={{ fontSize: '1.4rem' }}>Safe &amp; Secure</h3>
                  <p className="bento-desc" style={{ fontSize: '0.95rem' }}>Permission gated control with visible actions. Privacy built-in, not bolted on.</p>
                </div>
              </div>
              <div className="bento-perm-bar">
                <div className="bento-perm-item">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-neon)" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  <span>Screen Access</span>
                  <span className="perm-granted">Granted</span>
                </div>
                <div className="bento-perm-item">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-neon)" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  <span>File System</span>
                  <span className="perm-ask">Ask Each Time</span>
                </div>
              </div>
            </TiltCard>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="reveal container" style={{ padding: '160px 2rem', position: 'relative' }}>
        <div className="data-dots-bg" style={{ opacity: 0.2 }}></div>
        <div style={{ position: 'relative', zIndex: 2 }}>
          <h2 className="section-title">How It <span className="gradient-text">Works</span></h2>
          <div className="how-it-works-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2.5rem' }}>
            <TiltCard className="step-card" style={{ padding: '3.5rem 2rem' }}>
              <div className="step-number">1</div>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Tell Merky</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: '1.6' }}>Just say what you want in natural language. No complex syntax required.</p>
            </TiltCard>
            <TiltCard className="step-card" style={{ padding: '3.5rem 2rem' }}>
              <div className="step-number">2</div>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Safe Planning</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: '1.6' }}>Merky plans the safest steps to execute, asking for permission if needed.</p>
            </TiltCard>
            <TiltCard className="step-card" style={{ padding: '3.5rem 2rem' }}>
              <div className="step-number">3</div>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Watch it happen</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: '1.6' }}>Watch Merky execute the task on your screen, exactly like a human would.</p>
            </TiltCard>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="reveal container" style={{ padding: '160px 2rem', position: 'relative' }}>
        <h2 className="section-title">Endless <span className="gradient-text">Possibilities</span></h2>
        <div className="use-case-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem' }}>
          <TiltCard className="use-case-card" style={{ padding: '2.5rem', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
              <div className="use-case-tag" style={{ border: '1px solid var(--accent-neon)', color: 'var(--accent-neon)', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.7rem' }}>WORKSPACE</div>
              <div style={{ display: 'flex', gap: '4px' }}><div className="status-dot"></div><div className="status-dot"></div><div className="status-dot"></div></div>
            </div>
            <div className="use-case-cmd" style={{ fontFamily: 'monospace', fontSize: '1.2rem', color: 'white', lineHeight: '1.4' }}>"Merky, open my VS Code workspace, start Spotify focus playlist, and turn on Do Not Disturb."</div>
          </TiltCard>
          
          <TiltCard className="use-case-card" style={{ padding: '2.5rem', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
              <div className="use-case-tag" style={{ border: '1px solid var(--accent-neon)', color: 'var(--accent-neon)', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.7rem' }}>RESEARCH</div>
              <div style={{ display: 'flex', gap: '4px' }}><div className="status-dot"></div><div className="status-dot"></div><div className="status-dot"></div></div>
            </div>
            <div className="use-case-cmd" style={{ fontFamily: 'monospace', fontSize: '1.2rem', color: 'white', lineHeight: '1.4' }}>"Search for the best mechanical keyboards under $200 and create a summary in my Notion."</div>
          </TiltCard>
          
          <TiltCard className="use-case-card" style={{ padding: '2.5rem', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
              <div className="use-case-tag" style={{ border: '1px solid var(--accent-neon)', color: 'var(--accent-neon)', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.7rem' }}>AUTOMATION</div>
              <div style={{ display: 'flex', gap: '4px' }}><div className="status-dot"></div><div className="status-dot"></div><div className="status-dot"></div></div>
            </div>
            <div className="use-case-cmd" style={{ fontFamily: 'monospace', fontSize: '1.2rem', color: 'white', lineHeight: '1.4' }}>"Check my email for today's meeting invites and add them to my Google Calendar."</div>
          </TiltCard>
          
          <TiltCard className="use-case-card" style={{ padding: '2.5rem', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
              <div className="use-case-tag" style={{ border: '1px solid var(--accent-neon)', color: 'var(--accent-neon)', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.7rem' }}>SOCIAL</div>
              <div style={{ display: 'flex', gap: '4px' }}><div className="status-dot"></div><div className="status-dot"></div><div className="status-dot"></div></div>
            </div>
            <div className="use-case-cmd" style={{ fontFamily: 'monospace', fontSize: '1.2rem', color: 'white', lineHeight: '1.4' }}>"Open Twitter and draft a post sharing the results of my latest deep work session."</div>
          </TiltCard>
        </div>
      </section>

      {/* Demo Section */}
      <section className="reveal container" style={{ padding: '120px 2rem' }}>
        <h2 className="section-title">See Merky in <span className="gradient-text">Action</span></h2>
        <div className="demo-container">
          <div className="demo-play">
            <span style={{ fontSize: '2rem', color: 'black', marginLeft: '5px' }}>▶</span>
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="reveal container" style={{ padding: '120px 2rem' }}>
        <h2 className="section-title">The Evolution of <span className="gradient-text">Assistance</span></h2>
        <div className="glass-card comparison-wrap">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Standard LLMs</th>
                <th>Traditional RPA</th>
                <th className="merky-col">Merky AI</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Conversation</td><td>Limited Context</td><td>No</td><td className="merky-col">Natural Friend</td></tr>
              <tr><td>GUI Execution</td><td>No</td><td>Fragile / Static</td><td className="merky-col">Dynamic Vision</td></tr>
              <tr><td>Learning Curve</td><td>Low (Chat only)</td><td>High (Dev only)</td><td className="merky-col">ZERO (Just Talk)</td></tr>
              <tr><td>Speed</td><td>Instant Chat</td><td>Batch Only</td><td className="merky-col">Real-time Action</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="reveal container" style={{ padding: '160px 2rem', position: 'relative' }}>
        <div className="feature-halo" style={{ top: '50%', right: '10%' }}></div>
        <div style={{ position: 'relative', zIndex: 2 }}>
          <h2 className="section-title">Simple <span className="gradient-text">Pricing</span></h2>
          <div className="pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>
            <TiltCard className="pricing-card" style={{ padding: '3rem 2rem' }}>
              <div><h3 style={{ fontSize: '1.6rem' }}>Free</h3><p className="price">$0</p></div>
              <ul className="pricing-features" style={{ margin: '2rem 0', listStyle: 'none', padding: 0 }}>
                <li style={{ marginBottom: '0.8rem', color: 'var(--text-secondary)' }}>✓ Friend Mode</li>
                <li style={{ marginBottom: '0.8rem', color: 'var(--text-secondary)' }}>✓ 5 Operator tasks / day</li>
                <li style={{ marginBottom: '0.8rem', color: 'var(--text-secondary)' }}>✓ Standard Speed</li>
              </ul>
              <button className="fx-btn-secondary" style={{ width: '100%' }}>Current Plan</button>
            </TiltCard>
            
            <TiltCard className="pricing-card featured" style={{ padding: '3.5rem 2rem', border: '1px solid var(--accent-neon)' }}>
              <div className="popular-badge" style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'var(--accent-neon)', color: 'black', padding: '0.2rem 0.8rem', borderRadius: '100px', fontSize: '0.7rem', fontWeight: 700 }}>MOST POPULAR</div>
              <div><h3 style={{ fontSize: '1.6rem' }}>Pro</h3><p className="price" style={{ color: 'var(--accent-neon)' }}>$19<span style={{ fontSize: '1rem' }}>/mo</span></p></div>
              <ul className="pricing-features" style={{ margin: '2rem 0', listStyle: 'none', padding: 0 }}>
                <li style={{ marginBottom: '0.8rem' }}>✓ Unlimited Tasks</li>
                <li style={{ marginBottom: '0.8rem' }}>✓ Voice Control</li>
                <li style={{ marginBottom: '0.8rem' }}>✓ Priority Access</li>
                <li style={{ marginBottom: '0.8rem' }}>✓ Early beta features</li>
              </ul>
              <button className="fx-btn-primary" style={{ width: '100%' }}>Join Early Access</button>
            </TiltCard>
            
            <TiltCard className="pricing-card" style={{ padding: '3rem 2rem' }}>
              <div><h3 style={{ fontSize: '1.6rem' }}>Teams</h3><p className="price">$49<span style={{ fontSize: '1rem' }}>/mo</span></p></div>
              <ul className="pricing-features" style={{ margin: '2rem 0', listStyle: 'none', padding: 0 }}>
                <li style={{ marginBottom: '0.8rem', color: 'var(--text-secondary)' }}>✓ Shared Workflows</li>
                <li style={{ marginBottom: '0.8rem', color: 'var(--text-secondary)' }}>✓ Admin Controls</li>
                <li style={{ marginBottom: '0.8rem', color: 'var(--text-secondary)' }}>✓ SSO & Security</li>
                <li style={{ marginBottom: '0.8rem', color: 'var(--text-secondary)' }}>✓ Custom Integrations</li>
              </ul>
              <button className="fx-btn-secondary" style={{ width: '100%' }}>Contact Sales</button>
            </TiltCard>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="reveal container" style={{ padding: '120px 2rem' }}>
        <h2 className="section-title">Common <span className="gradient-text">Questions</span></h2>
        <div className="faq-container">
          {[
            { q: "Is Merky safe to use?", a: "Yes. Merky is permission-gated. It will always ask before performing high-sensitivity actions and its movements are always visible on your screen." },
            { q: "Which operating systems are supported?", a: "Currently, Merky is available for macOS and Windows. A Linux version is in the works." },
            { q: "Does Merky record my screen?", a: "Merky processes visual information locally to understand your desktop, but no video files are stored or uploaded without your explicit consent." },
            { q: "Can I use Merky offline?", a: "Friend Mode works partially offline, but Operator Mode requires an internet connection to process complex intentions via our cloud-based model." }
          ].map((item, i) => (
            <div key={i} className="faq-item">
              <button className="faq-q" onClick={() => toggleFaq(i)}>
                {item.q}<span>{activeFaq === i ? '−' : '+'}</span>
              </button>
              {activeFaq === i && <div className="faq-a">{item.a}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="reveal container" style={{ padding: '160px 2rem', position: 'relative' }}>
        <div className="feature-halo" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '800px', height: '800px', opacity: 0.1 }}></div>
        <TiltCard className="final-cta-box" style={{ padding: '6rem 4rem', textAlign: 'center', border: '1px solid rgba(127, 255, 180, 0.2)' }}>
          <h2 className="fx-title" style={{ fontSize: '3.5rem', marginBottom: '1.5rem' }}>Ready to meet your AI friend?</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.3rem', marginBottom: '3.5rem', maxWidth: '650px', marginInline: 'auto', lineHeight: '1.6' }}>
            Join the waitlist today for early access to the future of computing. Experience Merky before anyone else.
          </p>
          <div className="fx-btn-container" style={{ justifyContent: 'center' }}>
            <button className="fx-btn-primary" style={{ padding: '1.2rem 3rem', fontSize: '1.1rem' }}>Join the Waitlist <span className="arrow-circle">→</span></button>
            <button className="fx-btn-secondary" style={{ padding: '1.2rem 3rem', fontSize: '1.1rem' }}>Watch Demo</button>
          </div>
        </TiltCard>
      </section>

      {/* Footer */}
      <footer className="reveal container" style={{ borderTop: '1px solid var(--border-glass)', padding: '80px 0', opacity: 0.8, position: 'relative' }}>
        <div className="bg-accent-lines"></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.9rem', width: '100%', position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <p className="logo-text" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white' }}>Merky</p>
            <p>Your AI Operator Friend.</p>
            <div className="social-links-footer" style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
              <a href="#" className="social-icon-wrapper-small"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg></a>
              <a href="#" className="social-icon-wrapper-small"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg></a>
              <a href="#" className="social-icon-wrapper-small"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg></a>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '4rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ color: 'white', fontWeight: 600 }}>Product</p>
              <a href="#features">Features</a><a href="#how-it-works">How it works</a><a href="#pricing">Pricing</a>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ color: 'white', fontWeight: 600 }}>Company</p>
              <a href="#">Privacy</a><a href="#">Terms</a><a href="#">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
