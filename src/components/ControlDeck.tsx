import React from 'react';
import {
  Sun,
  Thermometer,
  Wind,
  Clock,
  Shield,
  Snowflake,
  Zap,
  Sliders,
  Sparkles,
  RefreshCw,
  Layers,
} from 'lucide-react';
import {
  CircuitDefenseMode,
  CoolingMode,
  EnvironmentState,
  MaterialConfig,
  ShadingMaterialType,
} from '../types/solar.ts';

interface ControlDeckProps {
  env: EnvironmentState;
  setEnv: React.Dispatch<React.SetStateAction<EnvironmentState>>;
  materialConfig: MaterialConfig;
  setMaterialConfig: React.Dispatch<React.SetStateAction<MaterialConfig>>;
  onApplyMaterialAction: (actionType: 'bird-preset' | 'leaves-scatter' | 'cloud-cover' | 'defect-preset' | 'clear-all') => void;
}

export const ControlDeck: React.FC<ControlDeckProps> = ({
  env,
  setEnv,
  materialConfig,
  setMaterialConfig,
  onApplyMaterialAction,
}) => {
  const materials: Array<{
    id: ShadingMaterialType;
    icon: string;
    label: string;
    sub: string;
  }> = [
    { id: 'bird', icon: '🦅', label: '새 분변', sub: '국소 고온' },
    { id: 'leaves', icon: '🍂', label: '낙엽', sub: '유기물 차광' },
    { id: 'cloud', icon: '☁', label: '구름 그림자', sub: '광역 투과' },
    { id: 'defect', icon: '⚡', label: '제조 결함', sub: '미세균열' },
    { id: 'clear', icon: '🧼', label: '세척/지우개', sub: '원상 복구' },
  ];

  const circuitModes: Array<{ id: CircuitDefenseMode; label: string; sub: string }> = [
    { id: 'none', label: '① 무보호', sub: '대조군' },
    { id: 'diode', label: '② 표준 다이오드', sub: '20셀' },
    { id: 'smart', label: '③ 스마트 바이패스', sub: '5셀 MOSFET' },
    { id: 'optimizer', label: '④ DC 옵티마이저', sub: 'MLPE' },
  ];

  const coolingModes: Array<{ id: CoolingMode; label: string; sub: string }> = [
    { id: 'natural', label: '자연 냉각', sub: '기본 대류' },
    { id: 'passive-heatsink', label: '수동 방열판+PCM', sub: 'Rth 1.6' },
    { id: 'active-water', label: '능동 수냉 스프레이', sub: 'U0 55' },
    { id: 'active-air', label: '능동 강제 공랭팬', sub: 'U1 16.5' },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
      {/* 1. Shading Material Direct Configurator */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>음영 물질 직접 제어 스튜디오 (Material Studio)</span>
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            클릭 도장 활성
          </span>
        </div>

        {/* Material Selection Tabs */}
        <div className="grid grid-cols-5 gap-1.5">
          {materials.map((m) => {
            const isSelected = materialConfig.activeMaterial === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMaterialConfig((prev) => ({ ...prev, activeMaterial: m.id }))}
                className={`py-1.5 px-1 rounded-xl text-center border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-950 border-cyan-500 text-cyan-300 ring-1 ring-cyan-500/40 shadow-sm'
                    : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                <div className="text-sm">{m.icon}</div>
                <div className="text-[11px] font-semibold mt-0.5">{m.label}</div>
              </button>
            );
          })}
        </div>

        {/* Detailed Controls for selected Material */}
        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/90 text-xs space-y-2.5">
          {materialConfig.activeMaterial === 'bird' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-slate-300">
                <span>새 분변 차광률 (두께·건조도):</span>
                <span className="font-mono text-cyan-400 font-bold">
                  {Math.round(materialConfig.birdShade * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={materialConfig.birdShade}
                onChange={(e) =>
                  setMaterialConfig((prev) => ({ ...prev, birdShade: parseFloat(e.target.value) }))
                }
                className="w-full accent-cyan-500 cursor-pointer"
              />
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-400">캔버스 셀을 클릭하면 도장이 찍힙니다.</span>
                <button
                  onClick={() => onApplyMaterialAction('bird-preset')}
                  className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-cyan-300 text-[11px] font-medium transition cursor-pointer"
                >
                  중앙 셀(25번) 자동 부착
                </button>
              </div>
            </div>
          )}

          {materialConfig.activeMaterial === 'leaves' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-slate-300">
                <span>낙엽 수량 (장수):</span>
                <span className="font-mono text-amber-400 font-bold">
                  {materialConfig.leavesCount} 장
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="8"
                step="1"
                value={materialConfig.leavesCount}
                onChange={(e) =>
                  setMaterialConfig((prev) => ({ ...prev, leavesCount: parseInt(e.target.value) }))
                }
                className="w-full accent-amber-500 cursor-pointer"
              />

              <div className="flex justify-between items-center text-slate-300 pt-1">
                <span>낙엽 불투명도 (차광률):</span>
                <span className="font-mono text-amber-400 font-bold">
                  {Math.round(materialConfig.leavesShade * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.0"
                step="0.05"
                value={materialConfig.leavesShade}
                onChange={(e) =>
                  setMaterialConfig((prev) => ({ ...prev, leavesShade: parseFloat(e.target.value) }))
                }
                className="w-full accent-amber-500 cursor-pointer"
              />

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-400">클릭 도장 또는 무작위 흩뿌리기</span>
                <button
                  onClick={() => onApplyMaterialAction('leaves-scatter')}
                  className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-300 text-[11px] font-medium transition cursor-pointer"
                >
                  🍂 {materialConfig.leavesCount}장 무작위 흩뿌리기
                </button>
              </div>
            </div>
          )}

          {materialConfig.activeMaterial === 'cloud' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-slate-300">
                <span>구름 덮개 면적 비율:</span>
                <span className="font-mono text-cyan-300 font-bold">
                  {materialConfig.cloudCoveragePercent}%
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="60"
                step="5"
                value={materialConfig.cloudCoveragePercent}
                onChange={(e) =>
                  setMaterialConfig((prev) => ({ ...prev, cloudCoveragePercent: parseInt(e.target.value) }))
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />

              <div className="flex justify-between items-center text-slate-300 pt-1">
                <span>구름 투과율 (차광 깊이):</span>
                <span className="font-mono text-cyan-300 font-bold">
                  {Math.round(materialConfig.cloudShade * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.2"
                max="0.8"
                step="0.05"
                value={materialConfig.cloudShade}
                onChange={(e) =>
                  setMaterialConfig((prev) => ({ ...prev, cloudShade: parseFloat(e.target.value) }))
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />

              <div className="flex items-center justify-end pt-1">
                <button
                  onClick={() => onApplyMaterialAction('cloud-cover')}
                  className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-cyan-300 text-[11px] font-medium transition cursor-pointer"
                >
                  ☁ 구름 그림자 광역 적용
                </button>
              </div>
            </div>
          )}

          {materialConfig.activeMaterial === 'defect' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-slate-300">
                <span>결함 셀 션트 저항 R_sh (작을수록 과열 극심):</span>
                <span className="font-mono text-red-400 font-bold">
                  {materialConfig.defectRsh.toFixed(2)} Ω
                </span>
              </div>
              <input
                type="range"
                min="0.2"
                max="5.0"
                step="0.1"
                value={materialConfig.defectRsh}
                onChange={(e) =>
                  setMaterialConfig((prev) => ({ ...prev, defectRsh: parseFloat(e.target.value) }))
                }
                className="w-full accent-red-500 cursor-pointer"
              />
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-400">클릭한 셀에 미세균열 결함 부여</span>
                <button
                  onClick={() => onApplyMaterialAction('defect-preset')}
                  className="px-2.5 py-1 rounded bg-red-950/60 hover:bg-red-900/60 border border-red-800 text-red-300 text-[11px] font-medium transition cursor-pointer"
                >
                  ⚡ 33번 셀 결함 배치
                </button>
              </div>
            </div>
          )}

          {materialConfig.activeMaterial === 'clear' && (
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-300 text-[11px]">캔버스 셀을 클릭해 개별 세척하거나 전체 초기화</span>
              <button
                onClick={() => onApplyMaterialAction('clear-all')}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer flex items-center space-x-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>패널 전체 완전 세척</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Circuit Defense Selector */}
      <div className="pt-2 border-t border-slate-800/80">
        <label className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center space-x-1.5 mb-2">
          <Shield className="w-3.5 h-3.5 text-amber-400" />
          <span>회로적 방어 방식 (Circuit Defense)</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {circuitModes.map((m) => {
            const isSelected = env.circuitMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setEnv((prev) => ({ ...prev, circuitMode: m.id }))}
                className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-amber-950/40 border-amber-500 text-amber-300 shadow-sm ring-1 ring-amber-500/30'
                    : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:bg-slate-800/50'
                }`}
              >
                <div className="text-xs font-semibold">{m.label}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{m.sub}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Cooling Method Selector */}
      <div className="pt-2 border-t border-slate-800/80">
        <label className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center space-x-1.5 mb-2">
          <Snowflake className="w-3.5 h-3.5 text-cyan-400" />
          <span>열 관리 및 냉각 기법 (Thermal Mitigation)</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {coolingModes.map((c) => {
            const isSelected = env.coolingMode === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setEnv((prev) => ({ ...prev, coolingMode: c.id }))}
                className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-950/40 border-cyan-500 text-cyan-300 shadow-sm ring-1 ring-cyan-500/30'
                    : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:bg-slate-800/50'
                }`}
              >
                <div className="text-xs font-semibold">{c.label}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{c.sub}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Operation Point Selector */}
      <div className="pt-2 border-t border-slate-800/80">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
            <Zap className="w-3.5 h-3.5 text-yellow-400" />
            <span>운전점 설정 (Operating Point)</span>
          </span>
          <span className="text-[11px] text-slate-400">
            {env.op === 'mppt' ? '전역 최대출력 추종' : 'IEC 61215 MQT 09 단락(최대 전류의 98%)'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setEnv((prev) => ({ ...prev, op: 'mppt' }))}
            className={`p-2 rounded-lg text-xs font-semibold border text-center transition cursor-pointer ${
              env.op === 'mppt'
                ? 'bg-slate-800 border-yellow-500 text-yellow-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800/50'
            }`}
          >
            MPPT (최대출력점)
          </button>
          <button
            onClick={() => setEnv((prev) => ({ ...prev, op: 'sc' }))}
            className={`p-2 rounded-lg text-xs font-semibold border text-center transition cursor-pointer ${
              env.op === 'sc'
                ? 'bg-red-950/60 border-red-500 text-red-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800/50'
            }`}
          >
            단락 근처 (MQT 09 최악조건)
          </button>
        </div>
      </div>

      {/* 5. Environmental Parameters Sliders */}
      <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
        {/* Irradiance G */}
        <div>
          <div className="flex justify-between text-xs text-slate-300 mb-1">
            <span className="flex items-center space-x-1">
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span>일사량 G (식 1, 2)</span>
            </span>
            <span className="font-mono text-amber-400 font-bold">{env.G} W/m²</span>
          </div>
          <input
            type="range"
            min="100"
            max="1000"
            step="50"
            value={env.G}
            onChange={(e) => setEnv((prev) => ({ ...prev, G: parseInt(e.target.value) }))}
            className="w-full accent-amber-500 cursor-pointer"
          />
        </div>

        {/* Ambient Temperature Ta */}
        <div>
          <div className="flex justify-between text-xs text-slate-300 mb-1">
            <span className="flex items-center space-x-1">
              <Thermometer className="w-3.5 h-3.5 text-red-400" />
              <span>외기 온도 T_amb</span>
            </span>
            <span className="font-mono text-slate-200 font-bold">{env.Ta} °C</span>
          </div>
          <input
            type="range"
            min="-5"
            max="40"
            step="1"
            value={env.Ta}
            onChange={(e) => setEnv((prev) => ({ ...prev, Ta: parseInt(e.target.value) }))}
            className="w-full accent-red-400 cursor-pointer"
          />
        </div>

        {/* Wind Speed Ws */}
        <div>
          <div className="flex justify-between text-xs text-slate-300 mb-1">
            <span className="flex items-center space-x-1">
              <Wind className="w-3.5 h-3.5 text-cyan-400" />
              <span>풍속 W_s (대류 냉각 U1)</span>
            </span>
            <span className="font-mono text-slate-200 font-bold">{env.Ws} m/s</span>
          </div>
          <input
            type="range"
            min="0"
            max="10"
            step="0.5"
            value={env.Ws}
            onChange={(e) => setEnv((prev) => ({ ...prev, Ws: parseFloat(e.target.value) }))}
            className="w-full accent-cyan-400 cursor-pointer"
          />
        </div>

        {/* Smart Bypass Latency */}
        {env.circuitMode === 'smart' && (
          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span className="flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>스마트 바이패스 감지 지연 (τ_lat)</span>
              </span>
              <span className="font-mono text-emerald-400 font-bold">{env.lat} s</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="10"
              step="0.1"
              value={env.lat}
              onChange={(e) => setEnv((prev) => ({ ...prev, lat: parseFloat(e.target.value) }))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>
        )}
      </div>
    </div>
  );
};
