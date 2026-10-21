import React, { useState, useRef, useEffect } from 'react';
import { Play, Sparkles, Sliders, Sun, Thermometer, Wind, Zap } from 'lucide-react';
import { ComparisonRow, EnvironmentState, SweepPoint } from '../types/solar.ts';
import { run300sBenchmark, generateShadingSweep } from '../physics/solarPhysics.ts';

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
  const [benchRows, setBenchRows] = useState<ComparisonRow[] | null>(null);
  const [sweepPoints, setSweepPoints] = useState<SweepPoint[] | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [viewMetric, setViewMetric] = useState<'temp' | 'power'>('temp');

  const sweepCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Run benchmark on click or parameter change
  const handleRunComparison = () => {
    setIsCalculating(true);
    setTimeout(() => {
      const rows = run300sBenchmark(env, shade, defect);
      const sweep = generateShadingSweep(env, 25);
      setBenchRows(rows);
      setSweepPoints(sweep);
      setIsCalculating(false);
    }, 40);
  };

  // Run on mount
  useEffect(() => {
    handleRunComparison();
  }, [env.G, env.Ta, env.Ws, env.op]);

  // Draw Sweep Chart
  useEffect(() => {
    if (!sweepPoints) return;
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
  }, [sweepPoints, viewMetric]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-6">
      {/* 1. In-Tab Real-time Parameters Bar */}
      <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2 text-cyan-400 font-semibold">
          <Sliders className="w-4 h-4" />
          <span>비교 조건 실시간 조정</span>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 flex items-center space-x-1">
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span>일사량 G:</span>
            </span>
            <select
              value={env.G}
              onChange={(e) => setEnv((prev) => ({ ...prev, G: parseInt(e.target.value) }))}
              className="bg-slate-900 border border-slate-800 text-slate-200 rounded px-2 py-1 font-mono cursor-pointer"
            >
              {[200, 400, 600, 800, 1000].map((v) => (
                <option key={v} value={v}>
                  {v} W/m²
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-slate-400 flex items-center space-x-1">
              <Thermometer className="w-3.5 h-3.5 text-red-400" />
              <span>기온 T_amb:</span>
            </span>
            <select
              value={env.Ta}
              onChange={(e) => setEnv((prev) => ({ ...prev, Ta: parseInt(e.target.value) }))}
              className="bg-slate-900 border border-slate-800 text-slate-200 rounded px-2 py-1 font-mono cursor-pointer"
            >
              {[-5, 10, 25, 35, 40].map((v) => (
                <option key={v} value={v}>
                  {v} ℃
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-slate-400 flex items-center space-x-1">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              <span>운전점:</span>
            </span>
            <select
              value={env.op}
              onChange={(e) => setEnv((prev) => ({ ...prev, op: e.target.value as any }))}
              className="bg-slate-900 border border-slate-800 text-slate-200 rounded px-2 py-1 font-mono cursor-pointer"
            >
              <option value="mppt">MPPT (최대출력점)</option>
              <option value="sc">단락 근처 (IEC 61215 MQT 09 최악조건)</option>
            </select>
          </div>

          <button
            onClick={handleRunComparison}
            disabled={isCalculating}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition cursor-pointer disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>{isCalculating ? '계산 중...' : '조건 적용 & 재계산'}</span>
          </button>
        </div>
      </div>

      {/* 2. Benchmark Table */}
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

      {/* 3. Shading Sweep Curve */}
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

      {/* 4. Research Hypothesis Findings */}
      <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-3 text-xs leading-relaxed">
        <div className="font-bold text-slate-200 flex items-center space-x-1.5">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>연구계획서 가설(H1~H4) 및 실험 수치해석 결론</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-400">
          <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800/80">
            <strong className="text-emerald-400 block mb-1">H1 [지지]: 스마트 바이패스의 조기 억제</strong>
            A-1 분변 1셀에서 표준 다이오드는 156.7℃로 130℃(봉지재 열화)를 252초간 초과하지만, 스마트 바이패스는 76.5℃로 85℃ 기준선 아래에서 완벽 억제되며 발전 출력도 144.7W → 204.4W로 약 41% 높게 회복됩니다.
          </div>
          <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800/80">
            <strong className="text-amber-400 block mb-1">H3 [비단조성]: 경미·중간 음영의 역설</strong>
            표준 다이오드는 음영률 50% 부근에서 177.4℃로 가장 뜨겁고 100% 음영에서는 오히려 66.8℃로 낮아집니다. 음영이 깊을수록 역전압이 커져 다이오드가 일찍 도통하기 때문이며, 경미한 국소 음영일수록 표준 다이오드로는 막기 어렵습니다.
          </div>
          <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800/80">
            <strong className="text-cyan-400 block mb-1">냉각 결합 [시너지]: 온도 저감 및 출력 추가 획득</strong>
            스마트 바이패스에 수동 방열판(PCM) 또는 능동 수냉을 결합하면 Faiman 모델의 대류 열전달 계수가 증가하여 모듈 표면 온도가 20~30℃ 낮아지고, 음의 온도계수(γ = -0.004/℃) 효과로 전력 출력이 5~15% 추가 상승합니다.
          </div>
          <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800/80">
            <strong className="text-purple-400 block mb-1">H4 [부분 지지]: 제조결함 셀의 한계와 과제</strong>
            미세균열 등 제조결함 셀(A-4)의 경우 5셀 그룹 내부의 다른 정상 셀들이 결함 셀로 전류를 밀어 넣는 구조적 특성이 있어, 그룹 크기를 5셀에서 2~3셀로 축소하거나 능동 냉각을 병행해야 완전한 열화 억제가 가능합니다.
          </div>
        </div>
      </div>
    </div>
  );
};
