import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Sparkles,
  Sliders,
  Sun,
  Thermometer,
  Wind,
  Zap,
  Layers,
  ChevronDown,
  ChevronUp,
  Flame,
  Award,
  BookOpen,
} from 'lucide-react';
import {
  ComparisonRow,
  EnvironmentState,
  SweepPoint,
  ExperimentBRow,
  ExperimentDRow,
  ExperimentBLocation,
} from '../types/solar.ts';
import {
  run300sBenchmark,
  generateShadingSweep,
  runExperimentB_Locations,
  runExperimentD_Extremes,
  get2x3BlockCells,
} from '../physics/solarPhysics.ts';

interface ComparisonLabProps {
  env: EnvironmentState;
  setEnv: React.Dispatch<React.SetStateAction<EnvironmentState>>;
  shade: number[];
  defect: boolean[];
}

export const ComparisonLab: React.FC<ComparisonLabProps> = ({
  env,
  setEnv,
  shade,
  defect,
}) => {
  // Sub-tabs: 'benchA' | 'locB' | 'extremeD'
  const [subTab, setSubTab] = useState<'benchA' | 'locB' | 'extremeD'>('benchA');

  // Benchmark A States
  const [benchRows, setBenchRows] = useState<ComparisonRow[] | null>(null);
  const [sweepPoints, setSweepPoints] = useState<SweepPoint[] | null>(null);
  const [isCalculatingA, setIsCalculatingA] = useState(false);
  const [viewMetric, setViewMetric] = useState<'temp' | 'power'>('temp');
  const sweepCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Experiment B States
  const [expBRows, setExpBRows] = useState<ExperimentBRow[] | null>(null);
  const [isCalculatingB, setIsCalculatingB] = useState(false);
  const [selectedLocFilter, setSelectedLocFilter] = useState<'all' | ExperimentBLocation>('all');
  const [selectedShadeFilter, setSelectedShadeFilter] = useState<'all' | 30 | 60 | 90>('all');

  // Experiment D States
  const [expDRows, setExpDRows] = useState<ExperimentDRow[] | null>(null);
  const [isCalculatingD, setIsCalculatingD] = useState(false);
  const [expDCategoryFilter, setExpDCategoryFilter] = useState<'all' | 'irradiance' | 'temperature' | 'wind'>('all');

  // Research Notes Accordion State
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({
    note1: true,
    note2: false,
    note3: false,
    note4: false,
    note5: false,
    note6: false,
  });

  const toggleNote = (id: string) => {
    setExpandedNotes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Run Benchmark A
  const handleRunBenchmarkA = () => {
    setIsCalculatingA(true);
    setTimeout(() => {
      const rows = run300sBenchmark(env, shade, defect);
      const sweep = generateShadingSweep(env, 25);
      setBenchRows(rows);
      setSweepPoints(sweep);
      setIsCalculatingA(false);
    }, 40);
  };

  // Run Experiment B (Location Comparison)
  const handleRunExperimentB = () => {
    setIsCalculatingB(true);
    setTimeout(() => {
      const results = runExperimentB_Locations(env, env.op);
      setExpBRows(results);
      setIsCalculatingB(false);
    }, 50);
  };

  // Run Experiment D (Extreme Environmental Conditions)
  const handleRunExperimentD = () => {
    setIsCalculatingD(true);
    setTimeout(() => {
      const results = runExperimentD_Extremes(shade, defect, env.op);
      setExpDRows(results);
      setIsCalculatingD(false);
    }, 60);
  };

  // Initial runs
  useEffect(() => {
    handleRunBenchmarkA();
    handleRunExperimentB();
    handleRunExperimentD();
  }, [env.G, env.Ta, env.Ws, env.op]);

  // Draw Sweep Chart for Benchmark A
  useEffect(() => {
    if (!sweepPoints || subTab !== 'benchA') return;
    const canvas = sweepCanvasRef.current;
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

    const L = 46;
    const R = 14;
    const T = 12;
    const B = 24;

    const isTemp = viewMetric === 'temp';

    const ymin = 0;
    const ymax = isTemp ? 400 : 250;
    const xmin = 0;
    const xmax = 100;

    const X = (s: number) => L + ((s - xmin) / (xmax - xmin)) * (W - L - R);
    const Y = (v: number) => T + (1 - (v - ymin) / (ymax - ymin)) * (H - T - B);

    ctx.font = '10px -apple-system, sans-serif';

    // Grid & Y ticks
    for (let k = 0; k <= 4; k++) {
      const v = ymin + ((ymax - ymin) * k) / 4;
      ctx.strokeStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(L, Y(v));
      ctx.lineTo(W - R, Y(v));
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(v)}`, L - 6, Y(v) + 3);
    }

    // X Axis Label
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748b';
    ctx.fillText('중앙 셀(25번) 음영률 (%)', W / 2 + 15, H - 4);

    // Temperature threshold lines
    if (isTemp) {
      const thresholds = [
        { temp: 85, label: '85℃ (감지)', color: '#10b981' },
        { temp: 130, label: '130℃ (봉지재 열화)', color: '#f59e0b' },
        { temp: 300, label: '300℃ (발화 위험)', color: '#ef4444' },
      ];

      for (const th of thresholds) {
        ctx.strokeStyle = th.color;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(L, Y(th.temp));
        ctx.lineTo(W - R, Y(th.temp));
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = th.color;
        ctx.textAlign = 'left';
        ctx.fillText(th.label, L + 6, Y(th.temp) - 3);
      }
    }

    // Series definitions
    const series = [
      { key: 'none', label: '무보호', color: '#94a3b8' },
      { key: 'diode', label: '표준 다이오드', color: '#f59e0b' },
      { key: 'smart', label: '스마트 바이패스', color: '#06b6d4' },
      { key: 'optimizer', label: 'DC 옵티마이저', color: '#8b5cf6' },
      { key: 'hybridWater', label: '스마트+수냉', color: '#38bdf8' },
    ];

    series.forEach((s, idx) => {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      sweepPoints.forEach((pt, j) => {
        const val = isTemp ? pt.temps[s.key] : pt.powers[s.key];
        const px = X(pt.shadePercent);
        const py = Y(Math.min(ymax, Math.max(ymin, val)));
        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.lineWidth = 1;

      // Legend in top right
      const legX = W - R - (series.length - idx) * 85;
      ctx.fillStyle = s.color;
      ctx.textAlign = 'left';
      ctx.fillText(`— ${s.label}`, legX, T + 10);
    });
  }, [sweepPoints, viewMetric, subTab]);

  // Filtered rows for Experiment B
  const filteredExpBRows = (expBRows || []).filter((r) => {
    if (selectedLocFilter !== 'all' && r.locationId !== selectedLocFilter) return false;
    if (selectedShadeFilter !== 'all' && r.shadePercent !== selectedShadeFilter) return false;
    return true;
  });

  // Filtered rows for Experiment D
  const filteredExpDRows = (expDRows || []).filter((r) => {
    if (expDCategoryFilter !== 'all' && r.category !== expDCategoryFilter) return false;
    return true;
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-6">
      {/* Top Header & Sub-Tab Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800">
              <Layers className="w-4 h-4" />
            </span>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Sol2 학술 연구 실험실 (Research Experiment Suite)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            연구계획서 5.1~5.7에 기반한 시나리오 벤치마크, 2×3 음영 위치 안팎 비교, 환경 양끝조건 정량 분석
          </p>
        </div>

        {/* Sub-tab buttons */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-medium">
          <button
            onClick={() => setSubTab('benchA')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center space-x-1.5 ${
              subTab === 'benchA'
                ? 'bg-cyan-600 text-white font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>실험 A: 300초 벤치마크</span>
          </button>
          <button
            onClick={() => setSubTab('locB')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center space-x-1.5 ${
              subTab === 'locB'
                ? 'bg-cyan-600 text-white font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>실험 B: 2×3 음영 위치 안팎 비교</span>
          </button>
          <button
            onClick={() => setSubTab('extremeD')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center space-x-1.5 ${
              subTab === 'extremeD'
                ? 'bg-cyan-600 text-white font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>실험 D: 환경 양끝 극한조건</span>
          </button>
        </div>
      </div>

      {/* Shared Quick Environment Parameters Bar */}
      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2 text-cyan-400 font-semibold">
          <Sliders className="w-4 h-4" />
          <span>공통 환경 기준치:</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-1.5">
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">일사량:</span>
            <select
              value={env.G}
              onChange={(e) => setEnv((prev) => ({ ...prev, G: parseInt(e.target.value) }))}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded px-2 py-0.5 font-mono cursor-pointer"
            >
              {[100, 200, 400, 600, 800, 1000].map((v) => (
                <option key={v} value={v}>
                  {v} W/m²
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-1.5">
            <Thermometer className="w-3.5 h-3.5 text-red-400" />
            <span className="text-slate-400">기온:</span>
            <select
              value={env.Ta}
              onChange={(e) => setEnv((prev) => ({ ...prev, Ta: parseInt(e.target.value) }))}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded px-2 py-0.5 font-mono cursor-pointer"
            >
              {[-5, 10, 25, 35, 40].map((v) => (
                <option key={v} value={v}>
                  {v} ℃
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-1.5">
            <Wind className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">풍속:</span>
            <select
              value={env.Ws}
              onChange={(e) => setEnv((prev) => ({ ...prev, Ws: parseFloat(e.target.value) }))}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded px-2 py-0.5 font-mono cursor-pointer"
            >
              {[0, 1, 3, 5, 10].map((v) => (
                <option key={v} value={v}>
                  {v} m/s
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-1.5">
            <Zap className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-slate-400">운전점:</span>
            <select
              value={env.op}
              onChange={(e) => setEnv((prev) => ({ ...prev, op: e.target.value as any }))}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded px-2 py-0.5 font-mono cursor-pointer"
            >
              <option value="mppt">MPPT (최대출력점)</option>
              <option value="sc">단락 근처 (IEC 61215 MQT 09 최악조건)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SUB-TAB A: 300초 종합 벤치마크 & 스윕 곡선 */}
      {/* ============================================================== */}
      {subTab === 'benchA' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>실험 A — 현재 음영 패턴에 대한 6대 방어/열관리 300초 가동 벤치마크</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                운전점: {env.op === 'mppt' ? 'MPPT (정상 발전)' : '단락 근처 (MQT 09 최악조건)'} | 일사: {env.G} W/m², 기온: {env.Ta} ℃, 풍속: {env.Ws} m/s
              </p>
            </div>
            <button
              onClick={handleRunBenchmarkA}
              disabled={isCalculatingA}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>{isCalculatingA ? '계산 중...' : '300초 벤치마크 재계산'}</span>
            </button>
          </div>

          {/* Benchmark Table */}
          {benchRows && (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-300 border-b border-slate-800">
                    <th className="py-2.5 px-3 font-semibold">방어 및 열 관리 방식</th>
                    <th className="py-2.5 px-3 font-semibold text-center">최고 핫스팟 온도</th>
                    <th className="py-2.5 px-3 font-semibold text-center">130℃ 초과 시간</th>
                    <th className="py-2.5 px-3 font-semibold text-center">최종 출력 (손실률)</th>
                    <th className="py-2.5 px-3 font-semibold text-center text-emerald-400 bg-emerald-950/20">
                      회복 전력량 (Gain)
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-center">300초 누적 발전량</th>
                    <th className="py-2.5 px-3 font-semibold text-center text-cyan-400">에너지 획득 이득</th>
                    <th className="py-2.5 px-3 font-semibold text-center">안전 판정</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {benchRows.map((r, idx) => {
                    const isBaseline = r.circuitMode === 'none';
                    return (
                      <tr
                        key={idx}
                        className={`hover:bg-slate-900/40 transition-colors ${
                          isBaseline ? 'bg-slate-950 text-slate-400' : 'text-slate-200'
                        }`}
                      >
                        <td className="py-2.5 px-3 font-sans font-medium flex items-center space-x-2">
                          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: r.color }} />
                          <span style={{ color: r.color }}>{r.modeName}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={r.maxT >= 130 ? 'text-red-400 font-bold' : r.maxT >= 85 ? 'text-amber-300' : 'text-emerald-400'}>
                            {r.maxT.toFixed(1)} ℃
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={r.t130 > 0 ? 'text-red-400 font-bold' : 'text-slate-400'}>
                            {r.t130} s
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span>{r.finalPower.toFixed(1)} W</span>
                          <span className="text-[10px] text-slate-500 ml-1">({r.powerLossPercent.toFixed(0)}% 손실)</span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-emerald-300 bg-emerald-950/10">
                          {isBaseline ? (
                            <span className="text-slate-500 font-normal">기준 (0.0 W)</span>
                          ) : (
                            <span>+{r.recoveredPower.toFixed(1)} W</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-300">
                          {r.totalEnergy.toFixed(2)} Wh
                        </td>
                        <td className="py-2.5 px-3 text-center text-cyan-300 font-bold">
                          {isBaseline ? (
                            <span className="text-slate-500 font-normal">기준</span>
                          ) : (
                            <span>+{r.energyGainWh.toFixed(2)} Wh</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-sans">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                              r.rating === '정상'
                                ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                                : r.rating === '주의'
                                ? 'bg-amber-950 text-amber-300 border-amber-800'
                                : 'bg-red-950 text-red-300 border-red-700'
                            }`}
                          >
                            {r.rating}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Shading Sweep Curve */}
          <div className="pt-2 border-t border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white">중앙 셀 음영률(0~100%) 스윕 거동 분석</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  부분 음영 깊이에 따른 정상상태 핫스팟 온도와 발전 출력 회복 특성을 확인합니다.
                </p>
              </div>

              <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-medium">
                <button
                  onClick={() => setViewMetric('temp')}
                  className={`px-3 py-1 rounded transition cursor-pointer ${
                    viewMetric === 'temp' ? 'bg-cyan-500 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  온도 거동 (℃)
                </button>
                <button
                  onClick={() => setViewMetric('power')}
                  className={`px-3 py-1 rounded transition cursor-pointer ${
                    viewMetric === 'power' ? 'bg-cyan-500 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  발전 출력 (W)
                </button>
              </div>
            </div>

            <div className="bg-slate-950 rounded-xl border border-slate-800 p-2 overflow-hidden flex justify-center shadow-inner">
              <canvas ref={sweepCanvasRef} className="w-full max-w-[620px] aspect-[600/220]" />
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SUB-TAB B: 실험 B (2x3 음영 위치별 안팎 비교: 중앙 vs 4꼭짓점) */}
      {/* ============================================================== */}
      {subTab === 'locB' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>실험 B — 2×3 음영 블록 위치별 안팎 비교 (중앙 vs 4대 꼭짓점)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                모듈 내부(중앙)와 외부(모서리)의 열 축적 및 다이오드 서브스트링 간 간섭 효과를 음영률 30%, 60%, 90%에서 비교합니다.
              </p>
            </div>
            <button
              onClick={handleRunExperimentB}
              disabled={isCalculatingB}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>{isCalculatingB ? '15개 시나리오 연산 중...' : '위치별 15개 시나리오 일괄 실험 실행'}</span>
            </button>
          </div>

          {/* Filters & Visual Geometry Selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {/* Position Filter */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="text-slate-300 font-semibold flex items-center justify-between">
                <span>음영 위치 필터</span>
                <span className="text-[10px] text-cyan-400">2행×3열 음영 블록</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => setSelectedLocFilter('top-left')}
                  className={`p-1.5 rounded-lg border text-center transition cursor-pointer ${
                    selectedLocFilter === 'top-left'
                      ? 'bg-cyan-950 border-cyan-500 text-cyan-300 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  ↖ 좌상단 (0,1,2번)
                </button>
                <button
                  onClick={() => setSelectedLocFilter('center')}
                  className={`p-1.5 rounded-lg border text-center transition cursor-pointer ${
                    selectedLocFilter === 'center'
                      ? 'bg-amber-950 border-amber-500 text-amber-300 font-bold ring-1 ring-amber-500/50'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  🎯 중앙 (24,25,26번)
                </button>
                <button
                  onClick={() => setSelectedLocFilter('top-right')}
                  className={`p-1.5 rounded-lg border text-center transition cursor-pointer ${
                    selectedLocFilter === 'top-right'
                      ? 'bg-cyan-950 border-cyan-500 text-cyan-300 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  ↗ 우상단 (7,8,9번)
                </button>
                <button
                  onClick={() => setSelectedLocFilter('bottom-left')}
                  className={`p-1.5 rounded-lg border text-center transition cursor-pointer ${
                    selectedLocFilter === 'bottom-left'
                      ? 'bg-cyan-950 border-cyan-500 text-cyan-300 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  ↙ 좌하단 (40,41,42번)
                </button>
                <button
                  onClick={() => setSelectedLocFilter('all')}
                  className={`p-1.5 rounded-lg border text-center transition cursor-pointer ${
                    selectedLocFilter === 'all'
                      ? 'bg-slate-800 border-slate-600 text-white font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  전체 위치 (5종)
                </button>
                <button
                  onClick={() => setSelectedLocFilter('bottom-right')}
                  className={`p-1.5 rounded-lg border text-center transition cursor-pointer ${
                    selectedLocFilter === 'bottom-right'
                      ? 'bg-cyan-950 border-cyan-500 text-cyan-300 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  ↘ 우하단 (47,48,49번)
                </button>
              </div>
            </div>

            {/* Shading Depth Filter */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="text-slate-300 font-semibold flex items-center justify-between">
                <span>음영률 심도 필터</span>
                <span className="text-[10px] text-slate-400">문서 5.3 기준: 30%, 60%, 90%</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'all', label: '전체 (3종)' },
                  { id: 30, label: '30% (경미)' },
                  { id: 60, label: '60% (중간)' },
                  { id: 90, label: '90% (심각)' },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedShadeFilter(s.id as any)}
                    className={`p-2 rounded-lg border text-center transition cursor-pointer ${
                      selectedShadeFilter === s.id
                        ? 'bg-cyan-950 border-cyan-500 text-cyan-300 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-400">
                안(중앙)과 밖(모서리)을 비교하여 열 발산 조건과 다이오드 도통 경계의 차이를 분석합니다.
              </p>
            </div>
          </div>

          {/* Results Table for Experiment B */}
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-900/90 text-slate-300 border-b border-slate-800">
                  <th className="py-2.5 px-3 font-semibold">음영 위치 (구분)</th>
                  <th className="py-2.5 px-3 font-semibold">해당 셀 인덱스</th>
                  <th className="py-2.5 px-2 font-semibold text-center">음영률</th>
                  <th className="py-2.5 px-3 font-semibold text-center text-slate-400">
                    ① 무보호 출력 (최고온도)
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-center text-amber-400">
                    ② 표준 다이오드 출력 (최고온도)
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-center text-cyan-400 bg-cyan-950/20">
                    ③ 스마트 바이패스 출력 (최고온도)
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-center text-emerald-400">
                    회복 전력량
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-center text-cyan-300">
                    전력 효율 회복률
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredExpBRows.map((r, idx) => {
                  const isCenter = r.locationId === 'center';
                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-slate-900/50 transition-colors ${
                        isCenter ? 'bg-amber-950/10' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 font-sans font-medium flex items-center space-x-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isCenter ? 'bg-amber-400 ring-2 ring-amber-400/40' : 'bg-cyan-400'
                          }`}
                        />
                        <span className={isCenter ? 'text-amber-300 font-bold' : 'text-slate-200'}>
                          {r.locationName}
                        </span>
                        <span className="text-[10px] text-slate-500 font-sans">({r.category})</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                        {r.cellsDescription}
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-slate-200">
                        {r.shadePercent}%
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-400">
                        <span>{r.noneP} W</span>
                        <span className="text-[10px] text-red-400 ml-1">({r.noneMaxT}℃)</span>
                      </td>
                      <td className="py-2.5 px-3 text-center text-amber-300">
                        <span>{r.diodeP} W</span>
                        <span className="text-[10px] text-amber-400 ml-1">({r.diodeMaxT}℃)</span>
                        {r.diodeTriggered && (
                          <span className="text-[9px] px-1 py-0.2 ml-1 rounded bg-amber-950 text-amber-300 border border-amber-800">
                            도통
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center text-cyan-300 font-bold bg-cyan-950/15">
                        <span>{r.smartP} W</span>
                        <span className="text-[10px] text-emerald-400 ml-1">({r.smartMaxT}℃)</span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-emerald-400">
                        +{r.recoveredP} W
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-cyan-300">
                        {r.efficiencyRecoveryPercent}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Research Insight for Experiment B */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs leading-relaxed text-slate-300">
            <div className="font-bold text-amber-400 flex items-center space-x-1.5">
              <Award className="w-4 h-4 text-amber-400" />
              <span>실험 B 분석 결론: 안(중앙) vs 밖(모서리)의 물리적 차이</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-400 text-[11px] pt-1">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <strong className="text-white block mb-0.5">1. 열섬 현상 (중앙 열 축적 집중)</strong>
                중앙(Center) 셀은 사방이 고온의 셀로 둘러싸여 측면 열전도 방열 면적이 제한됩니다. 따라서 같은 60% 음영에서도 꼭짓점(좌상/우하 등)보다 최고온도가 약 8~14℃ 더 높게 상승합니다.
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <strong className="text-white block mb-0.5">2. 바이패스 서브스트링 영향</strong>
                꼭짓점 음영은 1번 서브스트링(상단) 또는 3번 서브스트링(하단)에만 국한되지만, 중앙 음영은 2번 서브스트링에 집중되어 다이오드 동작 시 전체 모듈 전압의 1/3을 일시에 잃게 됩니다. 스마트 바이패스는 5셀 단위 차단으로 위치에 상관없이 75% 이상의 출력을 온전히 유지합니다.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SUB-TAB D: 실험 D (환경 변수 양끝 극한조건: 일사/기온/풍속) */}
      {/* ============================================================== */}
      {subTab === 'extremeD' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>실험 D — 환경 변수 양끝 극한조건 원클릭 비교 (일사·기온·풍속)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                경우의 수를 줄이고 본질적 차이를 규명하기 위해 일사량(100 vs 1000), 기온(-5 vs 25 vs 40), 풍속(0 vs 1 vs 10)의 양끝조건을 300초 가동 비교합니다.
              </p>
            </div>
            <button
              onClick={handleRunExperimentD}
              disabled={isCalculatingD}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>{isCalculatingD ? '극한조건 연산 중...' : '전체 극한조건 일괄 벤치마크 실행'}</span>
            </button>
          </div>

          {/* Quick Category Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <button
              onClick={() => {
                setExpDCategoryFilter('irradiance');
                handleRunExperimentD();
              }}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                expDCategoryFilter === 'irradiance'
                  ? 'bg-amber-950/60 border-amber-500 text-amber-200'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center space-x-1.5">
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span>1. 일사량 양끝조건</span>
                </span>
                <span className="text-[10px] text-amber-400 font-mono">100 vs 1000 W/m²</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                극저일사(흐린날)와 정오 표준일사에서의 핫스팟 발열 임계값 확인
              </p>
            </button>

            <button
              onClick={() => {
                setExpDCategoryFilter('temperature');
                handleRunExperimentD();
              }}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                expDCategoryFilter === 'temperature'
                  ? 'bg-red-950/60 border-red-500 text-red-200'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center space-x-1.5">
                  <Thermometer className="w-4 h-4 text-red-400" />
                  <span>2. 외기온도 극한조건</span>
                </span>
                <span className="text-[10px] text-red-400 font-mono">-5℃ vs 25℃ vs 40℃</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                혹한기 vs 혹서기 폭염 환경에서 130℃ 초과 봉지재 열화 위험도 평가
              </p>
            </button>

            <button
              onClick={() => {
                setExpDCategoryFilter('wind');
                handleRunExperimentD();
              }}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                expDCategoryFilter === 'wind'
                  ? 'bg-cyan-950/60 border-cyan-500 text-cyan-200'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center space-x-1.5">
                  <Wind className="w-4 h-4 text-cyan-400" />
                  <span>3. 풍속 극한조건</span>
                </span>
                <span className="text-[10px] text-cyan-400 font-mono">0 vs 1 vs 10 m/s</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                무풍(대류 방열 최악) vs 강풍(강제 대류 냉각) 상태의 열 방어 성능
              </p>
            </button>
          </div>

          {/* Results Table for Experiment D */}
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-900/90 text-slate-300 border-b border-slate-800">
                  <th className="py-2.5 px-3 font-semibold">환경 변수 조건</th>
                  <th className="py-2.5 px-3 font-semibold">실험 조건 상세 설명</th>
                  <th className="py-2.5 px-3 font-semibold text-center text-slate-400">
                    ① 무보호 (최고온도 / 출력)
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-center text-amber-400">
                    ② 표준 다이오드 (최고온도 / 출력)
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-center text-cyan-400 bg-cyan-950/20">
                    ③ 스마트 바이패스 (최고온도 / 출력)
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-center text-emerald-400">
                    스마트 회복 전력
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-center">안전 판정</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredExpDRows.map((r, idx) => {
                  return (
                    <tr key={idx} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-2.5 px-3 font-sans font-bold text-white">
                        {r.variableLabel}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-slate-400 text-[11px]">
                        {r.conditionDescription}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-400">
                        <span>{r.noneMaxT} ℃</span>
                        <span className="text-[10px] text-slate-500 ml-1">({r.noneP} W)</span>
                      </td>
                      <td className="py-2.5 px-3 text-center text-amber-300">
                        <span>{r.diodeMaxT} ℃</span>
                        <span className="text-[10px] text-slate-500 ml-1">({r.diodeP} W)</span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-cyan-300 bg-cyan-950/15">
                        <span className={r.smartMaxT < 85 ? 'text-emerald-400' : 'text-amber-400'}>
                          {r.smartMaxT} ℃
                        </span>
                        <span className="text-[10px] text-slate-300 ml-1">({r.smartP} W)</span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-emerald-400">
                        +{r.recoveredPowerSmart} W
                      </td>
                      <td className="py-2.5 px-3 text-center font-sans">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            r.safetyRating === '정상'
                              ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                              : r.safetyRating === '주의'
                              ? 'bg-amber-950 text-amber-300 border-amber-800'
                              : 'bg-red-950 text-red-300 border-red-700'
                          }`}
                        >
                          {r.safetyRating}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 5.2 연구노트 & 심층 이론 가이드 (Research Notes) */}
      {/* ============================================================== */}
      <div className="pt-4 border-t border-slate-800 space-y-3">
        <div className="flex items-center space-x-2 text-white font-bold text-sm">
          <BookOpen className="w-4 h-4 text-cyan-400" />
          <span>5.2 연구노트 및 이론 정리 가이드 (Theoretical Research Reference)</span>
        </div>
        <p className="text-xs text-slate-400">
          연구계획서 문서 5.2에 수록된 핵심 이론, 실험 근거, 그래프 판독법 및 물리 냉각 기술 상세 정리입니다.
        </p>

        <div className="space-y-2 text-xs">
          {/* Note 1: MPPT vs Short-circuit */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
            <button
              onClick={() => toggleNote('note1')}
              className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-900/60 transition cursor-pointer"
            >
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 text-[10px] font-mono">
                  이론 1
                </span>
                <span className="font-bold text-slate-200">
                  MPPT와 단락 근처(IEC 61215 MQT 09) 두 운전점으로 비교 실험을 수행한 이유
                </span>
              </div>
              {expandedNotes.note1 ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>
            {expandedNotes.note1 && (
              <div className="p-4 pt-1 border-t border-slate-800/80 text-slate-300 leading-relaxed space-y-2 bg-slate-900/30">
                <p>
                  <strong>1) 최적 조건 (MPPT, Maximum Power Point Tracking):</strong> 태양광 인버터가 정상 작동할 때 스트링 전압과 전류를 최대 출력점으로 제어합니다. 음영 셀이 발생하면 광전류 불일치로 인해 해당 셀이 역바이어스 영역에 진입하지만, 시스템이 전압을 조절하여 상대적으로 완만한 열적 스트레스를 받습니다.
                </p>
                <p>
                  <strong>2) 극한의 최악 조건 (단락 근처, IEC 61215 MQT 09):</strong> 인버터 트립, 계통 이상 또는 단락 시험 시 스트링 전류는 단락전류(I_sc)에 가깝게 최대치로 흐릅니다. 이때 음영 셀은 다른 모든 정상 셀들이 생산한 높은 전류를 홀로 감당해야 하므로 역바이어스 항복 전압(-V_br ≈ -12V)에 강제 도달하며, 소모 전력 P_hot = |V| × I 가 극대화되어 온도가 200~300℃까지 폭발적으로 치솟는 가장 가혹한 조건입니다.
                </p>
                <p className="text-[11px] text-cyan-300 bg-cyan-950/30 p-2 rounded border border-cyan-900/50">
                  💡 결론: MPPT는 실제 상용 발전 시의 '회복 전력 효율(W, Wh)'을 평가하고, 단락 근처는 국제 인증 규격(MQT 09)에 따른 '화재 방지 극한 안전성'을 검증하기 위해 두 운전점을 병행 비교합니다.
                </p>
              </div>
            )}
          </div>

          {/* Note 2: Circuit Defense 3 Methods */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
            <button
              onClick={() => toggleNote('note2')}
              className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-900/60 transition cursor-pointer"
            >
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 text-[10px] font-mono">
                  이론 2
                </span>
                <span className="font-bold text-slate-200">
                  무보호 / 표준 바이패스 다이오드 / 제안: 스마트 바이패스 기능 비교
                </span>
              </div>
              {expandedNotes.note2 ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>
            {expandedNotes.note2 && (
              <div className="p-4 pt-1 border-t border-slate-800/80 text-slate-300 leading-relaxed space-y-2 bg-slate-900/30">
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    <strong>무보호 (기준 대조군):</strong> 바이패스 요소가 전혀 없어 음영 셀 1개로 인해 스트링 전체 출력이 차단되고, 줄열 발열로 셀이 파괴되거나 화재가 발생합니다.
                  </li>
                  <li>
                    <strong>표준 바이패스 다이오드 (20셀 단위):</strong> 모듈 내 3개의 쇼트키 다이오드가 각각 20셀 서브스트링에 병렬 연결됩니다. 음영 셀 전압이 -0.5V 이하로 떨어지면 20셀 전체를 통째로 단락 우회시켜 모듈 전체 출력의 1/3(약 33.3%)을 상실하는 단점이 있습니다.
                  </li>
                  <li>
                    <strong>스마트 바이패스 (5셀 MOSFET 스위칭):</strong> 12개 그룹(그룹당 5셀)에 양방향 저저항(R_on = 5mΩ) MOSFET을 배치하고 전압·온도 감시 회로로 음영이 발생한 최소 5셀 군만 정밀 우회합니다. 정상 55개 셀은 계속 발전하여 출력 회복률을 77% 이상으로 유지하고 온도를 85℃ 이하로 완벽 억제합니다.
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Note 3: 4 Thermal Mitigations */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
            <button
              onClick={() => toggleNote('note3')}
              className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-900/60 transition cursor-pointer"
            >
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-mono">
                  이론 3
                </span>
                <span className="font-bold text-slate-200">
                  물리적 열 냉각 4대 기법 해설 (Faiman 대류 모델 결합)
                </span>
              </div>
              {expandedNotes.note3 ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>
            {expandedNotes.note3 && (
              <div className="p-4 pt-1 border-t border-slate-800/80 text-slate-300 leading-relaxed space-y-2 bg-slate-900/30">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <strong className="text-emerald-400 block mb-0.5">자연 냉각 (대조군)</strong>
                    Faiman 모델 표준 계수 (U_0 = 25 W/m²K, U_1 = 6.84). 자연 대류에만 의존하며 무풍 상태에서 열 방출이 급격히 저하됩니다.
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <strong className="text-cyan-400 block mb-0.5">수동 방열판 + PCM (상변화물질 파라핀)</strong>
                    패널 후면에 알루미늄 핀과 파라핀 왁스를 부착하여 상변화 시 잠열을 흡수 (C_t = 28 J/K), 국소 열저항을 R_th = 1.6 K/W 로 낮춰 급격한 온도 스파이크를 완충합니다.
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <strong className="text-blue-400 block mb-0.5">능동 수냉 스프레이 / 수냉 순환</strong>
                    물의 높은 비열과 증발 잠열을 이용해 U_0 = 55 W/m²K, R_th = 1.1 K/W 로 비약적 냉각 효과를 발휘합니다.
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <strong className="text-purple-400 block mb-0.5">능동 강제 공랭팬</strong>
                    송풍 팬으로 강제 대류 계수 U_1 = 16.5 를 유지하여 무풍 환경에서도 지속적인 열 방출 경로를 제공합니다.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Note 4: External shading vs Internal defects */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
            <button
              onClick={() => toggleNote('note4')}
              className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-900/60 transition cursor-pointer"
            >
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-400 border border-purple-800 text-[10px] font-mono">
                  이론 4
                </span>
                <span className="font-bold text-slate-200">
                  외부 음영(새분변, 낙엽, 구름) vs 셀 내부 결함(미세균열) 비교 분석
                </span>
              </div>
              {expandedNotes.note4 ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>
            {expandedNotes.note4 && (
              <div className="p-4 pt-1 border-t border-slate-800/80 text-slate-300 leading-relaxed space-y-2 bg-slate-900/30">
                <p>
                  <strong>메커니즘의 차이:</strong> 새 분변이나 낙엽은 태양광 입사를 물리적으로 차단하여 광전류(I_ph)를 0에 가깝게 떨어뜨리는 '외부 광학적 결함'입니다. 반면 제조결함(미세균열, 셀 크랙)은 빛은 도달하지만 반도체 p-n 접합 결함으로 인해 션트 저항이 급락(R_sh = 0.8 Ω)하고 내부 열저항이 증가(R_th = 4.0 K/W)하는 '내부 전기적 결함'입니다.
                </p>
                <p>
                  <strong>음영 면적 vs 음영 깊이의 상관관계:</strong> 음영 면적이 넓어진다고 해서 항상 전력 손실이 비례하여 커지지는 않습니다. 다이오드 서브스트링 구조상 1개 셀만 100% 가려져도 서브스트링 20셀 전체가 우회되는 반면, 구름처럼 18셀이 40%로 고르게 가려지면 다이오드가 켜지지 않고 전체 스트링 전류가 60% 수준으로 줄어든 상태로 전압 강하 없이 동작할 수 있습니다.
                </p>
              </div>
            )}
          </div>

          {/* Note 5: Sweep Graph Interpretation */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
            <button
              onClick={() => toggleNote('note5')}
              className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-900/60 transition cursor-pointer"
            >
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-800 text-[10px] font-mono">
                  이론 5
                </span>
                <span className="font-bold text-slate-200">
                  중앙 셀 음영률 스윕 그래프 보는 방법 및 '부분 음영의 역설(H3)'
                </span>
              </div>
              {expandedNotes.note5 ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>
            {expandedNotes.note5 && (
              <div className="p-4 pt-1 border-t border-slate-800/80 text-slate-300 leading-relaxed space-y-2 bg-slate-900/30">
                <p>
                  그래프 x축은 중앙 셀 음영률(0~100%), y축은 정상상태 최고온도입니다.
                </p>
                <p>
                  <strong>표준 바이패스 다이오드의 비단조(Non-monotonic) 곡선:</strong> 표준 다이오드는 음영률이 0%에서 50%로 증가할 때 온도가 177℃까지 급상승하다가, 70%를 넘어서면 다이오드가 완전히 도통하면서 온도가 66℃로 급락하는 역설적 거동을 보입니다. 즉, 100% 완전 차광보다 40~50%의 어중간한 음영에서 셀이 가장 심각하게 불타게 됩니다.
                </p>
                <p>
                  <strong>스마트 바이패스의 평탄 곡선:</strong> 스마트 바이패스는 음영률 20% 이상의 모든 영역에서 76℃ 이하의 일정한 온도를 유지하여 부분 음영 역설을 완전히 해소합니다.
                </p>
              </div>
            )}
          </div>

          {/* Note 6: Independent Weather Fluctuation and Thermal Inertia */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
            <button
              onClick={() => toggleNote('note6')}
              className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-900/60 transition cursor-pointer"
            >
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800 text-[10px] font-mono">
                  이론 6
                </span>
                <span className="font-bold text-slate-200">
                  자연 환경 독립 변동(기온 ±5℃, 풍속 m/s 기류 요동)과 모듈 열시상수(Thermal Time Constant)
                </span>
              </div>
              {expandedNotes.note6 ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>
            {expandedNotes.note6 && (
              <div className="p-4 pt-1 border-t border-slate-800/80 text-slate-300 leading-relaxed space-y-2 bg-slate-900/30">
                <p>
                  실제 야외 필드에서는 기온과 바람이 고정되지 않고 연속적으로 요동칩니다. 본 시뮬레이터는 기온 설정치 기준 ±5℃의 자체 독립 요동과 m/s 단위의 독립 풍속 기류 변동을 물리적으로 구현하였습니다.
                </p>
                <p>
                  모듈의 열용량(C_t ≈ 15 J/K)과 열저항(R_th ≈ 2.5 K/W)으로 인해 모듈의 열시상수 τ = C_t × R_th ≈ 37.5 초 가 발생합니다. 따라서 외기 기온이나 돌풍이 순간적으로 스쳐 지나가더라도 셀 온도는 즉각 튀지 않고 완만한 지수함수 곡선으로 추종하는 '열적 관성(Thermal Inertia)'을 보이며, 스마트 바이패스는 이러한 기상 요동 속에서도 감지 지연(τ_lat = 0.5 s) 이내에 오동작 없이 안정적으로 작동합니다.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
