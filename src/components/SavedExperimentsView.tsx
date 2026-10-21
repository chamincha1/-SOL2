import React, { useState } from 'react';
import {
  FolderArchive,
  Download,
  Trash2,
  CheckSquare,
  Square,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Flame,
  Zap,
  RotateCcw,
  Plus,
} from 'lucide-react';
import { SavedExperiment } from '../types/solar.ts';

interface SavedExperimentsViewProps {
  savedRuns: SavedExperiment[];
  onLoadExperiment: (exp: SavedExperiment) => void;
  onDeleteExperiment: (id: string) => void;
  onOpenSaveModal: () => void;
}

export const SavedExperimentsView: React.FC<SavedExperimentsViewProps> = ({
  savedRuns,
  onLoadExperiment,
  onDeleteExperiment,
  onOpenSaveModal,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    // Select first 2-3 experiments by default for instant side-by-side comparison
    return savedRuns.slice(0, 3).map((r) => r.id);
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const selectedExperiments = savedRuns.filter((r) => selectedIds.includes(r.id));

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-cyan-400 text-xs font-mono mb-1">
            <FolderArchive className="w-4 h-4" />
            <span>SAVED EXPERIMENTS ARCHIVE & COMPARISON</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            실험 기록 보관함 및 다중 실험 나란히 비교
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            수행한 실험 조건과 전력 회복 결과를 저장하고 언제든 불러와 재실행하거나, 저장된 실험끼리 직접 대조 비교하세요.
          </p>
        </div>

        <button
          onClick={onOpenSaveModal}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs shadow-lg shadow-cyan-600/20 transition cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>현재 실험 스냅샷 저장</span>
        </button>
      </div>

      {/* Side-by-Side Comparison Panel if 2 or more selected */}
      {selectedExperiments.length >= 2 && (
        <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl p-5 shadow-xl space-y-3 ring-1 ring-cyan-500/20">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>선택된 {selectedExperiments.length}개 실험 나란히 대조 분석 (Side-by-Side Matrix)</span>
            </h3>
            <span className="text-xs text-slate-400">
              체크박스로 비교할 실험을 자유롭게 선택하세요
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-900/90 text-slate-300 border-b border-slate-800">
                  <th className="py-2.5 px-3 font-semibold">비교 항목</th>
                  {selectedExperiments.map((exp) => (
                    <th key={exp.id} className="py-2.5 px-3 font-semibold font-mono text-cyan-300">
                      {exp.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                <tr>
                  <td className="py-2 px-3 text-slate-400 font-sans">회로 방어 방식</td>
                  {selectedExperiments.map((e) => (
                    <td key={e.id} className="py-2 px-3">
                      {e.env.circuitMode === 'smart'
                        ? '스마트 바이패스 (5셀 MOSFET)'
                        : e.env.circuitMode === 'diode'
                        ? '표준 다이오드 (20셀)'
                        : e.env.circuitMode === 'optimizer'
                        ? 'DC 옵티마이저 (MLPE)'
                        : '무보호 (기준)'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2 px-3 text-slate-400 font-sans">냉각 기법</td>
                  {selectedExperiments.map((e) => (
                    <td key={e.id} className="py-2 px-3">
                      {e.env.coolingMode === 'active-water'
                        ? '능동 수냉 순환'
                        : e.env.coolingMode === 'passive-heatsink'
                        ? '수동 방열판+PCM'
                        : e.env.coolingMode === 'active-air'
                        ? '강제 공랭팬'
                        : '자연 대류'}
                    </td>
                  ))}
                </tr>
                <tr className="bg-slate-900/40">
                  <td className="py-2 px-3 text-slate-400 font-sans">실시간 출력 P (W)</td>
                  {selectedExperiments.map((e) => (
                    <td key={e.id} className="py-2 px-3 font-bold text-white">
                      {e.metrics.P.toFixed(1)} W
                    </td>
                  ))}
                </tr>
                <tr className="bg-emerald-950/20">
                  <td className="py-2 px-3 text-emerald-400 font-sans font-semibold">
                    회복 전력량 (Gain)
                  </td>
                  {selectedExperiments.map((e) => (
                    <td key={e.id} className="py-2 px-3 font-bold text-emerald-300">
                      +{e.metrics.Precovered.toFixed(1)} W (+{e.metrics.recoveryRatePercent.toFixed(0)}%)
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2 px-3 text-slate-400 font-sans">최고 핫스팟 온도 (℃)</td>
                  {selectedExperiments.map((e) => (
                    <td key={e.id} className="py-2 px-3">
                      <span className={e.metrics.hot >= 130 ? 'text-red-400 font-bold' : e.metrics.hot >= 85 ? 'text-amber-300' : 'text-emerald-400'}>
                        {e.metrics.hot.toFixed(1)} ℃
                      </span>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2 px-3 text-slate-400 font-sans">130℃ 초과 시간 (s)</td>
                  {selectedExperiments.map((e) => (
                    <td key={e.id} className="py-2 px-3">
                      <span className={e.metrics.t130Sec > 0 ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                        {e.metrics.t130Sec.toFixed(0)} 초
                      </span>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2 px-3 text-slate-400 font-sans">누적 발전량 (Wh)</td>
                  {selectedExperiments.map((e) => (
                    <td key={e.id} className="py-2 px-3 text-cyan-300">
                      {e.metrics.totalEnergyWh.toFixed(2)} Wh
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Saved Experiments Archive Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <span>보관된 실험 목록 ({savedRuns.length}개)</span>
          </h3>
          <span className="text-xs text-slate-400">
            [불러오기]를 누르면 해당 실험의 60셀 음영 및 파라미터가 캔버스에 즉시 복원됩니다
          </span>
        </div>

        {savedRuns.length === 0 ? (
          <div className="p-8 text-center text-slate-500 bg-slate-950 rounded-xl border border-slate-800">
            저장된 실험이 없습니다. 1번 탭에서 [현재 실험 저장] 버튼을 눌러 실험을 기록해 보세요.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-900/90 text-slate-300 border-b border-slate-800">
                  <th className="py-2.5 px-3 w-8 text-center">선택</th>
                  <th className="py-2.5 px-3 font-semibold">실험명 & 메모</th>
                  <th className="py-2.5 px-3 font-semibold">방어 및 냉각</th>
                  <th className="py-2.5 px-3 font-semibold text-center">기상 환경</th>
                  <th className="py-2.5 px-3 font-semibold text-center">최종 출력</th>
                  <th className="py-2.5 px-3 font-semibold text-center text-emerald-400">회복 전력</th>
                  <th className="py-2.5 px-3 font-semibold text-center">최고 온도</th>
                  <th className="py-2.5 px-3 font-semibold text-center">누적 에너지</th>
                  <th className="py-2.5 px-3 font-semibold text-right">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                {savedRuns.map((exp) => {
                  const isChecked = selectedIds.includes(exp.id);
                  return (
                    <tr key={exp.id} className="hover:bg-slate-900/40 transition">
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => toggleSelect(exp.id)}
                          className="text-slate-400 hover:text-cyan-400 cursor-pointer"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-cyan-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <div className="font-semibold text-slate-100">{exp.name}</div>
                        {exp.note && <div className="text-[11px] text-slate-400 mt-0.5">{exp.note}</div>}
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">{exp.timestamp}</div>
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <span className="text-amber-300 font-medium capitalize">
                          {exp.env.circuitMode === 'smart'
                            ? '스마트 바이패스'
                            : exp.env.circuitMode === 'diode'
                            ? '표준 다이오드'
                            : exp.env.circuitMode === 'optimizer'
                            ? 'DC 옵티마이저'
                            : '무보호'}
                        </span>
                        {exp.env.coolingMode !== 'natural' && (
                          <span className="text-cyan-400 text-[11px] block">
                            + {exp.env.coolingMode === 'active-water' ? '능동 수냉' : exp.env.coolingMode === 'passive-heatsink' ? '방열판' : '공랭'}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center text-[11px]">
                        {exp.env.G}W/m² · {exp.env.Ta}℃ · {exp.env.op.toUpperCase()}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-white">
                        {exp.metrics.P.toFixed(1)} W
                      </td>
                      <td className="py-2.5 px-3 text-center text-emerald-400 font-bold bg-emerald-950/10">
                        +{exp.metrics.Precovered.toFixed(1)} W
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={exp.metrics.hot >= 130 ? 'text-red-400 font-bold' : exp.metrics.hot >= 85 ? 'text-amber-300' : 'text-emerald-400'}>
                          {exp.metrics.hot.toFixed(1)} ℃
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center text-cyan-300">
                        {exp.metrics.totalEnergyWh.toFixed(2)} Wh
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end space-x-2 font-sans">
                          <button
                            onClick={() => onLoadExperiment(exp)}
                            className="px-2.5 py-1 rounded-md bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 text-xs font-medium transition cursor-pointer"
                          >
                            불러오기
                          </button>
                          <button
                            onClick={() => onDeleteExperiment(exp.id)}
                            title="삭제"
                            className="p-1 rounded-md text-slate-500 hover:text-red-400 hover:bg-slate-800 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
