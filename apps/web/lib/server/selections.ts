import 'server-only';
import { randomUUID } from 'node:crypto';
import { withTenant } from '@domino/db';
import type { z } from 'zod';
import type { selectionRequest, approvalRequest } from '@domino/contracts';
import type { Member } from './auth';
import { HttpError } from './errors';
import { audit } from './evaluations';
export async function selectPlan(
  member: Member,
  evaluationId: string,
  request: z.infer<typeof selectionRequest>,
) {
  return withTenant(member.tenantId, async (client) => {
    const result = await client.query(
      'SELECT e.*,p.feasible,b.loan_version AS current_version FROM evaluations e JOIN candidate_plans p ON p.tenant_id=e.tenant_id AND p.evaluation_id=e.id JOIN borrowers b ON b.tenant_id=e.tenant_id AND b.id=e.borrower_id WHERE e.tenant_id=$1 AND e.id=$2 AND p.plan_id=$3 FOR UPDATE OF b',
      [member.tenantId, evaluationId, request.planId],
    );
    const row = result.rows[0];
    if (!row) throw new HttpError(404, 'PLAN_NOT_FOUND', 'Candidate plan not found.');
    if (row.status !== 'complete' || !row.feasible)
      throw new HttpError(
        409,
        'PLAN_NOT_ELIGIBLE',
        'Only a completed feasible candidate can be selected.',
      );
    if (
      row.loan_version !== request.expectedLoanVersion ||
      row.current_version !== request.expectedLoanVersion
    )
      throw new HttpError(409, 'STALE_LOAN_VERSION', 'Loan terms changed. Evaluate again.');
    const id = randomUUID();
    await client.query(
      'INSERT INTO selections(tenant_id,id,evaluation_id,plan_id,borrower_id,expected_loan_version,reviewer_id,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [
        member.tenantId,
        id,
        evaluationId,
        request.planId,
        row.borrower_id,
        request.expectedLoanVersion,
        member.userId,
        request.reason,
      ],
    );
    await audit(client, member, 'selection.reviewed', id, { evaluationId, planId: request.planId });
    return {
      selectionId: id,
      state: 'reviewed',
      approvalRequires: [
        'approver_role',
        'unchanged_loan_version',
        'borrower_consent',
        'verified_daily_replay',
      ],
    };
  });
}
export async function approveSelection(
  member: Member,
  id: string,
  request: z.infer<typeof approvalRequest>,
) {
  return withTenant(member.tenantId, async (client) => {
    const result = await client.query(
      'SELECT s.*,b.loan_version AS current_version,p.schedule,p.feasible,e.snapshot_id,snap.content_hash FROM selections s JOIN borrowers b ON b.tenant_id=s.tenant_id AND b.id=s.borrower_id JOIN candidate_plans p ON p.tenant_id=s.tenant_id AND p.evaluation_id=s.evaluation_id AND p.plan_id=s.plan_id JOIN evaluations e ON e.tenant_id=s.tenant_id AND e.id=s.evaluation_id JOIN snapshots snap ON snap.tenant_id=e.tenant_id AND snap.id=e.snapshot_id WHERE s.tenant_id=$1 AND s.id=$2 FOR UPDATE OF s,b',
      [member.tenantId, id],
    );
    const row = result.rows[0];
    if (!row) throw new HttpError(404, 'SELECTION_NOT_FOUND', 'Selection not found.');
    if (row.state === 'approved')
      return { selectionId: id, state: 'approved', activation: 'not_integrated' };
    if (row.state !== 'reviewed' || !row.feasible)
      throw new HttpError(409, 'SELECTION_NOT_ELIGIBLE', 'Selection is not ready for approval.');
    if (
      row.current_version !== request.expectedLoanVersion ||
      row.expected_loan_version !== request.expectedLoanVersion
    )
      throw new HttpError(409, 'STALE_LOAN_VERSION', 'Loan terms changed. Evaluate again.');
    if (row.reviewer_id === member.userId)
      throw new HttpError(
        403,
        'SEPARATE_APPROVER_REQUIRED',
        'A different authorized member must approve the selection.',
      );
    const daily = await client.query(
      'SELECT id FROM daily_replay_checks WHERE tenant_id=$1 AND id=$2 AND evaluation_id=$3 AND plan_id=$4 AND snapshot_hash=$5 AND passed=true',
      [
        member.tenantId,
        request.dailyReplayReference,
        row.evaluation_id,
        row.plan_id,
        row.content_hash,
      ],
    );
    if (!daily.rows[0])
      throw new HttpError(
        409,
        'DAILY_REPLAY_REQUIRED',
        'A trusted daily-event verification integration must certify this snapshot and plan.',
      );
    const newVersion = row.current_version + 1;
    const oldLoan = await client.query(
      'SELECT snapshot,principal_paise FROM loan_snapshots WHERE tenant_id=$1 AND borrower_id=$2 AND version=$3',
      [member.tenantId, row.borrower_id, row.current_version],
    );
    if (!oldLoan.rows[0])
      throw new HttpError(409, 'STALE_LOAN_VERSION', 'Loan snapshot is unavailable.');
    await client.query(
      'INSERT INTO schedule_versions(tenant_id,borrower_id,version,selection_id,schedule) VALUES($1,$2,$3,$4,$5)',
      [member.tenantId, row.borrower_id, newVersion, id, JSON.stringify(row.schedule)],
    );
    await client.query(
      'INSERT INTO loan_snapshots(tenant_id,borrower_id,version,principal_paise,snapshot) VALUES($1,$2,$3,$4,$5)',
      [
        member.tenantId,
        row.borrower_id,
        newVersion,
        oldLoan.rows[0].principal_paise,
        JSON.stringify({ ...oldLoan.rows[0].snapshot, loanVersion: newVersion }),
      ],
    );
    await client.query(
      'UPDATE borrowers SET loan_version=$3,updated_at=now() WHERE tenant_id=$1 AND id=$2',
      [member.tenantId, row.borrower_id, newVersion],
    );
    await client.query(
      "UPDATE selections SET state='approved',consent_reference=$3,approved_by=$4,approved_at=now() WHERE tenant_id=$1 AND id=$2",
      [member.tenantId, id, request.consentReference, member.userId],
    );
    await client.query(
      "UPDATE selections SET state='superseded' WHERE tenant_id=$1 AND borrower_id=$2 AND id<>$3 AND state IN ('draft','reviewed')",
      [member.tenantId, row.borrower_id, id],
    );
    await audit(client, member, 'selection.approved', id, {
      scheduleVersion: newVersion,
      dailyReplayReference: request.dailyReplayReference,
    });
    return {
      selectionId: id,
      state: 'approved',
      scheduleVersion: newVersion,
      activation: 'not_integrated',
    };
  });
}
