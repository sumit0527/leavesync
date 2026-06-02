import { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 300);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function scrollUp() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (!visible) return null;

  return (
    <button
      onClick={scrollUp}
      aria-label="Scroll to top"
      className="fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full border-2 border-primary bg-card/90 backdrop-blur-sm flex items-center justify-center text-primary shadow-lg hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all duration-300"
    >
      <ArrowUp className="w-5 h-5" />
    </button>
  );
}
