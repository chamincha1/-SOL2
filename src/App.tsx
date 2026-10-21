import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sun, Activity, BarChart3, FolderArchive } from 'lucide-react';
import {
  CircuitDefenseMode,
  CoolingMode,
  EnvironmentState,
  SimStateInternal,
  SimulationMetrics,
  TimelineMaxDuration,
  SavedExperiment,
  ShadingMaterialType,
  MaterialConfig,
} from './types/solar.ts';
import {
  N_CELLS,
  calculateTm,
  createNewSimState,
  runSimulationStep,
} from './physics/solarPhysics.ts';
import { ModuleCanvas } from './components/ModuleCanvas.tsx';
import { ControlDeck } from './components/ControlDeck.tsx';
import { PowerMetricsBar } from './components/PowerMetricsBar.tsx';
import { WaveformCharts } from './components/WaveformCharts.tsx';
import { ComparisonLab } from './components/ComparisonLab.tsx';
import { TimelineScrubber } from './components/TimelineScrubber.tsx';
import { SavedExperimentsView } from './components/SavedExperimentsView.tsx';
import { SaveExperimentModal } from './components/SaveExperimentModal.tsx';
import { EnvironmentLogModal } from './components/EnvironmentLogModal.tsx';

// Pre-seeded initial experiments matching Table 6-1 from Research Paper
const INITIAL_PRESEEDED_RUNS: SavedExperiment[] = [
  {
    id: 'seed-1',
    timestamp: '2026-10-19 10:00 (사전 실측 데이터)',
    name: 'A-1 분변 1셀 - 무보호 (기준 대조군)',
    note: '표 6-1 재현: 봉지재 열화 위험 영역 156.7℃ 급상승, 출력 손실 48%',
    env: {
      G: 1000,
      Ta: 25,
      Ws: 1.0,
      circuitMode: 'none',
      coolingMode: 'natural',
      op: 'mppt',
      lat: 0.5,
      speed: 20,
      brush: '0.6',
      tempJitter: false,
      windJitter: false,
      solarJitter: false,
      dynamicCloud: false,
    },
    shade: (() => {
      const s = new Array(N_CELLS).fill(0);
      s[25] = 0.6;
      return s;
    })(),
    defect: new Array(N_CELLS).fill(false),
    metrics: {
      P: 115.3,
      Pid: 221.7,
      Pnone: 115.3,
      Precovered: 0.0,
      recoveryRatePercent: 0.0,
      hot: 56.4,
      totalEnergyWh: 9.61,
      energyGainWh: 0.0,
      t130Sec: 0,
      maxT: 56.4,
      elapsedTimeSec: 300,
    },
  },
  {
    id: 'seed-2',
    timestamp: '2026-10-19 10:05 (사전 실측 데이터)',
    name: 'A-1 분변 1셀 - 표준 바이패스 다이오드',
    note: '표 6-1 재현: 20셀 단위 우회로 인해 156.7℃로 130℃ 252초간 초과',
    env: {
      G: 1000,
      Ta: 25,
      Ws: 1.0,
      circuitMode: 'diode',
      coolingMode: 'natural',
      op: 'mppt',
      lat: 0.5,
      speed: 20,
      brush: '0.6',
      tempJitter: false,
      windJitter: false,
      solarJitter: false,
      dynamicCloud: false,
    },
    shade: (() => {
      const s = new Array(N_CELLS).fill(0);
      s[25] = 0.6;
      return s;
    })(),
    defect: new Array(N_CELLS).fill(false),
    metrics: {
      P: 144.7,
      Pid: 221.7,
      Pnone: 115.3,
      Precovered: 29.4,
      recoveryRatePercent: 25.5,
      hot: 156.7,
      totalEnergyWh: 12.06,
      energyGainWh: 2.45,
      t130Sec: 252,
      maxT: 156.7,
      elapsedTimeSec: 300,
    },
  },
  {
    id: 'seed-3',
    timestamp: '2026-10-19 10:10 (사전 실측 데이터)',
    name: 'A-1 분변 1셀 - 제안: 스마트 바이패스',
    note: '표 6-1 재현: 5셀 단위 조기 감지로 76.5℃ 완벽 억제, 출력 204.4W로 약 41% 회복!',
    env: {
      G: 1000,
      Ta: 25,
      Ws: 1.0,
      circuitMode: 'smart',
      coolingMode: 'natural',
      op: 'mppt',
      lat: 0.5,
      speed: 20,
      brush: '0.6',
      tempJitter: false,
      windJitter: false,
      solarJitter: false,
      dynamicCloud: false,
    },
    shade: (() => {
      const s = new Array(N_CELLS).fill(0);
      s[25] = 0.6;
      return s;
    })(),
    defect: new Array(N_CELLS).fill(false),
    metrics: {
      P: 204.4,
      Pid: 221.7,
      Pnone: 115.3,
      Precovered: 89.1,
      recoveryRatePercent: 77.3,
      hot: 76.5,
      totalEnergyWh: 17.01,
      energyGainWh: 7.4,
      t130Sec: 0,
      maxT: 76.5,
      elapsedTimeSec: 300,
    },
  },
];

export const App: React.FC = () => {
  // Active Navigation Tab: 'live' | 'compare' | 'saved'
  const [activeTab, setActiveTab] = useState<'live' | 'compare' | 'saved'>('live');

  // Timeline max duration (300s, 600s, 1800s, 3600s)
  const [maxDuration, setMaxDuration] = useState<TimelineMaxDuration>(600);

  // Environmental & Simulation settings
  const [env, setEnv] = useState<EnvironmentState>({
    G: 1000,
    Ta: 25,
    Ws: 1.0,
    circuitMode: 'smart',
    coolingMode: 'natural',
    op: 'mppt',
    lat: 0.5,
    speed: 20,
    brush: '0.6',
    tempJitter: false,
    windJitter: false,
    solarJitter: false,
    dynamicCloud: false,
  });

  // Material direct configurator state
  const [materialConfig, setMaterialConfig] = useState<MaterialConfig>({
    activeMaterial: 'bird',
    birdShade: 0.6,
    birdClusterSize: 1,
    leavesShade: 1.0,
    leavesCount: 4,
    cloudShade: 0.4,
    cloudCoveragePercent: 30,
    defectRsh: 0.8,
  });

  const [isRunning, setIsRunning] = useState<boolean>(true);

  // 60-cell arrays
  const [shade, setShade] = useState<number[]>(() => {
    const s = new Array(N_CELLS).fill(0);
    s[25] = 0.6; // Default to Preset A-1
    return s;
  });

  const [defect, setDefect] = useState<boolean[]>(() => new Array(N_CELLS).fill(false));

  // Cell material types metadata
  const [cellMaterials, setCellMaterials] = useState<Array<ShadingMaterialType | null>>(() => {
    const m = new Array(N_CELLS).fill(null);
    m[25] = 'bird';
    return m;
  });

  // Simulation Internal State
  const [simState, setSimState] = useState<SimStateInternal>(() => {
    const tm = 25 + 1000 / (25 + 6.84 * 1);
    return createNewSimState(tm);
  });

  // Current calculated metrics snapshot
  const [metrics, setMetrics] = useState<SimulationMetrics | null>(null);

  // Separate atmospheric stochastic jitter (random walk) state variables
  const [taJitter, setTaJitter] = useState<number>(0);
  const [wsJitter, setWsJitter] = useState<number>(0);
  const [gJitter, setGJitter] = useState<number>(0);

  // Saved Experiments list (persisted in localStorage)
  const [savedRuns, setSavedRuns] = useState<SavedExperiment[]>(() => {
    try {
      const stored = localStorage.getItem('sol2_saved_experiments');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_PRESEEDED_RUNS;
  });

  // Save Modal open state
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

  // Environmental Timeline Log Modal open state
  const [isEnvLogModalOpen, setIsEnvLogModalOpen] = useState(false);

  // Clear Environmental Log
  const handleClearEnvLog = useCallback(() => {
    setSimState((prev) => {
      const updated = { ...prev, envLog: [] };
      simStateRef.current = updated;
      return updated;
    });
    showToast('환경 변동 타임라인 로그가 초기화되었습니다.');
  }, []);

  // Toast alert
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Persist saved runs
  useEffect(() => {
    try {
      localStorage.setItem('sol2_saved_experiments', JSON.stringify(savedRuns));
    } catch {
      // ignore
    }
  }, [savedRuns]);

  // Animation frame loop refs
  const lastTsRef = useRef<number>(performance.now());
  const accDtRef = useRef<number>(0);
  const reqRef = useRef<number | null>(null);

  // Separate refs for independent random walk state (ensures strict decoupling and zero-lag physics updates)
  const taJitterRef = useRef<number>(0);
  const wsJitterRef = useRef<number>(0);
  const gJitterRef = useRef<number>(0);

  const envRef = useRef(env);
  envRef.current = env;
  const shadeRef = useRef(shade);
  shadeRef.current = shade;
  const defectRef = useRef(defect);
  defectRef.current = defect;
  const materialConfigRef = useRef(materialConfig);
  materialConfigRef.current = materialConfig;
  const simStateRef = useRef(simState);
  simStateRef.current = simState;
  const isRunningRef = useRef(isRunning);
  isRunningRef.current = isRunning;
  const maxDurationRef = useRef(maxDuration);
  maxDurationRef.current = maxDuration;

  // Reset simulation time and temperatures
  const handleResetTime = useCallback(() => {
    taJitterRef.current = 0;
    wsJitterRef.current = 0;
    gJitterRef.current = 0;
    setTaJitter(0);
    setWsJitter(0);
    setGJitter(0);
    const tm = calculateTm(envRef.current);
    const fresh = createNewSimState(tm);
    simStateRef.current = fresh;
    setSimState(fresh);
    setIsRunning(false);
  }, []);

  // Scrub time slider
  const handleScrubTime = useCallback((targetSec: number) => {
    setIsRunning(false);
    setSimState((prev) => {
      const updated = { ...prev, t: targetSec };
      simStateRef.current = updated;
      return updated;
    });
  }, []);

  // Cell Click Painting using Current Material Stamp
  const handleCellClick = (index: number) => {
    const mat = materialConfig.activeMaterial;

    setCellMaterials((prev) => {
      const next = [...prev];
      next[index] = mat === 'clear' ? null : mat;
      return next;
    });

    setShade((prev) => {
      const next = [...prev];
      if (mat === 'bird') {
        next[index] = materialConfig.birdShade;
      } else if (mat === 'leaves') {
        next[index] = materialConfig.leavesShade;
      } else if (mat === 'cloud') {
        next[index] = materialConfig.cloudShade;
      } else if (mat === 'defect') {
        // defect cell also produces slightly less photogenerated current
      } else if (mat === 'clear') {
        next[index] = 0;
      }
      return next;
    });

    setDefect((prev) => {
      const next = [...prev];
      if (mat === 'defect') {
        next[index] = true;
      } else if (mat === 'clear') {
        next[index] = false;
      }
      return next;
    });
  };

  // Material Predefined Actions
  const handleApplyMaterialAction = (
    actionType: 'bird-preset' | 'leaves-scatter' | 'cloud-cover' | 'defect-preset' | 'clear-all',
  ) => {
    if (actionType === 'bird-preset') {
      // Attach bird dropping on cell 25
      setShade((prev) => {
        const next = [...prev];
        next[25] = materialConfig.birdShade;
        return next;
      });
      setDefect((prev) => {
        const next = [...prev];
        next[25] = false;
        return next;
      });
      setCellMaterials((prev) => {
        const next = [...prev];
        next[25] = 'bird';
        return next;
      });
      showToast(`25번 셀에 새 분변(${Math.round(materialConfig.birdShade * 100)}% 차광)을 부착했습니다.`);
    } else if (actionType === 'leaves-scatter') {
      // Scatter N leaves randomly
      const nextShade = [...shade];
      const nextMat = [...cellMaterials];
      const count = materialConfig.leavesCount;

      // Seed indices
      const candidates = [24, 25, 34, 35, 14, 15, 23, 26, 44, 45];
      for (let i = 0; i < count; i++) {
        const idx = candidates[i % candidates.length];
        nextShade[idx] = materialConfig.leavesShade;
        nextMat[idx] = 'leaves';
      }
      setShade(nextShade);
      setCellMaterials(nextMat);
      showToast(`낙엽 ${count}장(${Math.round(materialConfig.leavesShade * 100)}% 차광)을 패널에 흩뿌렸습니다.`);
    } else if (actionType === 'cloud-cover') {
      // Cloud coverage
      const targetCount = Math.round((materialConfig.cloudCoveragePercent / 100) * N_CELLS);
      const nextShade = [...shade];
      const nextMat = [...cellMaterials];

      for (let i = 0; i < targetCount; i++) {
        nextShade[i] = materialConfig.cloudShade;
        nextMat[i] = 'cloud';
      }
      setShade(nextShade);
      setCellMaterials(nextMat);
      showToast(`구름 그림자(${materialConfig.cloudCoveragePercent}% 면적, ${Math.round(materialConfig.cloudShade * 100)}% 차광)를 적용했습니다.`);
    } else if (actionType === 'defect-preset') {
      // Defect on cell 33
      setDefect((prev) => {
        const next = [...prev];
        next[33] = true;
        return next;
      });
      setCellMaterials((prev) => {
        const next = [...prev];
        next[33] = 'defect';
        return next;
      });
      showToast(`33번 셀에 미세균열 결함(R_sh = ${materialConfig.defectRsh}Ω)을 배치했습니다.`);
    } else if (actionType === 'clear-all') {
      setShade(new Array(N_CELLS).fill(0));
      setDefect(new Array(N_CELLS).fill(false));
      setCellMaterials(new Array(N_CELLS).fill(null));
      showToast('패널의 모든 음영과 결함을 깨끗이 세척했습니다.');
    }
  };

  // Save Current Experiment
  const handleSaveCurrentExperiment = (name: string, note: string) => {
    if (!metrics) return;
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const newExperiment: SavedExperiment = {
      id: `exp-${Date.now()}`,
      timestamp: timeStr,
      name,
      note,
      env: { ...env },
      shade: [...shade],
      defect: [...defect],
      metrics: {
        P: metrics.P,
        Pid: metrics.Pid,
        Pnone: metrics.Pnone,
        Precovered: metrics.Precovered,
        recoveryRatePercent: metrics.recoveryRatePercent,
        hot: metrics.hot,
        totalEnergyWh: simState.E,
        energyGainWh: Math.max(0, simState.E - simState.Enone),
        t130Sec: simState.t130,
        maxT: simState.maxT,
        elapsedTimeSec: simState.t,
      },
    };

    setSavedRuns((prev) => [newExperiment, ...prev]);
    showToast(`'${name}' 실험이 보관함에 저장되었습니다.`);
  };

  // Load Saved Experiment
  const handleLoadExperiment = (exp: SavedExperiment) => {
    setEnv({ ...exp.env });
    setShade([...exp.shade]);
    setDefect([...exp.defect]);

    const tm = calculateTm(exp.env);
    const fresh = createNewSimState(tm);
    simStateRef.current = fresh;
    setSimState(fresh);
    setIsRunning(true);
    setActiveTab('live');
    showToast(`'${exp.name}' 실험을 불러왔습니다. 1번 탭에서 시뮬레이션을 가동합니다.`);
  };

  // Delete Saved Experiment
  const handleDeleteExperiment = (id: string) => {
    setSavedRuns((prev) => prev.filter((r) => r.id !== id));
    showToast('실험 기록이 삭제되었습니다.');
  };

  // Main Simulation Physics Loop
  useEffect(() => {
    const simLoop = (ts: number) => {
      const deltaSec = Math.min(0.1, (ts - lastTsRef.current) / 1000);
      lastTsRef.current = ts;

      const currentEnv = envRef.current;
      const currentShade = shadeRef.current;
      const currentDefect = defectRef.current;
      const currentMatCfg = materialConfigRef.current;
      const currentS = simStateRef.current;
      const currentMaxDur = maxDurationRef.current;

      if (isRunningRef.current) {
        if (currentS.t >= currentMaxDur) {
          setIsRunning(false);
          isRunningRef.current = false;
        } else {
          accDtRef.current += deltaSec * currentEnv.speed;
          let steps = 0;
          let lastRes: SimulationMetrics | null = null;

          while (accDtRef.current >= 0.5 && steps < 6) {
            // Optional Dynamic Cloud Drift (Section 5.6)
            if (currentEnv.dynamicCloud) {
              const colCenter = Math.floor((currentS.t * (currentEnv.Ws + 0.5) * 0.12) % 15) - 2;
              for (let r = 0; r < 6; r++) {
                for (let c = 0; c < 10; c++) {
                  const idx = r * 10 + c;
                  if (!currentDefect[idx] && currentShade[idx] !== 0.6 && currentShade[idx] !== 1.0) {
                    const dist = Math.abs(c - colCenter);
                    if (dist <= 1 && r >= 1 && r <= 4) {
                      currentShade[idx] = currentMatCfg.cloudShade;
                    } else if (currentShade[idx] === currentMatCfg.cloudShade) {
                      currentShade[idx] = 0;
                    }
                  }
                }
              }
            }

            // 1. Ambient Temperature (Ta) Independent Random Walk:
            // Sluggish thermal mass drift strictly bounded within ±5.0°C of base setpoint
            if (currentEnv.tempJitter) {
              const xi_Ta = (Math.random() - 0.5) * 2;
              const dtStep = 0.5;
              const meanReversion = -0.05 * taJitterRef.current * dtStep;
              const diffusion = 0.38 * Math.sqrt(dtStep) * xi_Ta;
              taJitterRef.current = Math.max(-5.0, Math.min(5.0, taJitterRef.current + meanReversion + diffusion));
            } else {
              taJitterRef.current = 0;
            }

            // 2. Wind Speed (Ws) Independent Random Walk:
            // Aerodynamic turbulent gust dynamics (m/s), independent noise & higher frequency
            if (currentEnv.windJitter) {
              const xi_Ws = (Math.random() - 0.5) * 2;
              const dtStep = 0.5;
              const meanReversion = -0.14 * wsJitterRef.current * dtStep;
              const diffusion = 0.32 * Math.sqrt(dtStep) * xi_Ws;
              wsJitterRef.current = Math.max(-currentEnv.Ws, Math.min(6.0, wsJitterRef.current + meanReversion + diffusion));
            } else {
              wsJitterRef.current = 0;
            }

            // 3. Solar Irradiation (G) Independent Random Walk:
            // Optical atmospheric transmission & cloud micro-edge jitter (W/m²), independent noise
            if (currentEnv.solarJitter) {
              const xi_G = (Math.random() - 0.5) * 2;
              const dtStep = 0.5;
              const meanReversion = -0.10 * gJitterRef.current * dtStep;
              const diffusion = 14.0 * Math.sqrt(dtStep) * xi_G;
              gJitterRef.current = Math.max(-100, Math.min(100, gJitterRef.current + meanReversion + diffusion));
            } else {
              gJitterRef.current = 0;
            }

            lastRes = runSimulationStep(
              currentS,
              currentEnv,
              currentShade,
              currentDefect,
              0.5,
              currentMatCfg.defectRsh,
              {
                deltaTa: taJitterRef.current,
                deltaWs: wsJitterRef.current,
                deltaG: gJitterRef.current,
              },
            );
            accDtRef.current -= 0.5;
            steps++;
            if (currentS.t >= currentMaxDur) break;
          }

          if (steps > 0 && lastRes) {
            setMetrics(lastRes);
            setSimState({ ...currentS });
            setTaJitter(taJitterRef.current);
            setWsJitter(wsJitterRef.current);
            setGJitter(gJitterRef.current);
          }
        }
      } else {
        const staticRes = runSimulationStep(
          currentS,
          currentEnv,
          currentShade,
          currentDefect,
          0,
          currentMatCfg.defectRsh,
          {
            deltaTa: taJitterRef.current,
            deltaWs: wsJitterRef.current,
            deltaG: gJitterRef.current,
          },
        );
        setMetrics(staticRes);
      }

      reqRef.current = requestAnimationFrame(simLoop);
    };

    lastTsRef.current = performance.now();
    reqRef.current = requestAnimationFrame(simLoop);

    return () => {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-900 selection:text-white">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-3 right-4 z-50 bg-emerald-600 text-white text-xs px-4 py-2.5 rounded-xl shadow-2xl flex items-center space-x-2 animate-in slide-in-from-top-2">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center space-x-3 shrink-0">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-amber-500/20 text-white font-bold">
              <Sun className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight text-white">-SOL2</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                  HOTSPOT LAB
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden md:block">
                상산고 Sol2 · 태양광 핫스팟 방어 & 전력 회복 수치 시뮬레이터
              </p>
            </div>
          </div>

          {/* 3 Main Navigation Tabs */}
          <nav className="flex items-center space-x-1 sm:space-x-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('live')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'live'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>실시간 모듈 실험</span>
            </button>

            <button
              onClick={() => setActiveTab('compare')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'compare'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>비교 및 스윕 랩</span>
            </button>

            <button
              onClick={() => setActiveTab('saved')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'saved'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <FolderArchive className="w-3.5 h-3.5" />
              <span>실험 보관함 ({savedRuns.length})</span>
            </button>
          </nav>

          {/* Quick status on right */}
          <div className="hidden lg:flex items-center space-x-3 text-xs font-mono shrink-0">
            <span className="text-slate-400">
              운전: <strong className={env.op === 'mppt' ? 'text-yellow-400' : 'text-red-400'}>{env.op.toUpperCase()}</strong>
            </span>
            <span className="text-slate-400">
              시간: <strong className="text-cyan-400">{simState.t.toFixed(0)}s</strong>
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5 flex-1">
        {/* Compact 1-Row KPI Metric Bar (Fixed at top across all tabs) */}
        <PowerMetricsBar
          metrics={metrics}
          totalEnergyWh={simState.E}
          energyGainWh={Math.max(0, simState.E - simState.Enone)}
          timeSec={simState.t}
          t130Sec={simState.t130}
          maxT={simState.maxT}
        />

        {/* TAB 1: Live 60-Cell Module Lab */}
        {activeTab === 'live' && (
          <div className="space-y-5 animate-in fade-in-50 duration-150">
            {/* Interactive Timeline Scrubber (0 ~ 3600s) */}
            <TimelineScrubber
              currentTime={simState.t}
              maxDuration={maxDuration}
              setMaxDuration={setMaxDuration}
              isRunning={isRunning}
              setIsRunning={setIsRunning}
              speed={env.speed}
              setSpeed={(spd) => setEnv((prev) => ({ ...prev, speed: spd }))}
              onResetTime={handleResetTime}
              onScrubTime={handleScrubTime}
              onOpenSaveModal={() => setIsSaveModalOpen(true)}
              onOpenEnvLogModal={() => setIsEnvLogModalOpen(true)}
            />

            {/* 2-Zone Sandbox: Canvas (7 cols) + Direct Material Controls (5 cols) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <div className="lg:col-span-7">
                <ModuleCanvas
                  simState={simState}
                  metrics={metrics}
                  shade={shade}
                  defect={defect}
                  cellMaterials={cellMaterials}
                  circuitMode={env.circuitMode}
                  coolingMode={env.coolingMode}
                  activeMaterial={materialConfig.activeMaterial}
                  onCellClick={handleCellClick}
                />
              </div>

              <div className="lg:col-span-5">
                <ControlDeck
                  env={env}
                  setEnv={setEnv}
                  materialConfig={materialConfig}
                  setMaterialConfig={setMaterialConfig}
                  onApplyMaterialAction={handleApplyMaterialAction}
                  metrics={metrics}
                  taJitter={taJitter}
                  wsJitter={wsJitter}
                  gJitter={gJitter}
                  onOpenEnvLogModal={() => setIsEnvLogModalOpen(true)}
                  envLogCount={simState.envLog?.length || 0}
                />
              </div>
            </div>

            {/* Live Waveform Graphs (Enlarged with hover inspector & Environment Jitter Waveforms) */}
            <WaveformCharts
              history={simState.h}
              elapsedTime={simState.t}
              maxT={simState.maxT}
              envLog={simState.envLog}
              onOpenEnvLogModal={() => setIsEnvLogModalOpen(true)}
            />
          </div>
        )}

        {/* TAB 2: Multi-Method Comparison & Sweep Lab */}
        {activeTab === 'compare' && (
          <div className="animate-in fade-in-50 duration-150">
            <ComparisonLab
              env={env}
              setEnv={setEnv}
              shade={shade}
              defect={defect}
            />
          </div>
        )}

        {/* TAB 3: Saved Experiments Archive & Side-by-Side Comparison */}
        {activeTab === 'saved' && (
          <div className="animate-in fade-in-50 duration-150">
            <SavedExperimentsView
              savedRuns={savedRuns}
              onLoadExperiment={handleLoadExperiment}
              onDeleteExperiment={handleDeleteExperiment}
              onOpenSaveModal={() => setIsSaveModalOpen(true)}
            />
          </div>
        )}
      </main>

      {/* Save Experiment Modal */}
      <SaveExperimentModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        env={env}
        metrics={metrics}
        totalEnergyWh={simState.E}
        timeSec={simState.t}
        t130Sec={simState.t130}
        maxT={simState.maxT}
        onSave={handleSaveCurrentExperiment}
      />

      {/* Environmental Variables Timeline Data Log Modal */}
      <EnvironmentLogModal
        isOpen={isEnvLogModalOpen}
        onClose={() => setIsEnvLogModalOpen(false)}
        envLog={simState.envLog || []}
        env={env}
        currentTimeSec={simState.t}
        onClearLog={handleClearEnvLog}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div>
            <strong>Sol2 핫스팟 방어 & 전력 회복 시뮬레이터</strong> — 음영 물질 직접 제어 도구 및 대형 파형 툴팁 검측 시스템
          </div>
          <div className="font-mono text-slate-600">
            2026 교과심화탐구 발표회 · 팀 Sol2 · 상산고등학교
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
