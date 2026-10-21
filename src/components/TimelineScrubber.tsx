import React from 'react';
import { Play, Pause, RotateCcw, FastForward, BookmarkPlus, Clock, ChevronRight, ChevronLeft, FileSpreadsheet } from 'lucide-react';
import { TimelineMaxDuration } from '../types/solar.ts';

interface TimelineScrubberProps {
  currentTime: number;
  maxDuration: TimelineMaxDuration;
  setMaxDuration: (d: TimelineMaxDuration) => void;
  isRunning: boolean;
  setIsRunning: (running: boolean) => void;
  speed: number;
  setSpeed: (speed: number) => void;
  onResetTime: () => void;
  onScrubTime: (targetSec: number) => void;
  onOpenSaveModal: () => void;
  onOpenEnvLogModal?: () => void;
}

export const TimelineScrubber: React.FC<TimelineScrubberProps> = ({
  currentTime,
  maxDuration,
  setMaxDuration,
  isRunning,
  setIsRunning,
  speed,
  setSpeed,
  onResetTime,
  onScrubTime,
  onOpenSaveModal,
  onOpenEnvLogModal,
}) => {
  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const durationOptions: Array<{ value: TimelineMaxDuration; label: string }> = [
    { value: 300, label: '300초 (5분)' },
    { value: 600, label: '600초 (10분)' },
    { value: 1800, label: '1800초 (30분)' },
    { value: 3600, label: '3600초 (1시간)' },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xl space-y-3">
      {/* Top Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center space-x-2">
          {/* Play / Pause Button */}
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shadow-md transition cursor-pointer ${
              isRunning
                ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
            }`}
          >
            {isRunning ? <Pause className="w-3.5 h-3.5 fill-white" /> : <Play className="w-3.5 h-3.5 fill-white" />}
            <span>{isRunning ? '일시 정지' : '실험 가동'}</span>
          </button>

          {/* Reset Time Button */}
          <button
            onClick={onResetTime}
            title="시간 및 온도 초기화"
            className="p-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Step buttons */}
          <button
            onClick={() => onScrubTime(Math.max(0, currentTime - 10))}
            title="10초 뒤로"
            className="p-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onScrubTime(Math.min(maxDuration, currentTime + 10))}
            title="10초 앞으로"
            className="p-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Speed Selector */}
          <div className="flex items-center space-x-1 bg-slate-950 px-1 py-0.5 rounded-xl border border-slate-800 text-xs">
            <FastForward className="w-3 h-3 text-slate-500 ml-1" />
            {[5, 20, 60].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-mono transition cursor-pointer ${
                  speed === s ? 'bg-cyan-500 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Right side: Max duration selector & Save Experiment button */}
        <div className="flex items-center space-x-2.5">
          <div className="flex items-center space-x-1 text-xs">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400 text-[11px] hidden sm:inline">실험 시간:</span>
            <select
              value={maxDuration}
              onChange={(e) => setMaxDuration(parseInt(e.target.value) as TimelineMaxDuration)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2 py-1 font-mono focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              {durationOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {onOpenEnvLogModal && (
            <button
              onClick={onOpenEnvLogModal}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-cyan-300 text-xs font-semibold shadow-sm transition cursor-pointer"
              title="실시간 환경 변동 타임라인 로그 테이블 보기"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
              <span>환경 변동 로그</span>
            </button>
          )}

          <button
            onClick={onOpenSaveModal}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-cyan-950 hover:bg-cyan-900 border border-cyan-800/80 text-cyan-300 text-xs font-semibold shadow-sm transition cursor-pointer"
          >
            <BookmarkPlus className="w-3.5 h-3.5 text-cyan-400" />
            <span>현재 실험 저장</span>
          </button>
        </div>
      </div>

      {/* Timeline Scrubbing Slider */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center space-x-1.5">
            <span className="text-cyan-400 font-bold text-sm tabular-nums">
              {currentTime.toFixed(1)}초
            </span>
            <span className="text-slate-400 text-[11px]">({formatTime(currentTime)})</span>
          </div>
          <div className="text-slate-400 text-[11px]">
            최대 {maxDuration}초 ({formatTime(maxDuration)})
          </div>
        </div>

        <div className="relative flex items-center">
          <input
            type="range"
            min="0"
            max={maxDuration}
            step="0.5"
            value={Math.min(maxDuration, currentTime)}
            onChange={(e) => onScrubTime(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
        </div>
      </div>
    </div>
  );
};
