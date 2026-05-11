"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function RouteProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    // Defer state updates to avoid synchronous setState-in-effect lint errors
    const startTimer = window.setTimeout(() => {
      setVisible(true);
      setProgress(0);

      let current = 0;
      function tick() {
        current = current < 70 ? current + 8 : current < 90 ? current + 2 : current + 0.5;
        setProgress(Math.min(current, 95));
        if (current < 95) {
          timerRef.current = window.setTimeout(tick, 80);
        }
      }

      tick();
    }, 0);

    const completeTimer = window.setTimeout(() => {
      setProgress(100);
      window.setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 300);
    }, 500);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      window.clearTimeout(completeTimer);
      window.clearTimeout(startTimer);
    };
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-[2px] pointer-events-none">
      <div
        className="h-full bg-primary transition-all duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

export default RouteProgressBar;
