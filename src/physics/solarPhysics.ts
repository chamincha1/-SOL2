import {
  CircuitDefenseMode,
  CoolingMode,
  EnvironmentState,
  SimStateInternal,
  SimulationMetrics,
  ComparisonRow,
  SweepPoint,
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
    // Isolates shaded groups and performs independent tracking with 98.5% conversion efficiency
    for (let s = 0; s < 3; s++) {
      let subV = 0;
      for (let g = 4 * s; g < 4 * s + 4; g++) {
        const ga = 5 * g;
        const gb = ga + 5;
        const groupV = sumCellVoltages(ga, gb, I, T, IPH, RSH);
        if (groupV < 0) {
          // Optimizer actively bypasses negative voltage group with almost zero resistance
          const Ic = bisectCurrent(ga, gb, -I * 0.002, T, IPH, RSH, G);
          put(ga, gb, Ic);
          subV -= I * 0.002;
        } else {
          put(ga, gb, I);
          subV += groupV;
        }
      }
      V += subV * 0.985; // 98.5% MLPE conversion efficiency
    }
    return { cv, ci, dOn, totalV: V };
  }

  // Case 4: Smart Bypass (5-cell groups with MOSFET switches, Ron=5mΩ)
  for (let s = 0; s < 3; s++) {
    const a = 20 * s;
    const b = a + 20;
    let subV = 0;
    const subResults: Array<[number, number, number]> = [];

    for (let g = 4 * s; g < 4 * s + 4; g++) {
      const ga = 5 * g;
      const gb = ga + 5;
      if (S.arm[g]) {
        // MOSFET turned ON: voltage clamped to -I * RON
        const Ic = bisectCurrent(ga, gb, -I * RON, T, IPH, RSH, G);
        subResults.push([ga, gb, Ic]);
        subV -= I * RON;
      } else {
        subResults.push([ga, gb, I]);
        subV += sumCellVoltages(ga, gb, I, T, IPH, RSH);
      }
    }

    if (subV < -VD) {
      // Substring diode also triggers if sum is still too negative
      V += evalDiodeSubstring(s, a, b);
    } else {
      V += subV;
      for (const r of subResults) {
        put(r[0], r[1], r[2]);
      }
    }
  }

  return { cv, ci, dOn, totalV: V };
}

// Operating Point Solver: MPPT or Short-Circuit Near (IEC 61215 MQT 09)
export function solveOperatingPoint(
  S: SimStateInternal,
  mode: CircuitDefenseMode,
  op: 'mppt' | 'sc',
  IPH: number[],
  RSH: number[],
  G: number,
  TmVal: number,
): number {
  const Im = (ISC * G) / 1000;
  if (op === 'sc') {
    return Im * 0.98; // 98% of short-circuit current (severe thermal stress)
  }

  // Global MPPT search
  let bestP = -1e9;
  let bestI = 0;
  for (let k = 1; k <= 90; k++) {
    const I = (Im * k) / 90;
    const res = evalString(I, S, mode, IPH, RSH, G, TmVal);
    const p = I * res.totalV;
    if (p > bestP) {
      bestP = p;
      bestI = I;
    }
  }
  return bestI;
}

// Check trigger condition for Smart Bypass on 5-cell group g
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

  // Condition: Group voltage drops below 70% of normal OR max cell temp in group exceeds 85°C
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
): SimulationMetrics {
  const tm = calculateTm(env);
  const { IPH, RSH } = prepareCellProperties(env.G, shade, defect, defectRsh);
  const { rthNormal, rthDefect, ct } = getCoolingParameters(env.coolingMode);

  // 1. Solve current operating point for active mode
  const I = solveOperatingPoint(S, env.circuitMode, env.op, IPH, RSH, env.G, tm);
  const evalActive = evalString(I, S, env.circuitMode, IPH, RSH, env.G, tm);
  const P = Math.max(0, I * evalActive.totalV);

  // 2. Also solve baseline "unprotected" (none) for identical condition to calculate recovered power
  const Inone = solveOperatingPoint(S, 'none', env.op, IPH, RSH, env.G, tm);
  const evalNone = evalString(Inone, S, 'none', IPH, RSH, env.G, tm);
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
  if (env.circuitMode === 'smart') {
    updateSmartBypassArm(S, I, dt, env.lat, IPH, RSH, env.G, tm);
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
  const Pid = Math.max(0, PSTC * (env.G / 1000) * (1 + GM * (tm - 25)));

  // Power recovered
  const Precovered = Math.max(0, P - Pnone);
  const recoveryRatePercent = Pnone > 1 ? ((P - Pnone) / Pnone) * 100 : P > 0 ? 100 : 0;

  // Push waveform history
  if (dt > 0 && S.h.length < 3500) {
    S.h.push([S.t, hot, P, Pid, Ph, Precovered]);
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
): { th: number; P: number; Pid: number } {
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

  return { th, P, Pid };
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

  // First run unprotected to establish baseline energy
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

  const seriesKeys = ['none', 'diode', 'smart', 'optimizer', 'hybridWater'];

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
