import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import type { OperationalSnapshot, Policy, EvaluateRequestV2 } from '@domino/contracts';
import { scenarioPaths, dateAtWeek, type Due, type SolverMetadata } from '@domino/engine';
export async function optimize(
  snapshot: OperationalSnapshot,
  policy: Policy,
  request: EvaluateRequestV2,
): Promise<{ schedule?: Due[]; metadata: SolverMetadata }> {
  if (process.env.DOMINO_OPTIMIZER_ENABLED !== 'true')
    return {
      metadata: {
        status: 'UNAVAILABLE',
        optimalityProved: false,
        reason: 'Optimizer is disabled until separately validated.',
      },
    };
  if (
    [
      snapshot.openingPrincipalArrearsPaise,
      snapshot.openingInterestPaise,
      snapshot.openingEssentialArrearsPaise,
    ].some((v) => v !== '0')
  )
    return {
      metadata: {
        status: 'UNAVAILABLE',
        optimalityProved: false,
        reason:
          'Initial solver supports clean opening debt only. Baseline replay still preserves all opening arrears.',
      },
    };
  const payload = {
    principalPaise: snapshot.openingPrincipalPaise,
    aprBps: snapshot.aprBps,
    openingCashPaise: snapshot.openingCashPaise,
    minimumBufferPaise:
      BigInt(policy.minimumBufferPaise) > BigInt(request.assumptions.minimumBufferPaise)
        ? policy.minimumBufferPaise
        : request.assumptions.minimumBufferPaise,
    maximumInstallmentPaise: policy.maximumInstallmentPaise,
    maximumInterestPaise: policy.maximumInterestPaise,
    additionalInterestBudgetPaise: policy.additionalInterestBudgetPaise,
    allowedPaymentWeeks: policy.allowedPaymentWeeks,
    termWeeks: snapshot.termWeeks,
    scenarios: scenarioPaths(snapshot, request).filter((p) => p.required),
    seconds: 5,
    seed: 0,
  };
  const script =
    process.env.DOMINO_OPTIMIZER_SCRIPT ??
    resolve(process.cwd(), '../../services/optimizer/solver.py');
  return new Promise((resolveResult) => {
    const child = spawn(process.env.DOMINO_PYTHON ?? 'python3', [script], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { PATH: process.env.PATH, PYTHONUNBUFFERED: '1' },
    });
    let output = '',
      bytes = 0,
      settled = false;
    const finish = (value: { schedule?: Due[]; metadata: SolverMetadata }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveResult(value);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish({
        metadata: {
          status: 'UNKNOWN',
          optimalityProved: false,
          reason: 'Subprocess exceeded the 7-second hard limit.',
        },
      });
    }, 7000);
    child.stdout.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 65536) {
        child.kill('SIGKILL');
        finish({
          metadata: {
            status: 'MODEL_INVALID',
            optimalityProved: false,
            reason: 'Optimizer response exceeded its output limit.',
          },
        });
      } else output += chunk.toString('utf8');
    });
    child.stderr.on('data', () => {}); // Solver internals and input are not copied into logs.
    child.on('error', () =>
      finish({
        metadata: {
          status: 'UNAVAILABLE',
          optimalityProved: false,
          reason: 'Optimizer subprocess could not start.',
        },
      }),
    );
    child.stdin.on('error', () => {});
    child.on('close', (code) => {
      if (settled) return;
      try {
        if (code !== 0) throw new Error();
        const result = JSON.parse(output);
        if (
          !['OPTIMAL', 'FEASIBLE', 'INFEASIBLE', 'UNKNOWN', 'MODEL_INVALID'].includes(result.status)
        )
          throw new Error();
        const metadata: SolverMetadata = {
          status: result.status,
          optimalityProved: result.optimalityProved === true,
          stages: Array.isArray(result.stages) ? result.stages : [],
        };
        if (
          typeof result.interestReferencePaise === 'string' &&
          /^\d{1,13}$/.test(result.interestReferencePaise) &&
          ['proven_minimum', 'best_found'].includes(result.interestReferenceKind) &&
          typeof result.additionalInterestBudgetPaise === 'string' &&
          /^\d{1,13}$/.test(result.additionalInterestBudgetPaise) &&
          typeof result.possiblePremiumAboveOptimumPaise === 'number' &&
          Number.isFinite(result.possiblePremiumAboveOptimumPaise)
        )
          metadata.interestReference = {
            paise: result.interestReferencePaise,
            kind: result.interestReferenceKind,
            additionalBudgetPaise: result.additionalInterestBudgetPaise,
            possiblePremiumAboveOptimumPaise: result.possiblePremiumAboveOptimumPaise,
          };
        if (!result.schedule) return finish({ metadata });
        if (
          !Array.isArray(result.schedule) ||
          result.schedule.length !== snapshot.termWeeks ||
          result.schedule.some((v: unknown) => typeof v !== 'string' || !/^\d{1,13}$/.test(v))
        )
          throw new Error();
        finish({
          metadata,
          schedule: result.schedule.map((principalDuePaise: string, i: number) => ({
            week: i + 1,
            date: dateAtWeek(snapshot.startDate, i),
            principalDuePaise,
          })),
        });
      } catch {
        finish({
          metadata: {
            status: 'MODEL_INVALID',
            optimalityProved: false,
            reason: 'Invalid optimizer response.',
          },
        });
      }
    });
    child.stdin.end(JSON.stringify(payload));
  });
}
