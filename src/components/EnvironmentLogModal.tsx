import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  Download,
  Trash2,
  Search,
  Filter,
  ArrowUpDown,
  Sun,
  Wind,
  Thermometer,
  Layers,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Clock,
  Sparkles,
  ArrowDownToLine,
} from 'lucide-react';
import { EnvironmentLogPoint, EnvironmentState } from '../types/solar.ts';

interface EnvironmentLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  envLog: EnvironmentLogPoint[];
  env: EnvironmentState;
  currentTimeSec: number;
  onClearLog: () => void;
}

export const EnvironmentLogModal: React.FC<EnvironmentLogModalProps> = ({
  isOpen,
  onClose,
  envLog,
  env,
  currentTimeSec,
  onClearLog,
}) => {
  // Filters and table state
  const [timeFilter, setTimeFilter] = useState<'all' | '30' | '60' | '180' | '600'>('all');
  const [onlyFluctuations, setOnlyFluctuations] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [pageSize, setPageSize] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [autoScroll, setAutoScroll] = useState<boolean>(false);

  const tableBottomRef = useRef<HTMLDivElement | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Summary statistics computed across all logged points
  const stats = useMemo(() => {
    if (envLog.length === 0) {
      return null;
    }

    let minTa = Infinity;
    let maxTa = -Infinity;
    let sumTa = 0;
    let maxDeltaTa = 0;

    let minWs = Infinity;
    let maxWs = -Infinity;
    let sumWs = 0;
    let maxDeltaWs = 0;

    let minG = Infinity;
    let maxG = -Infinity;
    let sumG = 0;
    let maxDeltaG = 0;

    let minTm = Infinity;
    let maxTm = -Infinity;
    let sumTm = 0;

    envLog.forEach((pt) => {
      // Ta
      if (pt.effectiveTa < minTa) minTa = pt.effectiveTa;
      if (pt.effectiveTa > maxTa) maxTa = pt.effectiveTa;
      sumTa += pt.effectiveTa;
      if (Math.abs(pt.deltaTa) > maxDeltaTa) maxDeltaTa = Math.abs(pt.deltaTa);

      // Ws
      if (pt.effectiveWs < minWs) minWs = pt.effectiveWs;
      if (pt.effectiveWs > maxWs) maxWs = pt.effectiveWs;
      sumWs += pt.effectiveWs;
      if (Math.abs(pt.deltaWs) > maxDeltaWs) maxDeltaWs = Math.abs(pt.deltaWs);

      // G
      if (pt.effectiveG < minG) minG = pt.effectiveG;
      if (pt.effectiveG > maxG) maxG = pt.effectiveG;
      sumG += pt.effectiveG;
      if (Math.abs(pt.deltaG) > maxDeltaG) maxDeltaG = Math.abs(pt.deltaG);

      // Tm
      if (pt.tm < minTm) minTm = pt.tm;
      if (pt.tm > maxTm) maxTm = pt.tm;
      sumTm += pt.tm;
    });

    const N = envLog.length;
    return {
      count: N,
      latest: envLog[envLog.length - 1],
      ta: {
        avg: Math.round((sumTa / N) * 10) / 10,
        min: minTa,
        max: maxTa,
        maxDelta: Math.round(maxDeltaTa * 10) / 10,
      },
      ws: {
        avg: Math.round((sumWs / N) * 10) / 10,
        min: minWs,
        max: maxWs,
        maxDelta: Math.round(maxDeltaWs * 10) / 10,
      },
      g: {
        avg: Math.round(sumG / N),
        min: minG,
        max: maxG,
        maxDelta: Math.round(maxDeltaG),
      },
      tm: {
        avg: Math.round((sumTm / N) * 10) / 10,
        min: minTm,
        max: maxTm,
      },
    };
  }, [envLog]);

  // Filtered and sorted data
  const filteredData = useMemo(() => {
    let list = [...envLog];

    // Time filter
    if (timeFilter !== 'all') {
      const windowSec = parseInt(timeFilter, 10);
      const minTime = Math.max(0, currentTimeSec - windowSec);
      list = list.filter((pt) => pt.t >= minTime);
    }

    // Only fluctuations filter
    if (onlyFluctuations) {
      list = list.filter(
        (pt) => Math.abs(pt.deltaTa) > 0.05 || Math.abs(pt.deltaWs) > 0.05 || Math.abs(pt.deltaG) >= 1,
      );
    }

    // Search term filter (e.g. searching time like "12.5" or "10")
    if (searchTerm.trim() !== '') {
      const term = searchTerm.trim().toLowerCase();
      list = list.filter(
        (pt) =>
          pt.t.toString().includes(term) ||
          pt.effectiveTa.toString().includes(term) ||
          pt.effectiveWs.toString().includes(term) ||
          pt.effectiveG.toString().includes(term),
      );
    }

    // Sorting
    list.sort((a, b) => (sortOrder === 'desc' ? b.t - a.t : a.t - b.t));

    return list;
  }, [envLog, timeFilter, onlyFluctuations, searchTerm, sortOrder, currentTimeSec]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const pagedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  // Auto-scroll when active
  useEffect(() => {
    if (autoScroll && tableBottomRef.current) {
      tableBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [envLog.length, autoScroll]);

  // CSV Export
  const handleExportCSV = () => {
    if (envLog.length === 0) return;

    const headers = [
      '시각(초)',
      '기준외기온도(℃)',
      '실측외기온도(℃)',
      '온도변동ΔTa(℃)',
      '기준풍속(m/s)',
      '실측풍속(m/s)',
      '풍속변동ΔWs(m/s)',
      '기준일사량(W/m²)',
      '실측일사량(W/m²)',
      '일사량변동ΔG(W/m²)',
      '열평형온도Tm(℃)',
      '최고핫스팟온도(℃)',
      '발전출력(W)',
    ];

    const rows = envLog.map((pt) => [
      pt.t.toFixed(1),
      pt.baseTa.toFixed(1),
      pt.effectiveTa.toFixed(1),
      (pt.deltaTa >= 0 ? `+${pt.deltaTa.toFixed(1)}` : pt.deltaTa.toFixed(1)),
      pt.baseWs.toFixed(1),
      pt.effectiveWs.toFixed(1),
      (pt.deltaWs >= 0 ? `+${pt.deltaWs.toFixed(1)}` : pt.deltaWs.toFixed(1)),
      pt.baseG.toFixed(0),
      pt.effectiveG.toFixed(0),
      (pt.deltaG >= 0 ? `+${pt.deltaG}` : `${pt.deltaG}`),
      pt.tm.toFixed(1),
      pt.hot.toFixed(1),
      pt.P.toFixed(1),
    ]);

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `solar_environment_timeline_log_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-800/80 text-cyan-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  환경 변수 실시간 변동 타임라인 데이터 로그
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                  {envLog.length} Records
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                시뮬레이션 재생 중 대기 열관성, 유체 난류, 일사 광학 투과율에 따라 독립적으로 변화한 온·바람·일사 변동 이력입니다.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportCSV}
              disabled={envLog.length === 0}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-semibold shadow-md shadow-cyan-600/20 transition cursor-pointer"
              title="전체 로그를 CSV 파일로 저장합니다"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV 내보내기</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Statistical Summary KPI Banner */}
        {stats && (
          <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/40 grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
            {/* Ambient Temperature Ta */}
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-red-400 mb-1">
                <span className="flex items-center space-x-1 font-semibold">
                  <Thermometer className="w-3.5 h-3.5" />
                  <span>외기온도 (Ta)</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">기준 {env.Ta}℃</span>
              </div>
              <div className="flex items-baseline justify-between font-mono">
                <span className="text-sm font-bold text-white">
                  {stats.latest.effectiveTa.toFixed(1)} <span className="text-xs text-slate-400">℃</span>
                </span>
                <span className={`text-[11px] font-bold ${stats.latest.deltaTa >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                  {stats.latest.deltaTa >= 0 ? `+${stats.latest.deltaTa.toFixed(1)}` : stats.latest.deltaTa.toFixed(1)}℃
                </span>
              </div>
              <div className="text-[10px] text-slate-400 flex items-center justify-between mt-1 pt-1 border-t border-slate-800/60 font-mono">
                <span>평균: {stats.ta.avg}℃</span>
                <span>범위: {stats.ta.min} ~ {stats.ta.max}℃</span>
              </div>
            </div>

            {/* Wind Speed Ws */}
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-cyan-400 mb-1">
                <span className="flex items-center space-x-1 font-semibold">
                  <Wind className="w-3.5 h-3.5" />
                  <span>풍속 (Ws)</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">기준 {env.Ws}m/s</span>
              </div>
              <div className="flex items-baseline justify-between font-mono">
                <span className="text-sm font-bold text-white">
                  {stats.latest.effectiveWs.toFixed(1)} <span className="text-xs text-slate-400">m/s</span>
                </span>
                <span className={`text-[11px] font-bold ${stats.latest.deltaWs >= 0 ? 'text-cyan-400' : 'text-blue-300'}`}>
                  {stats.latest.deltaWs >= 0 ? `+${stats.latest.deltaWs.toFixed(1)}` : stats.latest.deltaWs.toFixed(1)}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 flex items-center justify-between mt-1 pt-1 border-t border-slate-800/60 font-mono">
                <span>평균: {stats.ws.avg}m/s</span>
                <span>범위: {stats.ws.min} ~ {stats.ws.max}m/s</span>
              </div>
            </div>

            {/* Solar Irradiance G */}
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-amber-400 mb-1">
                <span className="flex items-center space-x-1 font-semibold">
                  <Sun className="w-3.5 h-3.5" />
                  <span>일사량 (G)</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">기준 {env.G}W/m²</span>
              </div>
              <div className="flex items-baseline justify-between font-mono">
                <span className="text-sm font-bold text-white">
                  {stats.latest.effectiveG.toFixed(0)} <span className="text-xs text-slate-400">W/m²</span>
                </span>
                <span className={`text-[11px] font-bold ${stats.latest.deltaG >= 0 ? 'text-amber-400' : 'text-orange-400'}`}>
                  {stats.latest.deltaG >= 0 ? `+${stats.latest.deltaG}` : stats.latest.deltaG}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 flex items-center justify-between mt-1 pt-1 border-t border-slate-800/60 font-mono">
                <span>평균: {stats.g.avg}W/m²</span>
                <span>범위: {stats.g.min} ~ {stats.g.max}</span>
              </div>
            </div>

            {/* Module Equilibrium Tm & Peak Hot */}
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-emerald-400 mb-1">
                <span className="flex items-center space-x-1 font-semibold">
                  <Layers className="w-3.5 h-3.5" />
                  <span>모듈 열평형 & 출력</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">식 (2) 연동</span>
              </div>
              <div className="flex items-baseline justify-between font-mono">
                <span className="text-xs text-slate-300">
                  Tm: <strong className="text-emerald-400 font-bold">{stats.latest.tm.toFixed(1)}℃</strong>
                </span>
                <span className="text-xs text-slate-300">
                  출력: <strong className="text-cyan-300 font-bold">{stats.latest.P.toFixed(1)}W</strong>
                </span>
              </div>
              <div className="text-[10px] text-slate-400 flex items-center justify-between mt-1 pt-1 border-t border-slate-800/60 font-mono">
                <span>최고핫스팟: {stats.latest.hot.toFixed(1)}℃</span>
                <span>경과시간: {currentTimeSec.toFixed(1)}s</span>
              </div>
            </div>
          </div>
        )}

        {/* Filter and Control Bar */}
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            {/* Time Filter Buttons */}
            <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800">
              <span className="px-2 text-[11px] text-slate-400">구간:</span>
              {(['all', '30', '60', '180', '600'] as const).map((tVal) => (
                <button
                  key={tVal}
                  onClick={() => {
                    setTimeFilter(tVal);
                    setCurrentPage(1);
                  }}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                    timeFilter === tVal
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tVal === 'all' ? '전체' : `최근 ${tVal}초`}
                </button>
              ))}
            </div>

            {/* Toggle: Only Fluctuations */}
            <button
              onClick={() => {
                setOnlyFluctuations(!onlyFluctuations);
                setCurrentPage(1);
              }}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition cursor-pointer ${
                onlyFluctuations
                  ? 'bg-amber-950/70 border-amber-700/80 text-amber-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>변동 발생 시점만 (Δ ≠ 0)</span>
            </button>

            {/* Toggle: Sort Order */}
            <button
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition cursor-pointer text-[11px]"
            >
              <ArrowUpDown className="w-3 h-3 text-cyan-400" />
              <span>{sortOrder === 'desc' ? '최신 시점부터 (내림차순)' : '시작 시점부터 (오름차순)'}</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {/* Search Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="시간(s) 또는 수치 검색..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-8 pr-3 py-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs w-36 sm:w-44 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            {/* Page Size Selector */}
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-900 border border-slate-800 text-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none"
            >
              <option value={50}>50개씩</option>
              <option value={100}>100개씩</option>
              <option value={200}>200개씩</option>
              <option value={1000}>1000개씩</option>
            </select>

            {/* Clear log button */}
            <button
              onClick={() => {
                if (window.confirm('기록된 환경 변수 타임라인 로그를 모두 초기화하시겠습니까?')) {
                  onClearLog();
                }
              }}
              disabled={envLog.length === 0}
              className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/40 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
              title="로그 비우기"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto min-h-[300px] relative font-mono text-xs">
          {filteredData.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 space-y-2">
              <Clock className="w-8 h-8 text-slate-600 animate-pulse" />
              <p className="font-semibold text-slate-300">표시할 환경 변수 변동 로그가 없습니다.</p>
              <p className="text-xs text-slate-500 max-w-sm text-center font-sans">
                시뮬레이션 재생(▶)을 실행하면 매 0.5초마다 발생하는 환경 변수(온도, 바람, 일사량)의 실측 변동이 자동으로 실시간 기록됩니다.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-950/95 backdrop-blur z-10 border-b border-slate-800 text-[11px] text-slate-400 font-sans uppercase">
                <tr>
                  <th className="py-2.5 px-3">경과시간 (t)</th>
                  <th className="py-2.5 px-3 text-red-400">외기온도 (Ta)</th>
                  <th className="py-2.5 px-3 text-red-300">온도변동 (ΔTa)</th>
                  <th className="py-2.5 px-3 text-cyan-400">풍속 (Ws)</th>
                  <th className="py-2.5 px-3 text-cyan-300">풍속변동 (ΔWs)</th>
                  <th className="py-2.5 px-3 text-amber-400">일사량 (G)</th>
                  <th className="py-2.5 px-3 text-amber-300">일사변동 (ΔG)</th>
                  <th className="py-2.5 px-3 text-emerald-400">열평형 Tm</th>
                  <th className="py-2.5 px-3 text-rose-400">핫스팟 최고</th>
                  <th className="py-2.5 px-3 text-white">발전출력 P</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {pagedData.map((pt, idx) => {
                  const isTaJitter = Math.abs(pt.deltaTa) >= 0.05;
                  const isWsJitter = Math.abs(pt.deltaWs) >= 0.05;
                  const isGJitter = Math.abs(pt.deltaG) >= 1;

                  return (
                    <tr
                      key={`${pt.t}-${idx}`}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Time */}
                      <td className="py-2 px-3 text-cyan-300 font-bold whitespace-nowrap">
                        {pt.t.toFixed(1)}s
                      </td>

                      {/* Ta */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="text-slate-400 text-[11px] mr-1.5">{pt.baseTa.toFixed(1)} →</span>
                        <span className="text-white font-semibold">{pt.effectiveTa.toFixed(1)}℃</span>
                      </td>

                      {/* Delta Ta */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        {isTaJitter ? (
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              pt.deltaTa > 0
                                ? 'bg-red-950 text-red-400 border border-red-800/60'
                                : 'bg-blue-950 text-blue-400 border border-blue-800/60'
                            }`}
                          >
                            {pt.deltaTa > 0 ? `+${pt.deltaTa.toFixed(1)}` : pt.deltaTa.toFixed(1)}℃
                          </span>
                        ) : (
                          <span className="text-slate-600 text-[11px]">0.0℃</span>
                        )}
                      </td>

                      {/* Ws */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="text-slate-400 text-[11px] mr-1.5">{pt.baseWs.toFixed(1)} →</span>
                        <span className="text-white font-semibold">{pt.effectiveWs.toFixed(1)}m/s</span>
                      </td>

                      {/* Delta Ws */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        {isWsJitter ? (
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              pt.deltaWs > 0
                                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/60'
                                : 'bg-slate-800 text-slate-300 border border-slate-700/60'
                            }`}
                          >
                            {pt.deltaWs > 0 ? `+${pt.deltaWs.toFixed(1)}` : pt.deltaWs.toFixed(1)}m/s
                          </span>
                        ) : (
                          <span className="text-slate-600 text-[11px]">0.0m/s</span>
                        )}
                      </td>

                      {/* G */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="text-slate-400 text-[11px] mr-1.5">{pt.baseG.toFixed(0)} →</span>
                        <span className="text-white font-semibold">{pt.effectiveG.toFixed(0)} W/m²</span>
                      </td>

                      {/* Delta G */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        {isGJitter ? (
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              pt.deltaG > 0
                                ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                                : 'bg-orange-950 text-orange-400 border border-orange-800/60'
                            }`}
                          >
                            {pt.deltaG > 0 ? `+${pt.deltaG}` : pt.deltaG} W/m²
                          </span>
                        ) : (
                          <span className="text-slate-600 text-[11px]">0</span>
                        )}
                      </td>

                      {/* Tm */}
                      <td className="py-2 px-3 text-emerald-300 font-semibold whitespace-nowrap">
                        {pt.tm.toFixed(1)}℃
                      </td>

                      {/* Hot */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            pt.hot >= 130 ? 'text-red-400 font-bold' : pt.hot >= 85 ? 'text-amber-300' : 'text-slate-200'
                          }`}
                        >
                          {pt.hot.toFixed(1)}℃
                        </span>
                      </td>

                      {/* Power */}
                      <td className="py-2 px-3 text-white font-semibold whitespace-nowrap">
                        {pt.P.toFixed(1)}W
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <div ref={tableBottomRef} />
        </div>

        {/* Footer & Pagination */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="text-slate-400">
            총 <strong className="text-cyan-400 font-mono">{filteredData.length}</strong>개 레코드 중{' '}
            <span className="font-mono">
              {filteredData.length > 0 ? `${(currentPage - 1) * pageSize + 1} - ${Math.min(currentPage * pageSize, filteredData.length)}` : '0'}
            </span>
            건 표시 (페이지 <span className="font-mono">{currentPage}</span> / <span className="font-mono">{totalPages}</span>)
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-300 transition cursor-pointer"
            >
              이전
            </button>

            <span className="text-slate-400 font-mono px-1">
              {currentPage} / {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-300 transition cursor-pointer"
            >
              다음
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
