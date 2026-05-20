import React, { useRef, useEffect } from 'react';
import rough from 'roughjs';
import { useTheme } from '../context/ThemeContext';

// ─── Night Theme: Canvas fractal de fondo ───────────────────────────────────
export const NightFractalBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let pointObject: Record<string, { r: number; g: number; b: number }> = {};
    let nowMax = 2;
    const init = () => {
      pointObject = {}; nowMax = 2;
      for (let i = 0; i <= nowMax; i++)
        for (let j = 0; j <= nowMax; j++)
          pointObject[`${i}#${j}`] = { r: Math.random(), g: Math.random(), b: Math.random() };
    };
    const doStep = () => {
      const nObj: typeof pointObject = {};
      for (const k in pointObject) {
        const [px, py] = k.split('#').map(Number);
        nObj[`${px * 2}#${py * 2}`] = pointObject[k];
      }
      nowMax *= 2;
      for (const k in nObj) {
        const [x, y] = k.split('#').map(Number);
        if (x !== nowMax && y !== nowMax) {
          const x2 = x + 2, y2 = y + 2;
          const a = nObj[k], b = nObj[`${x2}#${y}`], c = nObj[`${x}#${y2}`], d = nObj[`${x2}#${y2}`];
          nObj[`${x+1}#${y}`] = {r:0,g:0,b:0}; nObj[`${x}#${y+1}`] = {r:0,g:0,b:0};
          nObj[`${x2}#${y+1}`] = {r:0,g:0,b:0}; nObj[`${x+1}#${y2}`] = {r:0,g:0,b:0};
          nObj[`${x+1}#${y+1}`] = {r:0,g:0,b:0};
          for (const ch of ['r','g','b'] as const) {
            const avg = (a[ch]+b[ch]+c[ch]+d[ch])/4;
            nObj[`${x+1}#${y}`][ch] = Math.random()<.5?(a[ch]+avg)/2:(b[ch]+avg)/2;
            nObj[`${x}#${y+1}`][ch] = Math.random()<.5?(a[ch]+avg)/2:(c[ch]+avg)/2;
            nObj[`${x2}#${y+1}`][ch] = Math.random()<.5?(b[ch]+avg)/2:(d[ch]+avg)/2;
            nObj[`${x+1}#${y2}`][ch] = Math.random()<.5?(c[ch]+avg)/2:(d[ch]+avg)/2;
            nObj[`${x+1}#${y+1}`][ch] = Math.random()<.5?(Math.random()<.5?a[ch]:b[ch]):(Math.random()<.5?c[ch]:d[ch]);
          }
        }
      }
      pointObject = nObj;
    };
    const draw = () => {
      const w = window.innerWidth, h = window.innerHeight;
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const cellW = Math.ceil(w/(nowMax+1)), cellH = Math.ceil(h/(nowMax+1));
      for (const k in pointObject) {
        const [px,py] = k.split('#').map(Number);
        const pt = pointObject[k];
        ctx.fillStyle = `rgb(${Math.round(pt.r*25+3)},${Math.round(pt.g*15+3)},${Math.round(pt.b*45+15)})`;
        ctx.fillRect(px*cellW, py*cellH, cellW+1, cellH+1);
      }
      const grad = ctx.createRadialGradient(w*.5,h*.65,0,w*.5,h*.65,w*.55);
      grad.addColorStop(0,'rgba(70,35,5,0.15)'); grad.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=grad; ctx.fillRect(0,0,w,h);
    };
    init(); for (let i=0;i<7;i++) doStep(); draw();
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return (
    <canvas ref={canvasRef} style={{
      position:'fixed',inset:0,width:'100%',height:'100%',
      pointerEvents:'none',zIndex:0,opacity:0.2,
      imageRendering:'pixelated',mixBlendMode:'screen' as any,
    }} />
  );
};

export const NightDivider: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex items-center gap-3 my-2 ${className}`}>
    <div className="flex-1 h-px" style={{background:'linear-gradient(90deg,transparent,#3d2a14)'}}/>
    <svg width="18" height="10" viewBox="0 0 18 10">
      <path d="M9 0 L11 5 L9 10 L7 5 Z" fill="#5a3d1a" opacity="0.8"/>
      <circle cx="9" cy="5" r="1.5" fill="#d4860a" opacity="0.7"/>
    </svg>
    <div className="flex-1 h-px" style={{background:'linear-gradient(90deg,#3d2a14,transparent)'}}/>
  </div>
);

export const NightTorches: React.FC = () => (
  <>
    {([{l:'4%',d:'0s'},{l:'96%',d:'0.5s'}] as const).map((t,i)=>(
      <div key={i} style={{
        position:'fixed',top:'10%',left:t.l,transform:'translateX(-50%)',
        pointerEvents:'none',zIndex:2,
        animation:`torchFlicker 2.8s ${t.d} ease-in-out infinite`,
      }}>
        <svg width="12" height="28" viewBox="0 0 12 28">
          <rect x="4" y="16" width="4" height="12" rx="1" fill="#3a1f08"/>
          <ellipse cx="6" cy="14" rx="4" ry="6" fill="#e05010" opacity="0.75"/>
          <ellipse cx="6" cy="11" rx="2.5" ry="4" fill="#f08030" opacity="0.65"/>
          <ellipse cx="6" cy="9" rx="1.5" ry="2.5" fill="#ffe060" opacity="0.5"/>
        </svg>
      </div>
    ))}
  </>
);

interface HandDrawnProps {
  children: React.ReactNode;
  className?: string;
  type?: 'box' | 'button' | 'circle';
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  roughness?: number;
  fillStyle?: 'hachure' | 'solid' | 'zigzag' | 'cross-hatch' | 'dots' | 'sunburst' | 'dashed';
  style?: React.CSSProperties;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

export const HandDrawn: React.FC<HandDrawnProps> = (props) => {
  const {
    children,
    className = '',
    type = 'box',
    fill = 'transparent',
    stroke = 'currentColor',
    strokeWidth = 1.5,
    roughness = 1.5,
    fillStyle = 'hachure',
    style,
    onClick,
  } = props;
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

  if (theme === 'default' || theme === 'night') {
    return <div className={className} style={style} onClick={onClick}>{children}</div>;
  }

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`} style={style} onClick={onClick}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 0, display: 'block' }}
      />
      <div className="relative" style={{ zIndex: 1 }}>{children}</div>
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
          fill="#f0e6d0" 
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
        <path d="M100,0 L0,100 L100,100 Z" fill="rgba(0,0,0,0.12)" />
        {/* The folded paper */}
        <path d="M100,0 L100,100 L0,100 Z" fill="#e0d0b5" stroke="#c8b890" strokeWidth="1" />
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
