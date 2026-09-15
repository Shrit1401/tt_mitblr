const fs = require("fs"),
  vm = require("vm"),
  assert = require("assert/strict");
const source = fs
  .readFileSync("domino-simple.html", "utf8")
  .split("<script>")[1]
  .split("</script>")[0];

function context(script) {
  const elements = new Map();
  const node = (id) =>
    elements.get(id) ||
    elements
      .set(id, { innerHTML: "", textContent: "", focus() {}, dataset: {} })
      .get(id);
  const ctx = vm.createContext({
    console,
    document: {
      getElementById: node,
      addEventListener() {},
      querySelector() {
        return null;
      },
    },
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {},
    },
    location: { hash: "" },
    history: { replaceState() {} },
    window: { addEventListener() {}, scrollTo() {} },
    setInterval,
    clearInterval,
    setTimeout,
    clearTimeout,
  });
  vm.runInContext(script, ctx);
  return ctx;
}
const ctx = context(source);
const run = (c, s) => JSON.parse(JSON.stringify(vm.runInContext(s, c)));

assert.equal(run(ctx, "people.length"), 4);
assert.equal(run(ctx, "edges.length"), 4);
const before = run(ctx, "priorCandidate()"),
  after = run(ctx, "confirmedCandidate()");
assert.notDeepEqual(before.plan, after.plan);
assert(run(ctx, "infoValue()") > 0);
let scenarios = 0;
for (const shock of ["delay", "expense", "market"])
  for (let duration = 1; duration <= 6; duration++)
    for (const severity of [0.25, 0.5, 0.75, 1])
      for (const story of ["market", "guarantee"])
        for (const defer of [false, true]) {
          vm.runInContext(
            `Object.assign(state,defaults(),{shock:'${shock}',duration:${duration},severity:${severity}})`,
            ctx,
          );
          const result = run(
            ctx,
            `simulate([600,600,600,600],'${story}',${defer})`,
          );
          assert.equal(result.weeks.length, 9);
          assert.equal(
            result.score,
            10 * result.missed +
              result.bufferWeeks +
              result.unpaidEssential / 600,
          );
          assert.equal(
            result.unpaidLoans,
            result.weeks[8].arrears.reduce((s, v) => s + v, 0),
          );
          for (let week = 1; week <= 8; week++) {
            const w = result.weeks[week];
            assert.equal(w.cash.length, 4);
            w.ledger.forEach((l, i) => {
              assert(w.cash[i] >= 0);
              assert.equal(
                w.cash[i],
                l.opening +
                  l.income +
                  l.support -
                  l.expense -
                  l.loan -
                  l.guarantee,
              );
              assert.equal(l.support, week === 2 ? 600 : 0);
            });
            w.transfers.forEach((t) =>
              assert(t.amount > 0 && t.from < 4 && t.to < 4),
            );
          }
          const best = run(ctx, "bestCandidate()");
          assert.equal(
            best.plan.reduce((s, v) => s + v, 0),
            2400,
          );
          assert(best.plan.every((v) => v >= 0 && v % 600 === 0));
          assert(run(ctx, "infoValue()") >= 0);
          for (let i = 0; i < 4; i++)
            vm.runInContext(`state.step=${i};render()`, ctx);
          scenarios++;
        }
vm.runInContext("Object.assign(state,defaults(),{revealed:true})", ctx);
const best = run(ctx, "bestCandidate()"),
  ngo = run(ctx, "evaluate(people.map(()=>600),bestCandidate().defer)");
const saved =
  ngo.unpaidEssential +
  ngo.unpaidLoans -
  best.unpaidEssential -
  best.unpaidLoans;
assert.equal(Math.round(saved), 173);
console.log(
  `${scenarios} scenarios passed: ledger conservation, loans, support timing, score, VoI, candidate budget and all four page renders.`,
);
console.log(
  "Default TXN-014 changes allocation; verified comparison leaves ₹173 less unpaid.",
);
