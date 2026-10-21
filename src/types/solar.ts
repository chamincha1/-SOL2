export type CircuitDefenseMode = 'none' | 'diode' | 'smart' | 'optimizer';

export type CoolingMode = 'natural' | 'passive-heatsink' | 'active-water' | 'active-air';

export type OperationPoint = 'mppt' | 'sc'; // MPPT or Short-Circuit near (IEC 61215 MQT 09)

export type BrushMode = '0' | '0.3' | '0.6' | '1' | 'd'; // Legacy brush mode

export type ShadingMaterialType = 'bird' | 'leaves' | 'cloud' | 'defect' | 'clear';

export type TimelineMaxDuration = 300 | 600 | 1800 | 3600;

export interface MaterialConfig {
  activeMaterial: ShadingMaterialType;
  birdShade: number; // 0.1 to 1.0 (default 0.6)
  birdClusterSize: number; // 1 to 3
  leavesShade: number; // 0.5 to 1.0 (default 1.0)
  leavesCount: number; // 1 to 8
  cloudShade: number; // 0.2 to 0.8 (default 0.4)
  cloudCoveragePercent: number; // 10 to 60 (default 30)
  defectRsh: number; // 0.2 to 5.0 (default 0.8 Ω)
}

export interface StochasticJitterOffset {
  deltaTa?: number;
  deltaWs?: number;
  deltaG?: number;
}

export interface EnvironmentState {
  G: number; // Irradiance W/m² (100 to 1000)
  Ta: number; // Ambient Temperature °C (-5 to 40)
  Ws: number; // Wind speed m/s (0 to 10)
  circuitMode: CircuitDefenseMode;
  coolingMode: CoolingMode;
  op: OperationPoint;
  lat: number; // Smart bypass sensing latency (0.1 to 10 s)
  speed: number; // 5, 20, 60
  brush: BrushMode;
  // Natural independent fluctuations
  tempJitter: boolean; // Independent ±5°C ambient temperature fluctuation
  windJitter: boolean; // Independent m/s wind airflow drift / turbulence
  solarJitter: boolean; // Independent W/m² solar irradiation fluctuation
  dynamicCloud: boolean; // Moving cloud across the panel
}

export interface SimulationMetrics {
  I: number; // String Current (A)
  V: number; // String Voltage (V)
  P: number; // Current Output Power (W)
  Pid: number; // Ideal Power under STC formula (W)
  Pnone: number; // Unprotected power under identical shading (W)
  Precovered: number; // P - Pnone (W)
  recoveryRatePercent: number; // ((P - Pnone) / max(Pnone, 1)) * 100 (%)
  hot: number; // Highest cell temp (°C)
  hi: number; // Index of hottest cell (0-59)
  Ph: number; // Hotspot dissipated power P_hot (W)
  tm: number; // Baseline module temperature Tm (°C)
  diodeOnCount: number; // 0 to 3
  smartOnCount: number; // 0 to 12
  dOn: [number, number, number]; // Diode D1, D2, D3 active states
  // Live fluctuated effective environment
  effectiveTa: number;
  effectiveWs: number;
  effectiveG: number;
}

export interface EnvironmentLogPoint {
  t: number;          // Elapsed simulation time (s)
  baseTa: number;     // Configured baseline ambient temperature (°C)
  effectiveTa: number;// Actual fluctuating ambient temperature (°C)
  deltaTa: number;    // Ta fluctuation delta (°C)
  baseWs: number;     // Configured baseline wind speed (m/s)
  effectiveWs: number;// Actual fluctuating wind speed (m/s)
  deltaWs: number;    // Ws fluctuation delta (m/s)
  baseG: number;      // Configured baseline irradiance (W/m²)
  effectiveG: number; // Actual fluctuating irradiance (W/m²)
  deltaG: number;     // G fluctuation delta (W/m²)
  tm: number;         // Equilibrium module temperature calculated from effective env (°C)
  hot: number;        // Maximum cell temperature (°C)
  P: number;          // Current output power (W)
}

export interface SimStateInternal {
  T: number[]; // Cell temperatures (length 60)
  arm: boolean[]; // Smart bypass 12 groups active state
  tm: number[]; // Smart bypass trigger accumulator timer (length 12)
  t: number; // Elapsed simulation time (s)
  E: number; // Cumulative energy (Wh)
  Enone: number; // Cumulative energy without protection (Wh)
  maxT: number; // Maximum temperature reached (°C)
  t130: number; // Time spent exceeding 130°C (s)
  h: Array<[number, number, number, number, number, number]>; // [time, hot, P, Pid, Ph, Precovered]
  envLog?: EnvironmentLogPoint[]; // Real-time environmental variables fluctuation timeline data log
}

export interface ComparisonRow {
  modeName: string;
  circuitMode: CircuitDefenseMode;
  coolingMode: CoolingMode;
  color: string;
  maxT: number;
  t130: number;
  finalPower: number;
  powerLossPercent: number;
  recoveredPower: number;
  totalEnergy: number;
  energyGainWh: number;
  rating: '정상' | '주의' | '위험' | '화재위험';
}

export interface SweepPoint {
  shadePercent: number;
  temps: Record<string, number>;
  powers: Record<string, number>;
}

// Experiment B: 2x3 block shading locations (Center vs 4 Corners)
export type ExperimentBLocation =
  | 'center'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

export interface ExperimentBRow {
  locationId: ExperimentBLocation;
  locationName: string;
  category: '내부 (중앙)' | '외부 (모서리)';
  cellsDescription: string;
  shadePercent: 30 | 60 | 90;
  // None
  noneP: number;
  noneMaxT: number;
  // Diode
  diodeP: number;
  diodeMaxT: number;
  // Smart
  smartP: number;
  smartMaxT: number;
  // Quantitative Gain
  recoveredP: number; // smartP - noneP
  efficiencyRecoveryPercent: number; // smart efficiency vs ideal
  diodeTriggered: boolean;
  smartCellsBypassedCount: number;
}

// Experiment D: Extreme environmental conditions
export type ExperimentDCategory = 'irradiance' | 'temperature' | 'wind';

export interface ExperimentDRow {
  category: ExperimentDCategory;
  categoryName: string;
  variableLabel: string;
  conditionDescription: string;
  // Results for 3 defense methods
  noneMaxT: number;
  noneP: number;
  diodeMaxT: number;
  diodeP: number;
  smartMaxT: number;
  smartP: number;
  t130SecSmart: number;
  recoveredPowerSmart: number;
  safetyRating: '정상' | '주의' | '위험' | '화재위험';
}

export interface SavedExperiment {
  id: string;
  timestamp: string;
  name: string;
  note: string;
  env: EnvironmentState;
  shade: number[];
  defect: boolean[];
  metrics: {
    P: number;
    Pid: number;
    Pnone: number;
    Precovered: number;
    recoveryRatePercent: number;
    hot: number;
    totalEnergyWh: number;
    energyGainWh: number;
    t130Sec: number;
    maxT: number;
    elapsedTimeSec: number;
  };
}
