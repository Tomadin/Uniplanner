import { useState, useEffect } from 'react';

export function useResponsive() {
  const [s, setS] = useState({
    mobile: window.innerWidth < 768,
    tablet: window.innerWidth < 1024,
  });
  useEffect(() => {
    const h = () => setS({ mobile: window.innerWidth < 768, tablet: window.innerWidth < 1024 });
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return s;
}
