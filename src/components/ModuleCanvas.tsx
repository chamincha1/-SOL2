import React, { useRef, useEffect } from 'react';
import {
  CircuitDefenseMode,
  CoolingMode,
  SimulationMetrics,
  SimStateInternal,
  ShadingMaterialType,
} from '../types/solar.ts';
import { N_CELLS } from '../physics/solarPhysics.ts';

interface ModuleCanvasProps {
  simState: SimStateInternal;
  metrics: SimulationMetrics | null;
  shade: number[];
  defect: boolean[];
  cellMaterials: Array<ShadingMaterialType | null>;
  circuitMode: CircuitDefenseMode;
  coolingMode: CoolingMode;
  activeMaterial: ShadingMaterialType;
  onCellClick: (index: number) => void;
}

export const ModuleCanvas: React.FC<ModuleCanvasProps> = ({
  simState,
  metrics,
  shade,
  defect,
  cellMaterials,
  circuitMode,
  coolingMode,
  activeMaterial,
  onCellClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isPointerDownRef = useRef(false);

  // Paint cell under mouse / touch coordinates
  const handlePointerAction = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) * 600) / rect.width - 12;
    const y = ((e.clientY - rect.top) * 330) / rect.height - 14;

    const col = Math.floor(x / 52);
    const row = Math.floor(y / 47);

    if (col < 0 || col > 9 || row < 0 || row > 5 || x % 52 > 46 || y % 47 > 42) {
      return;
    }

    const index = row * 10 + col;
    if (index >= 0 && index < N_CELLS) {
      onCellClick(index);
    }
  };

  // Draw 60-cell photovoltaic module
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const W = 600;
    const H = 330;
    if (canvas.width !== W * 2) {
      canvas.width = W * 2;
      canvas.height = H * 2;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const tm = metrics ? metrics.tm : 25;

    // 1. Draw 60 solar cells
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';

    for (let i = 0; i < N_CELLS; i++) {
      const row = Math.floor(i / 10);
      const col = i % 10;
      const px = 12 + col * 52;
      const py = 14 + row * 47;
      const cellW = 46;
      const cellH = 42;

      // Base silicon cell color (deep blue monocrystalline)
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(px, py, cellW, cellH);

      // Shading overlay
      if (shade[i] > 0) {
        ctx.fillStyle = `rgba(10, 15, 29, ${shade[i] * 0.82})`;
        ctx.fillRect(px, py, cellW, cellH);
      }

      // Thermal gradient overlay
      const cellTemp = simState.T[i];
      const tempDelta = cellTemp - tm;
      const heatFactor = Math.min(1, Math.max(0, tempDelta / 150));

      if (heatFactor > 0.015) {
        ctx.globalAlpha = Math.min(1, heatFactor * 3.8 + 0.18);
        const hue = Math.max(0, 52 - 52 * heatFactor);
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        ctx.fillRect(px, py, cellW, cellH);
        ctx.globalAlpha = 1;
      }

      // Busbars / gridlines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px + 23, py);
      ctx.lineTo(px + 23, py + cellH);
      ctx.stroke();

      // Specific Material Glyphs
      const mat = cellMaterials[i];
      if (mat === 'bird') {
        // Draw bird dropping white/gray splatter
        ctx.fillStyle = 'rgba(241, 245, 249, 0.85)';
        ctx.beginPath();
        ctx.arc(px + 14, py + 14, 5, 0, Math.PI * 2);
        ctx.arc(px + 20, py + 18, 4, 0, Math.PI * 2);
        ctx.arc(px + 12, py + 22, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '10px sans-serif';
        ctx.fillText('🦅', px + 34, py + 14);
      } else if (mat === 'leaves') {
        // Draw autumn leaf glyph
        ctx.fillStyle = 'rgba(217, 119, 6, 0.9)';
        ctx.font = '11px sans-serif';
        ctx.fillText('🍂', px + 14, py + 14);
      } else if (mat === 'cloud') {
        // Draw cloud glyph
        ctx.fillStyle = 'rgba(148, 163, 184, 0.9)';
        ctx.font = '10px sans-serif';
        ctx.fillText('☁', px + 12, py + 13);
      }

      // Defect marker (microcrack)
      if (defect[i]) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(px + 8, py + 6);
        ctx.lineTo(px + 23, py + 21);
        ctx.lineTo(px + 17, py + 36);
        ctx.stroke();
        ctx.lineWidth = 1;

        ctx.fillStyle = '#f87171';
        ctx.font = '10px sans-serif';
        ctx.fillText('⚡', px + 36, py + 14);
      }

      // Shading percentage text
      ctx.fillStyle = '#ffffff';
      if (shade[i] > 0) {
        ctx.font = '10px monospace';
        ctx.fillText(`${Math.round(shade[i] * 100)}%`, px + 23, py + 24);
      }

      // Highlight hottest cell
      if (metrics && i === metrics.hi && tempDelta > 8) {
        const isDangerous = cellTemp >= 130;
        ctx.strokeStyle = isDangerous ? '#ef4444' : '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(px + 1, py + 1, cellW - 2, cellH - 2);
        ctx.lineWidth = 1;

        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = isDangerous ? '#fca5a5' : '#ffffff';
        ctx.fillText(`${Math.round(cellTemp)}℃`, px + 23, py + 36);
      }
    }

    // 2. Substring Bypass Diodes (D1, D2, D3 on the right edge)
    ctx.textAlign = 'left';
    for (let s = 0; s < 3; s++) {
      const isDiodeOn = metrics ? metrics.dOn[s] === 1 : false;
      const y = 14 + s * 94;
      const boxW = 50;
      const boxH = 84;

      ctx.fillStyle = isDiodeOn ? 'rgba(239, 68, 68, 0.15)' : 'rgba(30, 41, 59, 0.6)';
      ctx.fillRect(538, y, boxW, boxH);

      ctx.strokeStyle = isDiodeOn ? '#ef4444' : '#475569';
      ctx.lineWidth = isDiodeOn ? 2.5 : 1.5;
      ctx.strokeRect(538, y, boxW, boxH);
      ctx.lineWidth = 1;

      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = isDiodeOn ? '#ef4444' : '#94a3b8';
      ctx.fillText(`D${s + 1}`, 546, y + 32);

      ctx.font = '10px sans-serif';
      ctx.fillStyle = isDiodeOn ? '#f87171' : '#64748b';
      ctx.fillText(isDiodeOn ? '도통 (ON)' : '차단 (OFF)', 542, y + 54);
    }

    // 3. Smart Bypass 12 Groups Indicators
    if (circuitMode === 'smart') {
      for (let g = 0; g < 12; g++) {
        const isBypassed = simState.arm[g];
        const gx = 12 + (g % 2) * 260 + 7;
        const gy = 14 + Math.floor(g / 2) * 47 + 7;

        ctx.fillStyle = isBypassed ? '#10b981' : 'rgba(100, 116, 139, 0.5)';
        ctx.beginPath();
        ctx.arc(gx, gy, isBypassed ? 5.5 : 4, 0, Math.PI * 2);
        ctx.fill();

        if (isBypassed) {
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.lineWidth = 1;
        }
      }
    }

    // 4. DC Optimizer Indicator
    if (circuitMode === 'optimizer') {
      ctx.fillStyle = 'rgba(139, 92, 246, 0.9)';
      ctx.font = '10px sans-serif';
      ctx.fillText('⚡ MLPE DC Optimizer Active (98.5% Eff)', 14, H - 8);
    }

    // 5. Active Cooling visual badge
    if (coolingMode !== 'natural') {
      let coolLabel = '';
      let coolColor = '';
      if (coolingMode === 'passive-heatsink') {
        coolLabel = '❄ 후면 알루미늄 방열판 + PCM 상변화물질 장착';
        coolColor = '#34d399';
      } else if (coolingMode === 'active-water') {
        coolLabel = '💧 능동 수냉 순환 스프레이 작동 중 (U0=55, Rth=1.1)';
        coolColor = '#38bdf8';
      } else if (coolingMode === 'active-air') {
        coolLabel = '💨 강제 공랭팬 대류 냉각 가동 중 (U1=16.5)';
        coolColor = '#a78bfa';
      }

      ctx.fillStyle = coolColor;
      ctx.font = '10px sans-serif';
      ctx.fillText(coolLabel, 260, H - 8);
    }
  }, [simState, metrics, shade, defect, cellMaterials, circuitMode, coolingMode]);

  const activeMaterialLabel =
    activeMaterial === 'bird'
      ? '🦅 새 분변 부착 모드'
      : activeMaterial === 'leaves'
      ? '🍂 낙엽 부착 모드'
      : activeMaterial === 'cloud'
      ? '☁ 구름 그림자 모드'
      : activeMaterial === 'defect'
      ? '⚡ 제조 결함(미세균열) 모드'
      : '🧼 세척 / 지우개 모드';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <span>60셀 태양광 모듈 (10×6) 물리 인터랙티브 캔버스</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              원하는 셀을 클릭·드래그하여 현재 선택된 물질(
              <strong className="text-cyan-300">{activeMaterialLabel}</strong>
              )을 도장처럼 직접 배치하세요.
            </p>
          </div>
          <div className="flex items-center space-x-2 text-xs font-mono">
            <span className="text-slate-400">모듈 기본 온도:</span>
            <span className="text-amber-400 font-bold">{metrics ? metrics.tm.toFixed(1) : 25}°C</span>
          </div>
        </div>

        {/* Canvas Element */}
        <div className="relative bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-inner flex justify-center">
          <canvas
            ref={canvasRef}
            className="w-full max-w-[620px] aspect-[600/330] cursor-crosshair select-none touch-none"
            onPointerDown={(e) => {
              isPointerDownRef.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              handlePointerAction(e);
            }}
            onPointerMove={(e) => {
              if (isPointerDownRef.current) {
                handlePointerAction(e);
              }
            }}
            onPointerUp={() => {
              isPointerDownRef.current = false;
            }}
            onPointerCancel={() => {
              isPointerDownRef.current = false;
            }}
          />
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-y-1.5 px-1">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#1e3a8a] inline-block border border-blue-400/40" />
            <span>정상 발전</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-yellow-500 inline-block" />
            <span>미온 (40~65°C)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-orange-600 inline-block" />
            <span>핫스팟 (70~95°C)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-600 inline-block animate-pulse" />
            <span>봉지재 열화 위험 (&gt;130°C)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <span>스마트 도통 점</span>
          </div>
        </div>
      </div>

      {/* Substring Status Banner */}
      <div className="mt-3.5 p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 text-xs flex flex-wrap items-center justify-between gap-2 font-mono">
        <div className="flex items-center space-x-3 text-slate-300">
          <span>
            전류: <strong className="text-amber-400">{metrics ? metrics.I.toFixed(2) : 0} A</strong>
          </span>
          <span>
            전압: <strong className="text-cyan-400">{metrics ? metrics.V.toFixed(1) : 0} V</strong>
          </span>
          <span>
            다이오드: <strong className="text-red-400">{metrics ? metrics.diodeOnCount : 0}/3</strong>
          </span>
          {circuitMode === 'smart' && (
            <span>
              스마트 스위치: <strong className="text-emerald-400">{metrics ? metrics.smartOnCount : 0}/12</strong>
            </span>
          )}
        </div>
        <div className="text-[11px] text-slate-400">
          {circuitMode === 'smart'
            ? '5셀 그룹 능동 감지·우회 활성'
            : circuitMode === 'diode'
            ? '20셀 수동 바이패스'
            : circuitMode === 'optimizer'
            ? '개별 셀군 임피던스 분리'
            : '무보호 (직렬 손실 전파)'}
        </div>
      </div>
    </div>
  );
};
