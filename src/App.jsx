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

// Floating HUD elements that drift AND cycle content
const FloatingHUD = () => {
  const [elements, setElements] = useState([]);

  useEffect(() => {
    const initialElements = Array.from({ length: 8 }).map((_, i) => ({
      id: `hud-${i}-${Date.now()}`,
      ...HUD_POOL[Math.floor(Math.random() * HUD_POOL.length)],
      top: 15 + Math.random() * 70,
      left: 5 + Math.random() * 90,
      depth: 0.2 + Math.random() * 0.4,
      floatDuration: 12 + Math.random() * 8,
      floatDelay: Math.random() * -20,
      phase: 'visible', // 'visible' | 'fading-out' | 'fading-in'
    }));
    setElements(initialElements);

    // Every 3s, pick one element to fade-out then replace
    const interval = setInterval(() => {
      setElements(prev => {
        const newArr = [...prev];
        // Find a visible element to cycle
        const visibleIdxs = newArr.map((el, i) => el.phase === 'visible' ? i : -1).filter(i => i !== -1);
        if (visibleIdxs.length === 0) return newArr;
        const idx = visibleIdxs[Math.floor(Math.random() * visibleIdxs.length)];
        newArr[idx] = { ...newArr[idx], phase: 'fading-out' };
        return newArr;
      });

      // After fade-out completes (600ms), swap content and fade back in
      setTimeout(() => {
        setElements(prev => {
          const newArr = [...prev];
          const idx = newArr.findIndex(el => el.phase === 'fading-out');
          if (idx === -1) return newArr;
          newArr[idx] = {
            ...newArr[idx],
            id: `hud-${idx}-${Date.now()}`,
            ...HUD_POOL[Math.floor(Math.random() * HUD_POOL.length)],
            top: 15 + Math.random() * 70,
            left: 5 + Math.random() * 90,
            phase: 'fading-in',
          };
          return newArr;
        });

        // After fade-in completes, mark visible
        setTimeout(() => {
          setElements(prev => prev.map(el => el.phase === 'fading-in' ? { ...el, phase: 'visible' } : el));
        }, 600);
      }, 600);
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {elements.map((el) => (
        <div
          key={el.id}
          className={`${el.type === 'box' ? 'hud-box' : 'math-symbol'} parallax-layer hud-float`}
          style={{
            top: `${el.top}%`,
            left: `${el.left}%`,
            '--depth': el.depth,
            '--float-dur': `${el.floatDuration}s`,
            '--float-delay': `${el.floatDelay}s`,
            opacity: el.phase === 'fading-out' ? 0 : el.phase === 'fading-in' ? 0.4 : undefined,
            transform: el.phase === 'fading-out' ? 'scale(0.7) translateY(15px)' : undefined,
            transition: 'opacity 0.6s ease, transform 0.6s ease',
          }}
        >
          {el.content}
        </div>
      ))}
    </>
  );
};

// Per-particle interactive system
const ParticleField = ({ heroRef }) => {
  const particlesRef = useRef([]);
  const containerRef = useRef(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const rafRef = useRef(null);

  // Generate stable particle data once
  const particleData = useRef(
    Array.from({ length: 40 }).map(() => ({
      ox: 0, oy: 0, // offset from repulsion
      size: 2 + Math.random() * 4,
      tx: (Math.random() - 0.5) * 800,
      ty: (Math.random() - 0.5) * 400,
      delay: Math.random() * 6,
      duration: 4 + Math.random() * 4,
    }))
  ).current;

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left - rect.width / 2,
        y: e.clientY - rect.top - rect.height / 2,
      };
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Animation loop for per-particle repulsion
    const animate = () => {
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      particlesRef.current.forEach((el, i) => {
        if (!el) return;
        const data = particleData[i];
        const rect = el.getBoundingClientRect();
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (!containerRect) return;

        // Particle position relative to center of emitter
        const px = rect.left + rect.width / 2 - containerRect.left - containerRect.width / 2;
        const py = rect.top + rect.height / 2 - containerRect.top - containerRect.height / 2;

        const dx = px - mx;
        const dy = py - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 200; // repulsion radius in px

        if (dist < maxDist && dist > 0) {
          const force = (1 - dist / maxDist) * 60; // max 60px push
          const angle = Math.atan2(dy, dx);
          data.ox += (Math.cos(angle) * force - data.ox) * 0.1;
          data.oy += (Math.sin(angle) * force - data.oy) * 0.1;
        } else {
          // Spring back
          data.ox *= 0.92;
          data.oy *= 0.92;
        }

        el.style.translate = `${data.ox}px ${data.oy}px`;
      });

      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} className="particle-emitter-center">
      {particleData.map((p, i) => (
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

const App = () => {
  const [activeFaq, setActiveFaq] = useState(null);
  const heroRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
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

    const revealElements = document.querySelectorAll('.reveal');
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
      <nav className="navbar reveal">
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
          <div className="meta-badge-text reveal" style={{ '--delay': '0.1s' }}>
            Meet <span>Merky</span>
          </div>
          <h1 className="fx-title reveal" style={{ '--delay': '0.3s' }}>
            Your animated AI friend<br />
            that can operate your computer
          </h1>
          <div className="feature-row-fx reveal" style={{ '--delay': '0.5s' }}>
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
          <div className="fx-btn-container reveal" style={{ '--delay': '0.7s' }}>
            <button className="fx-btn-primary">
              Get Early Access <span className="arrow-circle">→</span>
            </button>
            <button className="fx-btn-secondary">Watch Demo</button>
          </div>
        </div>

        <div className="hero-footer-hints reveal" style={{ '--delay': '1s' }}>
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

      {/* Feature Section (PRESERVED) */}
      <section id="features" className="reveal container" style={{ padding: '120px 2rem' }}>
        <h2 className="section-title">Designed for <span className="gradient-text">Freedom</span></h2>
        <div className="problem-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>
          <div className="glass-card" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-neon)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="fx-icon-large"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <h3>Friend Mode</h3>
            <p style={{ color: 'var(--text-secondary)' }}>Talk naturally, react, and keep you company throughout the day.</p>
          </div>
          <div className="glass-card" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-neon)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="fx-icon-large"><rect width="16" height="10" x="4" y="11" rx="2"/><path d="M12 11V7"/><path d="M12 7V3"/><path d="M9 3h6"/><circle cx="10" cy="15" r="1"/><circle cx="14" cy="15" r="1"/><circle cx="12" cy="17" r="1"/></svg>
            </div>
            <h3>Operator Mode</h3>
            <p style={{ color: 'var(--text-secondary)' }}>Follow complex instructions and use your desktop interface.</p>
          </div>
          <div className="glass-card" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-neon)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="fx-icon-large"><path d="m12 14 4-4"/><path d="m3.34 7 1.66-3 9 3 8.33-4 1.67 3"/><path d="M5 21V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M10 13a2 2 0 0 0 4 0"/><path d="M12 2v3"/></svg>
            </div>
            <h3>Safe & Secure</h3>
            <p style={{ color: 'var(--text-secondary)' }}>Permission gated control with visible actions at all times.</p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="reveal container" style={{ padding: '120px 2rem', position: 'relative' }}>
        <div className="bg-accent-lines" style={{ opacity: 0.3 }}></div>
        <div style={{ position: 'relative', zIndex: 2 }}>
          <h2 className="section-title">How It <span className="gradient-text">Works</span></h2>
          <div className="how-it-works-grid">
            <div className="glass-card step-card">
              <div className="step-number">1</div>
              <h3>Tell Merky</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>Just say what you want in natural language. No complex syntax required.</p>
            </div>
            <div className="glass-card step-card">
              <div className="step-number">2</div>
              <h3>Safe Planning</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>Merky plans the safest steps to execute, asking for permission if needed.</p>
            </div>
            <div className="glass-card step-card">
              <div className="step-number">3</div>
              <h3>Watch it happen</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>Watch Merky execute the task on your screen, exactly like a human would.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="reveal container" style={{ padding: '120px 2rem' }}>
        <h2 className="section-title">Endless <span className="gradient-text">Possibilities</span></h2>
        <div className="use-case-grid">
          <div className="glass-card use-case-card">
            <div className="use-case-tag">WORKSPACE</div>
            <div className="use-case-cmd">"Merky, open my VS Code workspace, start Spotify focus playlist, and turn on Do Not Disturb."</div>
          </div>
          <div className="glass-card use-case-card">
            <div className="use-case-tag">RESEARCH</div>
            <div className="use-case-cmd">"Search for the best mechanical keyboards under $200 and create a summary in my Notion."</div>
          </div>
          <div className="glass-card use-case-card">
            <div className="use-case-tag">AUTOMATION</div>
            <div className="use-case-cmd">"Check my email for today's meeting invites and add them to my Google Calendar."</div>
          </div>
          <div className="glass-card use-case-card">
            <div className="use-case-tag">SOCIAL</div>
            <div className="use-case-cmd">"Open Twitter and draft a post sharing the results of my latest deep work session."</div>
          </div>
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
      <section id="pricing" className="reveal container" style={{ padding: '120px 2rem', position: 'relative' }}>
        <div className="bg-accent-lines" style={{ opacity: 0.3 }}></div>
        <div style={{ position: 'relative', zIndex: 2 }}>
          <h2 className="section-title">Simple <span className="gradient-text">Pricing</span></h2>
          <div className="pricing-grid">
            <div className="glass-card pricing-card">
              <div><h3>Free</h3><p className="price">$0</p></div>
              <ul className="pricing-features">
                <li>Friend Mode</li><li>5 Operator tasks / day</li><li>Standard Speed</li>
              </ul>
              <button className="fx-btn-secondary">Current Plan</button>
            </div>
            <div className="glass-card pricing-card featured">
              <div><h3>Pro</h3><p className="price">$19<span>/mo</span></p></div>
              <ul className="pricing-features">
                <li>Unlimited Tasks</li><li>Voice Control</li><li>Priority Access</li><li>Early beta features</li>
              </ul>
              <button className="fx-btn-primary">Join Early Access</button>
            </div>
            <div className="glass-card pricing-card">
              <div><h3>Teams</h3><p className="price">$49<span>/mo</span></p></div>
              <ul className="pricing-features">
                <li>Shared Workflows</li><li>Admin Controls</li><li>SSO & Security</li><li>Custom Integrations</li>
              </ul>
              <button className="fx-btn-secondary">Contact Sales</button>
            </div>
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
      <section className="reveal container" style={{ padding: '120px 2rem' }}>
        <div className="final-cta-box">
          <h2 className="fx-title">Ready to meet your AI friend?</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', marginBottom: '3rem', maxWidth: '600px', marginInline: 'auto' }}>
            Join the waitlist today for early access to the future of computing.
          </p>
          <div className="fx-btn-container">
            <button className="fx-btn-primary">Join the Waitlist <span className="arrow-circle">→</span></button>
            <button className="fx-btn-secondary">Watch Demo</button>
          </div>
        </div>
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
