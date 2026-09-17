"""Bounded, deterministic CP-SAT schedule search. Implemented but not executed.

Accepts one JSON object on stdin. Emits one bounded JSON object on stdout.
Only clean opening loan balances are supported by this optional solver.
The worker must independently replay every returned integer schedule.
"""
import json
import sys
import time
from ortools.sat.python import cp_model

LIMIT = 1_000_000_000_000
DENOMINATOR = 520_000


def amount(value):
    if not isinstance(value, str) or not value.isdecimal() or len(value) > 13:
        raise ValueError('Expected integer paise string')
    result = int(value)
    if not 0 <= result <= LIMIT:
        raise ValueError('Money exceeds supported limit')
    return result


def solve(data):
    n = data['termWeeks']
    apr = data['aprBps']
    if type(n) is not int or not 1 <= n <= 104 or type(apr) is not int or not 0 <= apr <= 10000:
        raise ValueError('Invalid horizon or rate')
    principal = amount(data['principalPaise'])
    opening = amount(data['openingCashPaise'])
    buffer = amount(data['minimumBufferPaise'])
    installment_cap = amount(data['maximumInstallmentPaise'])
    interest_cap = amount(data['maximumInterestPaise'])
    extra_interest = amount(data['additionalInterestBudgetPaise'])
    allowed = set(data['allowedPaymentWeeks'])
    if any(type(w) is not int or not 1 <= w <= 104 for w in allowed) or n not in allowed:
        raise ValueError('Maturity must be an allowed date')
    scenarios = data['scenarios']
    if not isinstance(scenarios, list) or not 1 <= len(scenarios) <= 10:
        raise ValueError('Invalid scenario count')
    paths = []
    for scenario in scenarios:
        income = [amount(v) for v in scenario['incomePaise']]
        essentials = [amount(v) for v in scenario['essentialsPaise']]
        if len(income) != n or len(essentials) != n:
            raise ValueError('Scenario horizon differs')
        paths.append((income, essentials))
    if principal * apr + DENOMINATOR // 2 >= 2**62:
        raise ValueError('Unsafe integer product')
    model = cp_model.CpModel()
    dues = [model.new_int_var(0, principal, f'due_{t}') for t in range(n)]
    dates = [model.new_bool_var(f'date_{t}') for t in range(n)]
    balances = [model.new_int_var(0, principal, f'principal_{t}') for t in range(n)]
    interest = [model.new_int_var(0, LIMIT, f'interest_{t}') for t in range(n)]
    pending = [model.new_int_var(0, LIMIT, f'pending_{t}') for t in range(n)]
    payments = [model.new_int_var(0, installment_cap, f'payment_{t}') for t in range(n)]
    for t in range(n):
        previous = balances[t - 1] if t else principal
        previous_interest = pending[t - 1] if t else 0
        model.add(balances[t] == previous - dues[t])
        model.add(dues[t] <= principal * dates[t])
        if t != n - 1:
            model.add(dues[t] >= dates[t])  # No optional interest-only dates.
        if t + 1 not in allowed:
            model.add(dates[t] == 0)
        model.add(DENOMINATOR * interest[t] <= previous * apr + DENOMINATOR // 2)
        model.add(previous * apr + DENOMINATOR // 2 <= DENOMINATOR * (interest[t] + 1) - 1)
        model.add(payments[t] == dues[t] + previous_interest + interest[t]).only_enforce_if(dates[t])
        model.add(pending[t] == 0).only_enforce_if(dates[t])
        model.add(payments[t] == 0).only_enforce_if(dates[t].Not())
        model.add(pending[t] == previous_interest + interest[t]).only_enforce_if(dates[t].Not())
    model.add(dates[-1] == 1)
    model.add(sum(dues) == principal)
    model.add(balances[-1] == 0)
    model.add(pending[-1] == 0)
    model.add(sum(interest) <= interest_cap)
    if opening < buffer:
        model.add_bool_or([])  # Strict opening-buffer policy, no silent recovery allowance.
    for s, (income, essentials) in enumerate(paths):
        prior_cash = opening
        # Cash can accumulate across the entire bounded horizon.
        for t in range(n):
            cash = model.new_int_var(buffer, (n + 1) * LIMIT, f'cash_{s}_{t}')
            model.add(cash == prior_cash + income[t] - essentials[t] - payments[t])
            prior_cash = cash
    peak = model.new_int_var(0, installment_cap, 'largest_installment')
    model.add_max_equality(peak, payments)
    started = time.monotonic()
    seconds = max(0.1, min(5.0, float(data.get('seconds', 5))))
    stages = []

    def run(objective, budget, name):
        model.minimize(objective)
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = budget
        solver.parameters.num_search_workers = 1
        solver.parameters.random_seed = int(data.get('seed', 0))
        status = solver.solve(model)
        label = solver.status_name(status)
        feasible = status in (cp_model.OPTIMAL, cp_model.FEASIBLE)
        value = int(round(solver.objective_value)) if feasible else None
        bound = solver.best_objective_bound if feasible else None
        gap = max(0.0, value - bound) if feasible else None
        stages.append({'objective': name, 'status': label, 'valuePaise': str(value) if feasible else None,
                       'lowerBoundPaise': bound, 'absoluteGapPaise': gap,
                       'relativeGap': gap / max(1, abs(value)) if feasible else None,
                       'relativeGapDenominator': 'max(1, abs(feasible objective))',
                       'timeLimitSeconds': budget, 'wallSeconds': solver.wall_time})
        return solver, status

    first, first_status = run(sum(interest), max(0.1, seconds * 0.6), 'total_interest')
    if first_status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return {'status': first.status_name(first_status), 'optimalityProved': False, 'stages': stages}
    reference = sum(first.value(v) for v in interest)
    best = [str(first.value(d)) for d in dues]
    reference_kind = 'proven_minimum' if first_status == cp_model.OPTIMAL else 'best_found'
    model.add(sum(interest) <= min(interest_cap, reference + extra_interest))
    remaining = seconds - (time.monotonic() - started)
    final_status = first_status
    stage_two_optimal = False
    if remaining > 0.05:
        second, second_status = run(peak, remaining, 'maximum_installment')
        if second_status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            best = [str(second.value(d)) for d in dues]
            final_status = second_status
            stage_two_optimal = second_status == cp_model.OPTIMAL
    # Fewer dates and change-from-current tie breakers are not implemented.
    return {'status': 'OPTIMAL' if first_status == cp_model.OPTIMAL and stage_two_optimal else 'FEASIBLE',
            'optimalityProved': False, 'stages': stages, 'schedule': best,
            'interestReferencePaise': str(reference), 'interestReferenceKind': reference_kind,
            'additionalInterestBudgetPaise': str(extra_interest),
            'possiblePremiumAboveOptimumPaise': max(0, reference + extra_interest - first.best_objective_bound),
            'tieBreakersImplemented': False}


if __name__ == '__main__':
    try:
        raw = sys.stdin.buffer.read(65537)
        if len(raw) > 65536:
            raise ValueError('Input too large')
        result = solve(json.loads(raw))
    except Exception:
        result = {'status': 'MODEL_INVALID', 'optimalityProved': False, 'stages': []}
    sys.stdout.write(json.dumps(result, separators=(',', ':')))
