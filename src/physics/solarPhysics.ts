import {
  CircuitDefenseMode,
  CoolingMode,
  EnvironmentState,
  SimStateInternal,
  SimulationMetrics,
  ComparisonRow,
  SweepPoint,
  ExperimentBLocation,
  ExperimentBRow,
  ExperimentDRow,
  OperationPoint,
  StochasticJitterOffset,
  EnvironmentLogPoint,
} from '../types/solar.ts';

export const N_CELLS = 60;
export const ISC = 9; // Short-circuit current (A)
export const VT0 = 0.0308; // Thermal voltage at 25°C (V)
export const I0 = ISC / (Math.exp(0.62 / VT0) - 1);
export const BV = -0.0022; // Voltage temp coefficient (V/°C per cell)
export const RS = 0.004; // Series resistance (Ω)
export const VBR = 12; // Breakdown voltage (V)
export const RB = 0.2; // Breakdown resistance (Ω)
export const VD = 0.5; // Bypass diode forward threshold (V)
export const RON = 0.005; // Smart bypass MOSFET on-resistance (Ω)
export const GM = -0.004; // Output power temperature coefficient (/°C)
export const CT_BASE = 15; // Heat capacity (J/K)

// Calculate STC rated peak power (~253.5 W)
export function calculatePSTC(): number {
  let bestP = 0;
  for (let k = 1; k < 200; k++) {
    const I = (ISC * k) / 200;
    const l = Math.log((ISC - I) / I0 + 1);
    const p = I * N_CELLS * (VT0 * l - I * RS);
    if (p > bestP) bestP = p;
  }
  return bestP;
}

export const PSTC = calculatePSTC();

// Faiman model parameters adjusted by cooling mode
export function getCoolingParameters(cooling: CoolingMode) {
  let U0 = 25;
  let U1 = 6.84;
  let rthNormal = 2.5; // K/W
  let rthDefect = 4.0; // K/W
  let ct = CT_BASE;

  if (cooling === 'passive-heatsink') {
    // Aluminum heatsink + PCM paraffin
    U0 = 32;
    U1 = 8.5;
    rthNormal = 1.6;
    rthDefect = 2.7;
    ct = 28; // latent heat absorption increases effective capacitance
  } else if (cooling === 'active-water') {
    // Water spray / closed loop water cooling
    U0 = 55;
    U1 = 14.0;
    rthNormal = 1.1;
    rthDefect = 1.9;
    ct = 20;
  } else if (cooling === 'active-air') {
    // Forced fan air convection
    U0 = 28;
    U1 = 16.5;
    rthNormal = 1.7;
    rthDefect = 2.9;
    ct = 16;
  }

  return { U0, U1, rthNormal, rthDefect, ct };
}

// Compute independent environmental fluctuations
export function calcIndependentFluctuation(
  baseEnv: EnvironmentState,
  timeSec: number,
): { effectiveTa: number; effectiveWs: number; effectiveG: number } {
  let effectiveTa = baseEnv.Ta;
  let effectiveWs = baseEnv.Ws;
  let effectiveG = baseEnv.G;

  // 1. Ambient Temperature independent ±5°C fluctuation (Sluggish thermal inertia)
  if (baseEnv.tempJitter) {
    // Multi-frequency thermal drift strictly bounded within ±5°C of base setpoint
    const deltaT =
      3.2 * Math.sin(0.04 * timeSec + 0.3) +
      1.8 * Math.cos(0.015 * timeSec + 1.2) +
      0.6 * Math.sin(0.08 * timeSec + 2.1);
    const clampedDeltaT = Math.max(-5.0, Math.min(5.0, deltaT));
    effectiveTa = Math.round((baseEnv.Ta + clampedDeltaT) * 10) / 10;
  }

  // 2. Wind speed independent airflow drift / gust turbulence (m/s) (Fluid dynamics)
  if (baseEnv.windJitter) {
    // Fluid turbulence with higher gust frequency and independent phase
    const deltaWs =
      0.8 * Math.sin(0.14 * timeSec + 1.7) +
      0.45 * Math.cos(0.31 * timeSec + 0.4) +
      0.25 * Math.sin(0.05 * timeSec + 3.3);
    effectiveWs = Math.max(0, Math.round((baseEnv.Ws + deltaWs) * 10) / 10);
  }

  // 3. Solar irradiation independent optical transmission fluctuation (W/m²) (Atmospheric clear-sky optical jitter)
  if (baseEnv.solarJitter) {
    // Atmospheric optical transmission jitter independent of temperature and wind
    const deltaG =
      42 * Math.sin(0.07 * timeSec + 4.1) +
      22 * Math.cos(0.19 * timeSec + 2.5) +
      14 * Math.sin(0.02 * timeSec + 0.8);
    const clampedG = Math.max(50, Math.min(1150, baseEnv.G + deltaG));
    effectiveG = Math.round(clampedG);
  }

  return { effectiveTa, effectiveWs, effectiveG };
}

// Faiman Module Temperature Tm (°C) - Eq. (2)
export function calculateTm(env: EnvironmentState): number {
  const { U0, U1 } = getCoolingParameters(env.coolingMode);
  return env.Ta + env.G / (U0 + U1 * env.Ws);
}

// Compute I_ph and R_sh for all 60 cells
export function prepareCellProperties(
  G: number,
  shade: number[],
  defect: boolean[],
  defectRsh: number = 0.8,
) {
  const k = G / 1000;
  const IPH: number[] = new Array(N_CELLS);
  const RSH: number[] = new Array(N_CELLS);

  for (let i = 0; i < N_CELLS; i++) {
    IPH[i] = ISC * k * (1 - 0.97 * shade[i]) * (defect[i] ? 0.65 : 1);
    RSH[i] = defect[i] ? defectRsh : 100;
  }

  return { IPH, RSH };
}

// Cell I-V characteristic: returns cell voltage V at given current I and cell temperature T
export function cellVoltage(
  i: number,
  I: number,
  T: number,
  IPH: number[],
  RSH: number[],
): number {
  const ip = IPH[i];
  let v: number;

  if (I < ip) {
    const l = Math.log((ip - I) / I0 + 1);
    v = VT0 * l + (BV * (T - 25) * l) / 20.1;
  } else {
    const d = I - ip;
    const r = RSH[i];
    v = d * r <= VBR ? -d * r : -VBR - (d - VBR / r) * RB;
  }

  return v - I * RS;
}

// Nominal healthy cell voltage for threshold reference
export function normalCellVoltage(I: number, Tm: number, G: number): number {
  const ip = (ISC * G) / 1000;
  if (I >= ip) return -(I - ip) * 100 - I * RS;
  const l = Math.log((ip - I) / I0 + 1);
  return VT0 * l + (BV * (Tm - 25) * l) / 20.1 - I * RS;
}

// Sum of cell voltages in range [a, b)
export function sumCellVoltages(
  a: number,
  b: number,
  I: number,
  T: number[],
  IPH: number[],
  RSH: number[],
): number {
  let s = 0;
  for (let i = a; i < b; i++) {
    s += cellVoltage(i, I, T[i], IPH, RSH);
  }
  return s;
}

// Bisection root solver to find cell sub-string current Ic when bypassed to target voltage
export function bisectCurrent(
  a: number,
  b: number,
  targetVoltage: number,
  T: number[],
  IPH: number[],
  RSH: number[],
  G: number,
): number {
  const hi0 = ((ISC * G) / 1000) * 1.05;
  if (sumCellVoltages(a, b, hi0, T, IPH, RSH) > targetVoltage) {
    return hi0;
  }

  let lo = 0;
  let hi = hi0;
  for (let k = 0; k < 22; k++) {
    const m = (lo + hi) / 2;
    if (sumCellVoltages(a, b, m, T, IPH, RSH) > targetVoltage) {
      lo = m;
    } else {
      hi = m;
    }
  }
  return (lo + hi) / 2;
}

// Initialize internal simulation state
export function createNewSimState(tm: number): SimStateInternal {
  return {
    T: new Array(N_CELLS).fill(tm),
    arm: new Array(12).fill(false),
    tm: new Array(12).fill(0),
    t: 0,
    E: 0,
    Enone: 0,
    maxT: tm,
    t130: 0,
    h: [],
    envLog: [],
  };
}

export interface EvalResult {
  cv: number[];
  ci: number[];
  dOn: [number, number, number];
  totalV: number;
}

// Evaluate string voltage V and individual cell currents/voltages under given defense mode
export function evalString(
  I: number,
  S: SimStateInternal,
  mode: CircuitDefenseMode,
  IPH: number[],
  RSH: number[],
  G: number,
  TmVal: number,
): EvalResult {
  const T = S.T;
  const cv: number[] = new Array(N_CELLS);
  const ci: number[] = new Array(N_CELLS);
  const dOn: [number, number, number] = [0, 0, 0];
  let V = 0;

  const put = (a: number, b: number, Ic: number) => {
    for (let i = a; i < b; i++) {
      ci[i] = Ic;
      cv[i] = cellVoltage(i, Ic, T[i], IPH, RSH);
    }
  };

  // Case 1: Unprotected (no bypass elements)
  if (mode === 'none') {
    for (let i = 0; i < N_CELLS; i++) {
      const v = cellVoltage(i, I, T[i], IPH, RSH);
      V += v;
      cv[i] = v;
      ci[i] = I;
    }
    return { cv, ci, dOn, totalV: V };
  }

  // Helper for 20-cell substring diode bypass
  const evalDiodeSubstring = (s: number, a: number, b: number) => {
    const raw = sumCellVoltages(a, b, I, T, IPH, RSH);
    if (raw >= -VD) {
      put(a, b, I);
      return raw;
    }
    const Ic = bisectCurrent(a, b, -VD, T, IPH, RSH, G);
    put(a, b, Ic);
    dOn[s] = 1;
    return -VD;
  };

  // Case 2: Standard Bypass Diode (20-cell substrings)
  if (mode === 'diode') {
    for (let s = 0; s < 3; s++) {
      V += evalDiodeSubstring(s, s * 20, s * 20 + 20);
    }
    return { cv, ci, dOn, totalV: V };
  }

  // Case 3: DC Optimizer / MLPE
  if (mode === 'optimizer') {
    for (let s = 0; s < 3; s++) {
      let subV = 0;
      for (let g = 4 * s; g < 4 * s + 4; g++) {
        const ga = 5 * g;
        const gb = ga + 5;
        const groupV = sumCellVoltages(ga, gb, I, T, IPH, RSH);
        if (groupV < 0) {
          const Ic = bisectCurrent(ga, gb, -I * 0.002, T, IPH, RSH, G);
          put(ga, gb, Ic);
          subV += -I * 0.002;
        } else {
          put(ga, gb, I);
          subV += groupV;
        }
      }
      V += subV * 0.985;
    }
    return { cv, ci, dOn, totalV: V };
  }

  // Case 4: Smart Bypass (5-cell MOSFET switches across 12 groups)
  for (let s = 0; s < 3; s++) {
    let subV = 0;
    const subStart = s * 20;
    const subEnd = subStart + 20;

    for (let g = 4 * s; g < 4 * s + 4; g++) {
      const ga = 5 * g;
      const gb = ga + 5;

      if (!S.arm[g]) {
        // Normal state: cells carry full string current I
        put(ga, gb, I);
        subV += sumCellVoltages(ga, gb, I, T, IPH, RSH);
      } else {
        // MOSFET engaged: bypasses 5-cell group with low on-resistance RON
        const targetV = -I * RON;
        const Ic = bisectCurrent(ga, gb, targetV, T, IPH, RSH, G);
        put(ga, gb, Ic);
        subV += targetV;
      }
    }

    // Secondary backup protection by 20-cell diode if subV still drops below -VD
    if (subV < -VD) {
      const Ic = bisectCurrent(subStart, subEnd, -VD, T, IPH, RSH, G);
      put(subStart, subEnd, Ic);
      dOn[s] = 1;
      V += -VD;
    } else {
      V += subV;
    }
  }

  return { cv, ci, dOn, totalV: V };
}

// Solve Operating Point (MPPT global peak vs Near Short-Circuit IEC 61215 MQT 09)
export function solveOperatingPoint(
  S: SimStateInternal,
  mode: CircuitDefenseMode,
  op: 'mppt' | 'sc',
  IPH: number[],
  RSH: number[],
  G: number,
  TmVal: number,
): number {
  const maxI = ((ISC * G) / 1000) * 1.02;

  if (op === 'sc') {
    // 98% of short-circuit current: extreme reverse bias stress
    return maxI * 0.98;
  }

  // Global MPPT search: 120 points sweep for max power P = I * V
  let bestP = -1;
  let bestI = maxI * 0.85;

  const steps = 100;
  for (let k = 1; k <= steps; k++) {
    const curI = (maxI * k) / steps;
    const res = evalString(curI, S, mode, IPH, RSH, G, TmVal);
    const p = curI * res.totalV;
    if (p > bestP && res.totalV > 0) {
      bestP = p;
      bestI = curI;
    }
  }

  return bestI;
}

// Check if a 5-cell group is abnormal (voltage drop or localized temperature rise)
export function isGroupAbnormal(
  S: SimStateInternal,
  I: number,
  g: number,
  IPH: number[],
  RSH: number[],
  G: number,
  TmVal: number,
): boolean {
  const ga = 5 * g;
  const gb = ga + 5;
  const groupV = sumCellVoltages(ga, gb, I, S.T, IPH, RSH);
  const normalV = 5 * normalCellVoltage(I, TmVal, G);

  const voltageDropCondition = groupV < 0.7 * normalV;
  const tempCondition = Math.max(...S.T.slice(ga, gb)) > 85;

  return voltageDropCondition || tempCondition;
}

// Update Smart Bypass activation state based on timer and latency
export function updateSmartBypassArm(
  S: SimStateInternal,
  I: number,
  dt: number,
  latency: number,
  IPH: number[],
  RSH: number[],
  G: number,
  TmVal: number,
) {
  for (let g = 0; g < 12; g++) {
    const triggered = isGroupAbnormal(S, I, g, IPH, RSH, G, TmVal);
    S.tm[g] = triggered ? S.tm[g] + dt : 0;
    S.arm[g] = triggered && S.tm[g] >= latency;
  }
}

// Execute 1 simulation time step dt
export function runSimulationStep(
  S: SimStateInternal,
  env: EnvironmentState,
  shade: number[],
  defect: boolean[],
  dt: number,
  defectRsh: number = 0.8,
  stochasticJitter?: StochasticJitterOffset,
): SimulationMetrics {
  // Compute independent fluctuations using separate stochastic jitter offsets if provided, or fallback to independent multi-frequency drift
  let effectiveTa = env.Ta;
  let effectiveWs = env.Ws;
  let effectiveG = env.G;

  if (stochasticJitter !== undefined) {
    if (env.tempJitter && stochasticJitter.deltaTa !== undefined) {
      // Sluggish thermal random walk strictly bounded within ±5°C
      const clampedDeltaT = Math.max(-5.0, Math.min(5.0, stochasticJitter.deltaTa));
      effectiveTa = Math.round((env.Ta + clampedDeltaT) * 10) / 10;
    }
    if (env.windJitter && stochasticJitter.deltaWs !== undefined) {
      // Independent fluid turbulence gust random walk (m/s)
      effectiveWs = Math.max(0, Math.round((env.Ws + stochasticJitter.deltaWs) * 10) / 10);
    }
    if (env.solarJitter && stochasticJitter.deltaG !== undefined) {
      // Independent optical transmission stochastic random walk (W/m²)
      effectiveG = Math.max(50, Math.min(1200, Math.round(env.G + stochasticJitter.deltaG)));
    }
  } else {
    const fluc = calcIndependentFluctuation(env, S.t);
    effectiveTa = fluc.effectiveTa;
    effectiveWs = fluc.effectiveWs;
    effectiveG = fluc.effectiveG;
  }

  const effectiveEnv: EnvironmentState = {
    ...env,
    Ta: effectiveTa,
    Ws: effectiveWs,
    G: effectiveG,
  };

  const tm = calculateTm(effectiveEnv);
  const { IPH, RSH } = prepareCellProperties(effectiveEnv.G, shade, defect, defectRsh);
  const { rthNormal, rthDefect, ct } = getCoolingParameters(effectiveEnv.coolingMode);

  // 1. Solve current operating point for active mode
  const I = solveOperatingPoint(S, effectiveEnv.circuitMode, effectiveEnv.op, IPH, RSH, effectiveEnv.G, tm);
  const evalActive = evalString(I, S, effectiveEnv.circuitMode, IPH, RSH, effectiveEnv.G, tm);
  const P = Math.max(0, I * evalActive.totalV);

  // 2. Also solve baseline "unprotected" (none) for identical condition to calculate recovered power
  const Inone = solveOperatingPoint(S, 'none', effectiveEnv.op, IPH, RSH, effectiveEnv.G, tm);
  const evalNone = evalString(Inone, S, 'none', IPH, RSH, effectiveEnv.G, tm);
  const Pnone = Math.max(0, Inone * evalNone.totalV);

  // 3. Thermal lumped differential equations for each cell
  let hot = 0;
  let hi = 0;
  let Ph = 0;

  for (let i = 0; i < N_CELLS; i++) {
    const pd = evalActive.cv[i] < 0 ? -evalActive.cv[i] * evalActive.ci[i] : 0;
    const rth = defect[i] ? rthDefect : rthNormal;

    // C * dT/dt = P_loss - (T - Tm) / Rth
    S.T[i] += (dt * (pd - (S.T[i] - tm) / rth)) / ct;

    if (S.T[i] > hot) {
      hot = S.T[i];
      hi = i;
    }
    if (pd > Ph) Ph = pd;
  }

  // 4. Update smart bypass arm states
  if (effectiveEnv.circuitMode === 'smart') {
    updateSmartBypassArm(S, I, dt, effectiveEnv.lat, IPH, RSH, effectiveEnv.G, tm);
  } else {
    S.arm.fill(false);
  }

  // 5. Accumulate metrics
  S.t += dt;
  S.E += (P * dt) / 3600;
  S.Enone += (Pnone * dt) / 3600;
  S.maxT = Math.max(S.maxT, hot);
  if (hot > 130) S.t130 += dt;

  // Ideal power under Eq. (1)
  const Pid = Math.max(0, PSTC * (effectiveEnv.G / 1000) * (1 + GM * (tm - 25)));

  // Power recovered
  const Precovered = Math.max(0, P - Pnone);
  const recoveryRatePercent = Pnone > 1 ? ((P - Pnone) / Pnone) * 100 : P > 0 ? 100 : 0;

  // Push waveform history & real-time environmental fluctuation timeline log
  if (dt > 0) {
    if (S.h.length < 3500) {
      S.h.push([S.t, hot, P, Pid, Ph, Precovered]);
    }
    if (!S.envLog) {
      S.envLog = [];
    }
    if (S.envLog.length < 5000) {
      S.envLog.push({
        t: Math.round(S.t * 10) / 10,
        baseTa: env.Ta,
        effectiveTa,
        deltaTa: Math.round((effectiveTa - env.Ta) * 10) / 10,
        baseWs: env.Ws,
        effectiveWs,
        deltaWs: Math.round((effectiveWs - env.Ws) * 10) / 10,
        baseG: env.G,
        effectiveG,
        deltaG: Math.round(effectiveG - env.G),
        tm: Math.round(tm * 10) / 10,
        hot: Math.round(hot * 10) / 10,
        P: Math.round(P * 10) / 10,
      });
    }
  }

  const diodeOnCount = evalActive.dOn.reduce((a, b) => a + b, 0);
  const smartOnCount = S.arm.filter(Boolean).length;

  return {
    I,
    V: evalActive.totalV,
    P,
    Pid,
    Pnone,
    Precovered,
    recoveryRatePercent,
    hot,
    hi,
    Ph,
    tm,
    diodeOnCount,
    smartOnCount,
    dOn: evalActive.dOn,
    effectiveTa,
    effectiveWs,
    effectiveG,
  };
}

// Steady-state solver for fast sweep calculation
export function solveSteadyState(
  mode: CircuitDefenseMode,
  cooling: CoolingMode,
  op: 'mppt' | 'sc',
  G: number,
  Ta: number,
  Ws: number,
  shade: number[],
  defect: boolean[],
): { th: number; P: number; Pid: number; diodeTriggered: boolean; smartGroupsCount: number } {
  const env: EnvironmentState = {
    G,
    Ta,
    Ws,
    circuitMode: mode,
    coolingMode: cooling,
    op,
    lat: 0.5,
    speed: 20,
    brush: '0.6',
    tempJitter: false,
    windJitter: false,
    solarJitter: false,
    dynamicCloud: false,
  };

  const tm = calculateTm(env);
  const { IPH, RSH } = prepareCellProperties(G, shade, defect);
  const { rthNormal, rthDefect } = getCoolingParameters(cooling);
  const S = createNewSimState(tm);

  // 2 iterations to stabilize smart bypass activation
  let I = solveOperatingPoint(S, mode, op, IPH, RSH, G, tm);
  if (mode === 'smart') {
    for (let g = 0; g < 12; g++) {
      S.arm[g] = isGroupAbnormal(S, I, g, IPH, RSH, G, tm);
    }
  }

  I = solveOperatingPoint(S, mode, op, IPH, RSH, G, tm);
  const evalRes = evalString(I, S, mode, IPH, RSH, G, tm);

  let th = tm;
  for (let i = 0; i < N_CELLS; i++) {
    const pd = evalRes.cv[i] < 0 ? -evalRes.cv[i] * evalRes.ci[i] : 0;
    const rth = defect[i] ? rthDefect : rthNormal;
    th = Math.max(th, tm + pd * rth);
  }

  const P = Math.max(0, I * evalRes.totalV);
  const Pid = Math.max(0, PSTC * (G / 1000) * (1 + GM * (tm - 25)));
  const diodeTriggered = evalRes.dOn.some((d) => d > 0);
  const smartGroupsCount = S.arm.filter(Boolean).length;

  return { th, P, Pid, diodeTriggered, smartGroupsCount };
}

// Run 300-second automated benchmark comparison across multiple methods
export function run300sBenchmark(
  env: EnvironmentState,
  shade: number[],
  defect: boolean[],
): ComparisonRow[] {
  const methods: Array<{
    modeName: string;
    circuitMode: CircuitDefenseMode;
    coolingMode: CoolingMode;
    color: string;
  }> = [
    { modeName: '① 무보호 (기준 대조군)', circuitMode: 'none', coolingMode: 'natural', color: '#94a3b8' },
    { modeName: '② 표준 바이패스 다이오드 (20셀)', circuitMode: 'diode', coolingMode: 'natural', color: '#f59e0b' },
    { modeName: '③ 스마트 바이패스 (5셀 MOSFET)', circuitMode: 'smart', coolingMode: 'natural', color: '#06b6d4' },
    { modeName: '④ DC 옵티마이저 (MLPE)', circuitMode: 'optimizer', coolingMode: 'natural', color: '#8b5cf6' },
    { modeName: '⑤ 스마트 바이패스 + 수동 방열판', circuitMode: 'smart', coolingMode: 'passive-heatsink', color: '#10b981' },
    { modeName: '⑥ 스마트 바이패스 + 능동 수냉', circuitMode: 'smart', coolingMode: 'active-water', color: '#38bdf8' },
  ];

  const SNone = createNewSimState(calculateTm(env));
  const noneEnv = { ...env, circuitMode: 'none' as CircuitDefenseMode, coolingMode: 'natural' as CoolingMode };
  for (let t = 0; t < 300; t++) {
    runSimulationStep(SNone, noneEnv, shade, defect, 1);
  }
  const baselineEnergy = SNone.E;

  const rows: ComparisonRow[] = [];

  for (const m of methods) {
    const testEnv: EnvironmentState = {
      ...env,
      circuitMode: m.circuitMode,
      coolingMode: m.coolingMode,
    };
    const S = createNewSimState(calculateTm(testEnv));
    let lastMetrics: SimulationMetrics = {} as SimulationMetrics;

    for (let t = 0; t < 300; t++) {
      lastMetrics = runSimulationStep(S, testEnv, shade, defect, 1);
    }

    const powerLossPercent = lastMetrics.Pid > 0
      ? Math.max(0, ((lastMetrics.Pid - lastMetrics.P) / lastMetrics.Pid) * 100)
      : 0;

    const recoveredPower = Math.max(0, lastMetrics.P - lastMetrics.Pnone);
    const energyGainWh = S.E - baselineEnergy;

    const rating: '정상' | '주의' | '위험' | '화재위험' =
      S.maxT < 85 ? '정상' : S.maxT < 130 ? '주의' : S.maxT < 300 ? '위험' : '화재위험';

    rows.push({
      modeName: m.modeName,
      circuitMode: m.circuitMode,
      coolingMode: m.coolingMode,
      color: m.color,
      maxT: S.maxT,
      t130: S.t130,
      finalPower: lastMetrics.P,
      powerLossPercent,
      recoveredPower,
      totalEnergy: S.E,
      energyGainWh,
      rating,
    });
  }

  return rows;
}

// Generate 0~100% Shading sweep curve
export function generateShadingSweep(
  env: EnvironmentState,
  targetCellIndex: number = 25,
): SweepPoint[] {
  const points: SweepPoint[] = [];
  const testShade = new Array(N_CELLS).fill(0);
  const testDefect = new Array(N_CELLS).fill(false);

  for (let s = 0; s <= 100; s += 5) {
    testShade.fill(0);
    testShade[targetCellIndex] = s / 100;

    const temps: Record<string, number> = {};
    const powers: Record<string, number> = {};

    // 1. None
    const rNone = solveSteadyState('none', 'natural', env.op, env.G, env.Ta, env.Ws, testShade, testDefect);
    temps['none'] = rNone.th;
    powers['none'] = rNone.P;

    // 2. Diode
    const rDiode = solveSteadyState('diode', 'natural', env.op, env.G, env.Ta, env.Ws, testShade, testDefect);
    temps['diode'] = rDiode.th;
    powers['diode'] = rDiode.P;

    // 3. Smart
    const rSmart = solveSteadyState('smart', 'natural', env.op, env.G, env.Ta, env.Ws, testShade, testDefect);
    temps['smart'] = rSmart.th;
    powers['smart'] = rSmart.P;

    // 4. Optimizer
    const rOpt = solveSteadyState('optimizer', 'natural', env.op, env.G, env.Ta, env.Ws, testShade, testDefect);
    temps['optimizer'] = rOpt.th;
    powers['optimizer'] = rOpt.P;

    // 5. Hybrid (Smart + Water cooling)
    const rHybrid = solveSteadyState('smart', 'active-water', env.op, env.G, env.Ta, env.Ws, testShade, testDefect);
    temps['hybridWater'] = rHybrid.th;
    powers['hybridWater'] = rHybrid.P;

    points.push({
      shadePercent: s,
      temps,
      powers,
    });
  }

  return points;
}

// --- Experiment B Helper: Cell mapping for 2x3 block ---
// 6 rows (0..5) x 10 cols (0..9)
export function get2x3BlockCells(loc: ExperimentBLocation): { cells: number[]; label: string; desc: string; category: '내부 (중앙)' | '외부 (모서리)' } {
  if (loc === 'center') {
    // Rows 2, 3 and Cols 4, 5, 6
    return {
      cells: [24, 25, 26, 34, 35, 36],
      label: '중앙 (Center)',
      desc: '행 2~3 / 열 4~6 (24,25,26, 34,35,36번)',
      category: '내부 (중앙)',
    };
  }
  if (loc === 'top-left') {
    // Rows 0, 1 and Cols 0, 1, 2
    return {
      cells: [0, 1, 2, 10, 11, 12],
      label: '좌상단 (Top-Left)',
      desc: '행 0~1 / 열 0~2 (0,1,2, 10,11,12번)',
      category: '외부 (모서리)',
    };
  }
  if (loc === 'top-right') {
    // Rows 0, 1 and Cols 7, 8, 9
    return {
      cells: [7, 8, 9, 17, 18, 19],
      label: '우상단 (Top-Right)',
      desc: '행 0~1 / 열 7~9 (7,8,9, 17,18,19번)',
      category: '외부 (모서리)',
    };
  }
  if (loc === 'bottom-left') {
    // Rows 4, 5 and Cols 0, 1, 2
    return {
      cells: [40, 41, 42, 50, 51, 52],
      label: '좌하단 (Bottom-Left)',
      desc: '행 4~5 / 열 0~2 (40,41,42, 50,51,52번)',
      category: '외부 (모서리)',
    };
  }
  // bottom-right
  return {
    cells: [47, 48, 49, 57, 58, 59],
    label: '우하단 (Bottom-Right)',
    desc: '행 4~5 / 열 7~9 (47,48,49, 57,58,59번)',
    category: '외부 (모서리)',
  };
}

// Run Experiment B: 5 Locations x 3 Shading levels (30%, 60%, 90%)
export function runExperimentB_Locations(
  baseEnv: EnvironmentState,
  op: OperationPoint = 'mppt',
): ExperimentBRow[] {
  const locations: ExperimentBLocation[] = [
    'center',
    'top-left',
    'top-right',
    'bottom-left',
    'bottom-right',
  ];
  const levels: Array<30 | 60 | 90> = [30, 60, 90];

  const results: ExperimentBRow[] = [];
  const testDefect = new Array(N_CELLS).fill(false);

  for (const loc of locations) {
    const { cells, label, desc, category } = get2x3BlockCells(loc);

    for (const sh of levels) {
      const shadeArray = new Array(N_CELLS).fill(0);
      for (const idx of cells) {
        shadeArray[idx] = sh / 100;
      }

      // None
      const rNone = solveSteadyState('none', 'natural', op, baseEnv.G, baseEnv.Ta, baseEnv.Ws, shadeArray, testDefect);
      // Diode
      const rDiode = solveSteadyState('diode', 'natural', op, baseEnv.G, baseEnv.Ta, baseEnv.Ws, shadeArray, testDefect);
      // Smart
      const rSmart = solveSteadyState('smart', 'natural', op, baseEnv.G, baseEnv.Ta, baseEnv.Ws, shadeArray, testDefect);

      const recoveredP = Math.max(0, rSmart.P - rNone.P);
      const efficiencyRecoveryPercent = rNone.Pid > 0 ? (rSmart.P / rNone.Pid) * 100 : 0;

      results.push({
        locationId: loc,
        locationName: label,
        category,
        cellsDescription: desc,
        shadePercent: sh,
        noneP: Math.round(rNone.P * 10) / 10,
        noneMaxT: Math.round(rNone.th * 10) / 10,
        diodeP: Math.round(rDiode.P * 10) / 10,
        diodeMaxT: Math.round(rDiode.th * 10) / 10,
        smartP: Math.round(rSmart.P * 10) / 10,
        smartMaxT: Math.round(rSmart.th * 10) / 10,
        recoveredP: Math.round(recoveredP * 10) / 10,
        efficiencyRecoveryPercent: Math.round(efficiencyRecoveryPercent * 10) / 10,
        diodeTriggered: rDiode.diodeTriggered,
        smartCellsBypassedCount: rSmart.smartGroupsCount * 5,
      });
    }
  }

  return results;
}

// Run Experiment D: Extreme environmental conditions (3 categories: G 100 vs 1000, Ta -5 vs 25 vs 40, Ws 0 vs 1 vs 10)
export function runExperimentD_Extremes(
  shade: number[],
  defect: boolean[],
  op: OperationPoint = 'mppt',
): ExperimentDRow[] {
  const configs: Array<{
    category: 'irradiance' | 'temperature' | 'wind';
    categoryName: string;
    variableLabel: string;
    conditionDescription: string;
    G: number;
    Ta: number;
    Ws: number;
  }> = [
    // 1. Irradiance (G) extremes
    {
      category: 'irradiance',
      categoryName: '일사량 양끝조건',
      variableLabel: 'G = 100 W/m²',
      conditionDescription: '극저일사 (흐린 날, 기온 25℃, 풍속 1m/s 고정)',
      G: 100,
      Ta: 25,
      Ws: 1,
    },
    {
      category: 'irradiance',
      categoryName: '일사량 양끝조건',
      variableLabel: 'G = 1000 W/m²',
      conditionDescription: '표준 정오 일사 (기온 25℃, 풍속 1m/s 고정)',
      G: 1000,
      Ta: 25,
      Ws: 1,
    },
    // 2. Temperature (Ta) extremes
    {
      category: 'temperature',
      categoryName: '외기온도 조건',
      variableLabel: 'T_amb = -5 ℃',
      conditionDescription: '혹한기 조건 (일사 1000W/m², 풍속 1m/s 고정)',
      G: 1000,
      Ta: -5,
      Ws: 1,
    },
    {
      category: 'temperature',
      categoryName: '외기온도 조건',
      variableLabel: 'T_amb = 25 ℃',
      conditionDescription: '표준 상온 조건 (일사 1000W/m², 풍속 1m/s 고정)',
      G: 1000,
      Ta: 25,
      Ws: 1,
    },
    {
      category: 'temperature',
      categoryName: '외기온도 조건',
      variableLabel: 'T_amb = 40 ℃',
      conditionDescription: '혹서기 폭염 조건 (일사 1000W/m², 풍속 1m/s 고정)',
      G: 1000,
      Ta: 40,
      Ws: 1,
    },
    // 3. Wind speed (Ws) extremes
    {
      category: 'wind',
      categoryName: '풍속 양끝조건',
      variableLabel: 'W_s = 0 m/s',
      conditionDescription: '무풍 극한 조건 (대류 방열 최악, 일사 1000, 기온 25)',
      G: 1000,
      Ta: 25,
      Ws: 0,
    },
    {
      category: 'wind',
      categoryName: '풍속 양끝조건',
      variableLabel: 'W_s = 1 m/s',
      conditionDescription: '표준 미풍 조건 (일사 1000, 기온 25)',
      G: 1000,
      Ta: 25,
      Ws: 1,
    },
    {
      category: 'wind',
      categoryName: '풍속 양끝조건',
      variableLabel: 'W_s = 10 m/s',
      conditionDescription: '강풍 급랭 조건 (강제 대류 극대화, 일사 1000, 기온 25)',
      G: 1000,
      Ta: 25,
      Ws: 10,
    },
  ];

  const rows: ExperimentDRow[] = [];

  for (const c of configs) {
    const baseEnv: EnvironmentState = {
      G: c.G,
      Ta: c.Ta,
      Ws: c.Ws,
      circuitMode: 'none',
      coolingMode: 'natural',
      op,
      lat: 0.5,
      speed: 20,
      brush: '0.6',
      tempJitter: false,
      windJitter: false,
      solarJitter: false,
      dynamicCloud: false,
    };

    // Run 300s benchmark for each method under this condition
    const SNone = createNewSimState(calculateTm(baseEnv));
    for (let t = 0; t < 300; t++) {
      runSimulationStep(SNone, baseEnv, shade, defect, 1);
    }

    const SDiode = createNewSimState(calculateTm({ ...baseEnv, circuitMode: 'diode' }));
    for (let t = 0; t < 300; t++) {
      runSimulationStep(SDiode, { ...baseEnv, circuitMode: 'diode' }, shade, defect, 1);
    }

    const SSmart = createNewSimState(calculateTm({ ...baseEnv, circuitMode: 'smart' }));
    let lastSmart: SimulationMetrics = {} as SimulationMetrics;
    for (let t = 0; t < 300; t++) {
      lastSmart = runSimulationStep(SSmart, { ...baseEnv, circuitMode: 'smart' }, shade, defect, 1);
    }

    const noneRes = solveSteadyState('none', 'natural', op, c.G, c.Ta, c.Ws, shade, defect);
    const diodeRes = solveSteadyState('diode', 'natural', op, c.G, c.Ta, c.Ws, shade, defect);

    const recoveredPowerSmart = Math.max(0, lastSmart.P - noneRes.P);
    const safetyRating: '정상' | '주의' | '위험' | '화재위험' =
      SSmart.maxT < 85 ? '정상' : SSmart.maxT < 130 ? '주의' : SSmart.maxT < 300 ? '위험' : '화재위험';

    rows.push({
      category: c.category,
      categoryName: c.categoryName,
      variableLabel: c.variableLabel,
      conditionDescription: c.conditionDescription,
      noneMaxT: Math.round(SNone.maxT * 10) / 10,
      noneP: Math.round(noneRes.P * 10) / 10,
      diodeMaxT: Math.round(SDiode.maxT * 10) / 10,
      diodeP: Math.round(diodeRes.P * 10) / 10,
      smartMaxT: Math.round(SSmart.maxT * 10) / 10,
      smartP: Math.round(lastSmart.P * 10) / 10,
      t130SecSmart: Math.round(SSmart.t130),
      recoveredPowerSmart: Math.round(recoveredPowerSmart * 10) / 10,
      safetyRating,
    });
  }

  return rows;
}
