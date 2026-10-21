import React from 'react';
import { Zap, TrendingUp, Flame, AlertTriangle, Award, ShieldAlert } from 'lucide-react';
import { SimulationMetrics } from '../types/solar.ts';

interface PowerMetricsBarProps {
  metrics: SimulationMetrics | null;
  totalEnergyWh: number;
  energyGainWh: number;
  timeSec: number;
  t130Sec: number;
  maxT: number;
}

export const PowerMetricsBar: React.FC<PowerMetricsBarProps> = ({
  metrics,
  totalEnergyWh,
  energyGainWh,
  timeSec,
  t130Sec,
  maxT,
}) => {
  if (!metrics) return null;

  const hot = metrics.hot;
  const isNormal = hot < 85;
  const isWarning = hot >= 85 && hot < 130;
  const isDanger = hot >= 130 && hot < 300;
  const isFireHazard = hot >= 300;

  const ratingLabel = isNormal ? '정상' : isWarning ? '주의' : isDanger ? '위험' : '화재위험';
  const ratingColor = isNormal
    ? 'text-emerald-400 bg-emerald-950/80 border-emerald-800'
    : isWarning
    ? 'text-amber-300 bg-amber-950/80 border-amber-800'
    : 'text-red-300 bg-red-950 border-red-700 animate-pulse';

  const powerLossW = Math.max(0, metrics.Pid - metrics.P);
  const powerLossPercent = metrics.Pid > 0 ? (powerLossW / metrics.Pid) * 100 : 0;

  return (
    <div className="bg-slate-900 border border-slate-800/90 rounded-xl p-2.5 shadow-lg">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-800/80">
        {/* 1. Real-time Output */}
        <div className="px-2 py-1 flex items-center justify-between sm:block">
          <div className="flex items-center space-x-1 text-[11px] text-slate-400">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>실시간 발전 출력</span>
          </div>
          <div className="mt-0.5 flex items-baseline space-x-1.5 font-mono">
            <span className="text-lg sm:text-xl font-bold text-white tracking-tight tabular-nums">
              {metrics.P.toFixed(1)}
            </span>
            <span className="text-[10px] text-slate-400">W</span>
            <span className="text-[10px] text-slate-500 hidden xl:inline">
              (이상 {metrics.Pid.toFixed(0)}W)
            </span>
          </div>
        </div>

        {/* 2. Recovered Power Gain */}
        <div className="px-2 py-1 sm:pl-3 flex items-center justify-between sm:block bg-emerald-950/10 rounded-md sm:rounded-none">
          <div className="flex items-center space-x-1 text-[11px] text-emerald-400 font-medium">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>회복 전력량</span>
          </div>
          <div className="mt-0.5 flex items-baseline space-x-1.5 font-mono">
            <span className="text-lg sm:text-xl font-bold text-emerald-300 tracking-tight tabular-nums">
              +{metrics.Precovered.toFixed(1)}
            </span>
            <span className="text-[10px] text-emerald-400">W</span>
            <span className="text-[10px] text-emerald-400/90 font-sans hidden xl:inline">
              (+{metrics.recoveryRatePercent.toFixed(0)}%)
            </span>
          </div>
        </div>

        {/* 3. Max Hotspot Temp */}
        <div className="px-2 py-1 sm:pl-3 flex items-center justify-between sm:block">
          <div className="flex items-center space-x-1 text-[11px] text-slate-400">
            <Flame className={`w-3.5 h-3.5 ${isDanger || isFireHazard ? 'text-red-500 animate-pulse' : 'text-orange-400'}`} />
            <span>최고 핫스팟 온도</span>
          </div>
          <div className="mt-0.5 flex items-center space-x-2 font-mono">
            <span className={`text-lg sm:text-xl font-bold tracking-tight tabular-nums ${
              isDanger || isFireHazard ? 'text-red-400' : isWarning ? 'text-amber-300' : 'text-slate-100'
            }`}>
              {hot.toFixed(1)}
            </span>
            <span className="text-[10px] text-slate-400">°C</span>
            <span className={`text-[9px] px-1.5 py-0.2 rounded border font-sans font-medium ${ratingColor}`}>
              {ratingLabel}
            </span>
          </div>
        </div>

        {/* 4. Hotspot Dissipation Loss */}
        <div className="px-2 py-1 sm:pl-3 flex items-center justify-between sm:block">
          <div className="flex items-center space-x-1 text-[11px] text-slate-400">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
            <span>핫스팟 손실 (P_hot)</span>
          </div>
          <div className="mt-0.5 flex items-baseline space-x-1.5 font-mono">
            <span className="text-lg sm:text-xl font-bold text-orange-400 tracking-tight tabular-nums">
              {metrics.Ph.toFixed(1)}
            </span>
            <span className="text-[10px] text-slate-400">W</span>
            <span className="text-[10px] text-red-400 hidden xl:inline">
              (-{powerLossPercent.toFixed(0)}%)
            </span>
          </div>
        </div>

        {/* 5. Cumulative Energy */}
        <div className="px-2 py-1 sm:pl-3 flex items-center justify-between sm:block">
          <div className="flex items-center space-x-1 text-[11px] text-slate-400">
            <Award className="w-3.5 h-3.5 text-cyan-400" />
            <span>누적 발전량</span>
          </div>
          <div className="mt-0.5 flex items-baseline space-x-1.5 font-mono">
            <span className="text-lg sm:text-xl font-bold text-cyan-300 tracking-tight tabular-nums">
              {totalEnergyWh.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400">Wh</span>
            {energyGainWh > 0.01 && (
              <span className="text-[10px] text-cyan-400 font-sans hidden xl:inline">
                (+{energyGainWh.toFixed(1)}Wh)
              </span>
            )}
          </div>
        </div>

        {/* 6. 130°C Overheating Time */}
        <div className="px-2 py-1 sm:pl-3 flex items-center justify-between sm:block">
          <div className="flex items-center space-x-1 text-[11px] text-slate-400">
            <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
            <span>130℃ 초과 시간</span>
          </div>
          <div className="mt-0.5 flex items-baseline space-x-1.5 font-mono">
            <span className={`text-lg sm:text-xl font-bold tracking-tight tabular-nums ${t130Sec > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {t130Sec.toFixed(0)}
            </span>
            <span className="text-[10px] text-slate-400">초</span>
            <span className="text-[10px] text-slate-500 font-sans hidden xl:inline">
              (최고 {maxT.toFixed(0)}℃)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
