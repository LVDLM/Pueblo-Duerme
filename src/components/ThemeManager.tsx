import React, { useRef, useEffect } from 'react';
import rough from 'roughjs';
import { useTheme } from '../context/ThemeContext';

interface HandDrawnProps {
  children: React.ReactNode;
  className?: string;
  type?: 'box' | 'button' | 'circle';
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  roughness?: number;
  fillStyle?: 'hachure' | 'solid' | 'zigzag' | 'cross-hatch' | 'dots' | 'sunburst' | 'dashed';
}

export const HandDrawn: React.FC<HandDrawnProps> = ({
  children,
  className = '',
  type = 'box',
  fill = 'transparent',
  stroke = 'currentColor',
  strokeWidth = 1.5,
  roughness = 1.5,
  fillStyle = 'hachure',
}) => {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (theme !== 'sketchy' || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    const rc = rough.canvas(canvas);

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        ctx.clearRect(0, 0, width, height);

        if (type === 'box' || type === 'button') {
          rc.rectangle(2, 2, width - 4, height - 4, {
            stroke,
            strokeWidth,
            roughness,
            fill,
            fillStyle: fill !== 'transparent' ? fillStyle : undefined,
          });
        } else if (type === 'circle') {
          rc.circle(width / 2, height / 2, Math.min(width, height) - 4, {
            stroke,
            strokeWidth,
            roughness,
            fill,
            fillStyle: fill !== 'transparent' ? fillStyle : undefined,
          });
        }
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [theme, type, fill, stroke, strokeWidth, roughness]);

  if (theme === 'default') {
    return <div className={className}>{children}</div>;
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 0 }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export const SketchyFilters: React.FC = () => {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
      <defs>
        <filter id="pencil-filter">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" />
        </filter>
        <filter id="stain-filter">
          <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="4" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="15" />
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
      </defs>
    </svg>
  );
};

export const TornEdge: React.FC<{ position: 'top' | 'bottom'; className?: string }> = ({ position, className = '' }) => {
  const { theme } = useTheme();
  if (theme !== 'sketchy') return null;

  return (
    <div className={`absolute left-0 right-0 h-8 pointer-events-none z-20 ${position === 'top' ? 'top-0 rotate-180' : 'bottom-0'} ${className}`}>
      <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 20">
        <defs>
          <filter id="edge-wiggle">
            <feTurbulence type="fractalNoise" baseFrequency="0.1" numOctaves="2" />
            <feDisplacementMap in="SourceGraphic" scale="4" />
          </filter>
        </defs>
        <path 
          d="M0,0 L100,0 L100,10 Q50,20 0,10 Z" 
          fill="#f2ead8" 
          filter="url(#edge-wiggle)"
          className="drop-shadow-sm" 
        />
      </svg>
    </div>
  );
};

export const NotebookCorner: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { theme } = useTheme();
  if (theme !== 'sketchy') return null;

  return (
    <div className={`absolute bottom-0 right-0 w-16 h-16 pointer-events-none z-30 ${className}`}>
      <svg width="100%" height="100%" viewBox="0 0 100 100">
        {/* Shadow of the fold */}
        <path d="M100,0 L0,100 L100,100 Z" fill="rgba(0,0,0,0.1)" />
        {/* The folded paper */}
        <path d="M100,0 L100,100 L0,100 Z" fill="#e8dec5" stroke="#d6c8a8" strokeWidth="1" />
      </svg>
    </div>
  );
};

export const PaperStain: React.FC<{ className?: string; color?: string }> = ({ 
  className = '', 
  color = 'rgba(121, 85, 72, 0.08)' 
}) => {
  const { theme } = useTheme();
  const seed = useRef(Math.random() * 1000);
  if (theme !== 'sketchy') return null;

  return (
    <div className={`absolute pointer-events-none ${className}`} style={{ filter: 'url(#stain-filter)' }}>
      <svg width="100%" height="100%" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="50" fill={color} />
      </svg>
    </div>
  );
};

export const PencilSketch: React.FC<{ type: 'wolf' | 'moon' | 'skull'; className?: string }> = ({ type, className = '' }) => {
  const { theme } = useTheme();
  if (theme !== 'sketchy') return null;

  const paths = {
    wolf: "M20,60 C30,40 50,30 80,40 C70,60 50,80 20,60 M30,55 L35,50 M45,52 L50,48",
    moon: "M20,50 A30,30 0 1,1 80,50 A20,20 0 1,0 20,50",
    skull: "M30,30 Q30,10 50,10 Q70,10 70,30 L70,60 Q70,75 50,75 Q30,75 30,60 Z M40,40 A5,5 0 1,0 40.1,40 M60,40 A5,5 0 1,0 60.1,40",
  };

  return (
    <svg 
      viewBox="0 0 100 100" 
      className={`pointer-events-none transition-opacity ${className}`} 
      style={{ filter: 'url(#pencil-filter)', opacity: 0.6 }}
    >
       <path 
         d={paths[type]} 
         fill="none" 
         stroke="currentColor" 
         strokeWidth="2" 
         strokeLinecap="round"
       />
    </svg>
  );
};

export const Scribble: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { theme } = useTheme();
  if (theme !== 'sketchy') return null;

  return (
    <svg 
      viewBox="0 0 100 100" 
      className={`absolute pointer-events-none ${className}`} 
      style={{ filter: 'url(#pencil-filter)', opacity: 0.3 }}
    >
      <path 
        d="M10,20 Q30,10 50,20 T90,20 M20,40 C40,30 60,50 80,40" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="1" 
        strokeDasharray="2 2"
      />
    </svg>
  );
};
