import { useEffect, useRef } from 'react';
import { createHeroBlobScene } from './heroBlob/createHeroBlobScene';

const GlassBlobHeroBackground = () => {
  const mountRef = useRef(null);

  useEffect(() => {
    if (!mountRef.current) {
      return undefined;
    }

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sceneController = createHeroBlobScene({
      mount: mountRef.current,
      reducedMotion: reducedMotionQuery.matches,
    });

    const handleMotionChange = (event) => {
      sceneController.setReducedMotion(event.matches);
    };

    reducedMotionQuery.addEventListener('change', handleMotionChange);

    return () => {
      reducedMotionQuery.removeEventListener('change', handleMotionChange);
      sceneController.dispose();
    };
  }, []);

  return <div ref={mountRef} className="hero-blob-layer" aria-hidden="true" />;
};

export default GlassBlobHeroBackground;
