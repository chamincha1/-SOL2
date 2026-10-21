import React, { useState } from 'react';
import { X, BookmarkPlus, Check, Sparkles } from 'lucide-react';
import { EnvironmentState, SimulationMetrics } from '../types/solar.ts';

interface SaveExperimentModalProps {
  isOpen: boolean;
  onClose: () => void;
  env: EnvironmentState;
  metrics: SimulationMetrics | null;
  totalEnergyWh: number;
  timeSec: number;
  t130Sec: number;
  maxT: number;
  onSave: (name: string, note: string) => void;
}

export const SaveExperimentModal: React.FC<SaveExperimentModalProps> = ({
  isOpen,
  onClose,
  env,
  metrics,
  totalEnergyWh,
  timeSec,
  t130Sec,
  maxT,
  onSave,
}) => {
  if (!isOpen || !metrics) return null;

  const defaultModeName =
    env.circuitMode === 'smart'
      ? '스마트 바이패스'
      : env.circuitMode === 'diode'
      ? '표준 다이오드'
      : env.circuitMode === 'optimizer'
      ? 'DC 옵티마이저'
      : '무보호';

  const defaultCoolingName =
    env.coolingMode === 'active-water'
      ? ' (수냉)'
      : env.coolingMode === 'passive-heatsink'
      ? ' (방열판)'
      : env.coolingMode === 'active-air'
      ? ' (공랭)'
      : '';

  const [name, setName] = useState(`${defaultModeName}${defaultCoolingName} 실험 (${metrics.P.toFixed(0)}W)`);
  const [note, setNote] = useState(`일사량 ${env.G}W/m², 기온 ${env.Ta}℃, ${env.op.toUpperCase()} 운전점`);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), note.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <BookmarkPlus className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-white text-base">현재 실험 스냅샷 저장</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Snapshot Summary Box */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-mono space-y-1.5">
          <div className="flex justify-between text-slate-300">
            <span>방어 방식:</span>
            <span className="text-amber-300 font-semibold">{defaultModeName}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>실시간 발전 출력:</span>
            <span className="text-white font-bold">{metrics.P.toFixed(1)} W</span>
          </div>
          <div className="flex justify-between text-emerald-400">
            <span>회복 전력량 (Gain):</span>
            <span className="font-bold">+{metrics.Precovered.toFixed(1)} W</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>최고 핫스팟 온도:</span>
            <span className={metrics.hot >= 130 ? 'text-red-400 font-bold' : 'text-slate-200'}>
              {metrics.hot.toFixed(1)} ℃
            </span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>누적 발전량:</span>
            <span className="text-cyan-300">{totalEnergyWh.toFixed(2)} Wh</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              실험 명칭
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 font-sans"
              placeholder="실험명을 입력하세요"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              연구 메모 / 조건 설명
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-sans resize-none"
              placeholder="실험 조건, 가설 검증 메모 등"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/20 transition cursor-pointer flex items-center space-x-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>보관함에 저장</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
