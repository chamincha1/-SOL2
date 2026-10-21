import React, { useRef, useEffect, useState } from 'react';
import { Flame, Zap, MousePointerClick, Info } from 'lucide-react';
import { PSTC } from '../physics/solarPhysics.ts';

interface WaveformChartsProps {
  history: Array<[number, number, number, number, number, number]>; // [time, hot, P, Pid, Ph, Precovered]
  elapsedTime: number;
  maxT: number;
}

export const WaveformCharts: React.FC<WaveformChartsProps> = ({
  history,
  elapsedTime,
  maxT,
}) => {
  // Active chart view: 'temp' (온도 파형) or 'power' (발전 출력 및 회복 전력 파형)
  const [activeView, setActiveView] = useState<'temp' | 'power'>('temp');

  // Hover inspection state
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Mouse move handler over the chart
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || history.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) * 600) / rect.width;
    const L = 50;
    const R = 15;

    if (x < L || x > 600 - R) {
      setHoverIndex(null);
      return;
    }

    const xmax = Math.max(60, Math.ceil(elapsedTime / 60) * 60);
    const hoverTime = ((x - L) / (600 - L - R)) * xmax;

    // Find closest index in history array
    let closestIdx = 0;
    let minDiff = 1e9;
    for (let i = 0; i < history.length; i++) {
      const diff = Math.abs(history[i][0] - hoverTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }
    setHoverIndex(closestIdx);
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  // Render chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const W = 600;
    const H = 220;
    if (canvas.width !== W * 2) {
      canvas.width = W * 2;
      canvas.height = H * 2;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const L = 50;
    const R = 15;
    const T = 15;
    const B = 28;

    const isTemp = activeView === 'temp';
    const ymin = 0;
    const ymax = isTemp
      ? Math.max(160, Math.min(400, Math.ceil(maxT / 50) * 50 + 50))
      : Math.ceil(PSTC / 50) * 50 + 20;

    const xmin = 0;
    const xmax = Math.max(60, Math.ceil(elapsedTime / 60) * 60);

    const X = (v: number) => L + ((v - xmin) / (xmax - xmin)) * (W - L - R);
    const Y = (v: number) => T + (1 - (v - ymin) / (ymax - ymin)) * (H - T - B);

    ctx.font = '11px -apple-system, sans-serif';

    // 1. Grid lines and Y-axis labels
    for (let k = 0; k <= 4; k++) {
      const v = ymin + ((ymax - ymin) * k) / 4;
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(L, Y(v));
      ctx.lineTo(W - R, Y(v));
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(v)}`, L - 6, Y(v) + 4);
    }

    // 2. X-axis label
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748b';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText('시간 (초, s)', W / 2 + 15, H - 6);

    // 3. Temperature Threshold lines (Only in Temperature view)
    if (isTemp) {
      const thresholds = [
        { temp: 85, label: '85℃ (스마트 바이패스 감지 임계)', color: '#10b981' },
        { temp: 130, label: '130℃ (봉지재 열화 위험선)', color: '#f59e0b' },
        { temp: 300, label: '300℃ (발화 위험선)', color: '#ef4444' },
      ];

      for (const th of thresholds) {
        if (th.temp <= ymax) {
          ctx.strokeStyle = th.color;
          ctx.setLineDash([5, 5]);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(L, Y(th.temp));
          ctx.lineTo(W - R, Y(th.temp));
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = th.color;
          ctx.textAlign = 'left';
          ctx.font = '10px sans-serif';
          ctx.fillText(th.label, L + 8, Y(th.temp) - 4);
        }
      }
    }

    // 4. Waveforms
    if (history.length > 0) {
      if (isTemp) {
        // Temperature curve (bold red-orange line with soft area fill)
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        history.forEach((pt, j) => {
          const px = X(pt[0]);
          const py = Y(Math.min(ymax, Math.max(ymin, pt[1])));
          if (j === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      } else {
        // Power curves: Ideal (dashed gray), Output (solid blue), Recovered Gain (solid emerald)
        // 1. Ideal
        ctx.strokeStyle = '#64748b';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        history.forEach((pt, j) => {
          const px = X(pt[0]);
          const py = Y(Math.min(ymax, Math.max(ymin, pt[3])));
          if (j === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
        ctx.setLineDash([]);

        // 2. Actual Power P
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        history.forEach((pt, j) => {
          const px = X(pt[0]);
          const py = Y(Math.min(ymax, Math.max(ymin, pt[2])));
          if (j === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();

        // 3. Recovered Power Gain
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        history.forEach((pt, j) => {
          const px = X(pt[0]);
          const py = Y(Math.min(ymax, Math.max(ymin, pt[5])));
          if (j === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      }

      // 5. Hover Crosshair line
      if (hoverIndex !== null && hoverIndex >= 0 && hoverIndex < history.length) {
        const hoverPt = history[hoverIndex];
        const hx = X(hoverPt[0]);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(hx, T);
        ctx.lineTo(hx, H - B);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw dot on the active curve
        const hy = isTemp ? Y(hoverPt[1]) : Y(hoverPt[2]);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(hx, hy, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isTemp ? '#ef4444' : '#38bdf8';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }, [history, elapsedTime, maxT, activeView, hoverIndex]);

  // Active hover data details
  const inspectedData =
    hoverIndex !== null && hoverIndex >= 0 && hoverIndex < history.length
      ? history[hoverIndex]
      : history.length > 0
      ? history[history.length - 1]
      : null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3.5">
      {/* Header and View Toggle Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <span>실시간 대형 수치 해석 파형 (Interactive Waveform Inspector)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            마우스를 차트 위에 올리면 특정 시각의 온도 및 발전 수치를 정밀하게 확인할 수 있습니다.
          </p>
        </div>

        {/* View Switcher: Temperature vs Power */}
        <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
          <button
            onClick={() => {
              setActiveView('temp');
              setHoverIndex(null);
            }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeView === 'temp'
                ? 'bg-red-950/80 text-red-300 border border-red-800/80 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-red-400" />
            <span>최고 핫스팟 온도 뷰</span>
          </button>

          <button
            onClick={() => {
              setActiveView('power');
              setHoverIndex(null);
            }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeView === 'power'
                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>발전 출력 & 회복 전력 뷰</span>
          </button>
        </div>
      </div>

      {/* Floating Hover Data Inspection Card */}
      {inspectedData && (
        <div className="bg-slate-950/90 border border-cyan-500/30 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono shadow-md">
          <div className="flex items-center space-x-2 text-slate-300">
            <span className="text-[11px] text-slate-400 font-sans">
              {hoverIndex !== null ? '🔍 검측 시각:' : '⏱ 현재 시각:'}
            </span>
            <strong className="text-cyan-400 text-sm">{inspectedData[0].toFixed(1)}초</strong>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div>
              <span className="text-slate-400 text-[11px] mr-1 font-sans">최고 핫스팟 온도:</span>
              <strong className={inspectedData[1] >= 130 ? 'text-red-400 font-bold' : inspectedData[1] >= 85 ? 'text-amber-300' : 'text-emerald-400'}>
                {inspectedData[1].toFixed(1)} ℃
              </strong>
            </div>

            <div>
              <span className="text-slate-400 text-[11px] mr-1 font-sans">발전 출력:</span>
              <strong className="text-white">{inspectedData[2].toFixed(1)} W</strong>
            </div>

            <div>
              <span className="text-emerald-400 text-[11px] mr-1 font-sans">회복 전력량:</span>
              <strong className="text-emerald-300 font-bold">+{inspectedData[5].toFixed(1)} W</strong>
            </div>

            <div>
              <span className="text-slate-400 text-[11px] mr-1 font-sans">이상치:</span>
              <span className="text-slate-400">{inspectedData[3].toFixed(0)} W</span>
            </div>

            <div>
              <span className="text-slate-400 text-[11px] mr-1 font-sans">핫스팟 손실:</span>
              <span className="text-orange-400 font-bold">{inspectedData[4].toFixed(1)} W</span>
            </div>
          </div>
        </div>
      )}

      {/* Big Canvas Container */}
      <div className="bg-slate-950 rounded-xl border border-slate-800 p-2 overflow-hidden shadow-inner flex justify-center relative">
        <canvas
          ref={canvasRef}
          className="w-full max-w-[620px] aspect-[600/220] cursor-crosshair select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
      </div>

      {/* Legend & Guide note */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 px-1">
        {activeView === 'temp' ? (
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center space-x-1.5 text-red-400 font-medium">
              <span className="w-3 h-0.5 bg-red-500 inline-block" />
              <span>최고 핫스팟 온도 (℃)</span>
            </span>
            <span className="text-emerald-400">--- 85℃ 감지</span>
            <span className="text-amber-400">--- 130℃ 봉지재 열화</span>
            <span className="text-red-400">--- 300℃ 발화 위험</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center space-x-1.5 text-cyan-400 font-medium">
              <span className="w-3 h-0.5 bg-cyan-400 inline-block" />
              <span>실제 발전 출력 P(W)</span>
            </span>
            <span className="flex items-center space-x-1.5 text-emerald-400 font-medium">
              <span className="w-3 h-0.5 bg-emerald-400 inline-block" />
              <span>회복 전력량 Gain(W)</span>
            </span>
            <span className="text-slate-500">--- 이상값 식(1)</span>
          </div>
        )}

        <div className="text-[11px] text-slate-500 hidden sm:inline">
          마우스를 그래프 위에 올리면 시점별 수치가 상단 검측바에 실시간 표시됩니다.
        </div>
      </div>
    </div>
  );
};
