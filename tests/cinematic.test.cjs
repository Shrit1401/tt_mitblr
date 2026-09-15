const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const source = fs
  .readFileSync("domino-cinematic.html", "utf8")
  .split("<script>")[1]
  .split("</script>")[0]
  .replace(/render\(\);\s*$/, "");
const nodes = {};
const node = (id) =>
  (nodes[id] ||= {
    style: {},
    textContent: "",
    innerHTML: "",
    setAttribute() {},
    scrollIntoView() {},
    focus() {},
  });
const context = vm.createContext({
  console,
  performance,
  matchMedia: () => ({ matches: true }),
  document: {
    getElementById: node,
    querySelector: node,
    addEventListener() {},
    body: { classList: { add() {}, remove() {} } },
  },
  localStorage: { getItem: () => null, setItem() {} },
  history: { replaceState() {}, pushState() {} },
  location: { hash: "" },
  window: { addEventListener() {}, scrollTo() {} },
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  requestAnimationFrame: () => 1,
  cancelAnimationFrame() {},
});
vm.runInContext(source, context);
const run = (code) => vm.runInContext(code, context);
assert.equal(run("N"), 16);
assert.equal(run("allPlans().length"), 3876);
assert.equal(run("new Set(allPlans().map(p=>p.join())).size"), 3876);
assert.ok(
  run(
    "allPlans().every(p=>p.length===16&&p.every(v=>v>=0&&v%600===0)&&p.reduce((a,b)=>a+b,0)===2400)",
  ),
);
assert.equal(
  run("simulate().weeks[0].totalCash"),
  run("simulate(empty(),'A').weeks[0].totalCash"),
);
let cases = 0;
for (const shock of ["monsoon", "expense", "market"])
  for (const duration of [1, 3, 6])
    for (const loss of [500, 1500, 3000])
      for (const creditFreeze of [false, true])
        for (const story of ["A", "B"])
          for (const supported of [false, true]) {
            const config = { shock, duration, loss, creditFreeze };
            const result = run(
              `simulate(${supported ? "allPlans()[1500]" : "empty()"},'${story}',${JSON.stringify(config)})`,
            );
            assert.equal(result.weeks.length, 9);
            let countedMissed = 0,
              bufferWeeks = 0;
            const defaulted = new Set();
            for (let week = 1; week <= 8; week++) {
              const w = result.weeks[week];
              assert.ok(w.cash.every((c) => Number.isFinite(c) && c >= 0));
              countedMissed += w.missedNow.length;
              w.missedNow.forEach((i) => defaulted.add(i));
              bufferWeeks += w.below;
              assert.equal(w.missed, countedMissed);
              assert.equal(
                w.totalCash,
                w.cash.reduce((a, b) => a + b, 0),
              );
              let support = 0;
              w.ledger.forEach((l, i) => {
                assert.equal(
                  w.cash[i],
                  l.opening +
                    l.income +
                    l.support -
                    l.essentials -
                    l.loan -
                    l.guarantee,
                );
                assert.equal(l.opening, result.weeks[week - 1].cash[i]);
                assert.equal(
                  l.guarantee,
                  w.transfers
                    .filter((t) => t.from === i)
                    .reduce((a, t) => a + t.amount, 0),
                );
                support += l.support;
              });
              assert.equal(support, supported && week === 2 ? 2400 : 0);
              w.transfers.forEach((t) =>
                assert.ok(
                  run(`edges.some(([a,b])=>a===${t.from}&&b===${t.to})`),
                ),
              );
            }
            assert.equal(result.protected, 16 - defaulted.size);
            assert.equal(result.bufferWeeks, bufferWeeks);
            assert.equal(
              result.unpaidLoans,
              result.weeks[8].arrears.reduce((a, b) => a + b, 0),
            );
            assert.equal(
              result.loss,
              result.unpaidEssentials + result.unpaidLoans,
            );
            assert.equal(
              result.score,
              10 * countedMissed + bufferWeeks + result.unpaidEssentials / 600,
            );
            cases++;
          }
console.time("exhaustive information search");
const a = run("analysis()");
assert.equal(a.gross, 277.5);
assert.equal(a.net, 77.5);
assert.equal(a.roi, 38.75);
assert.notDeepEqual(a.blind.plan, a.bestB.plan);
assert.equal(run("simulate().missed"), 7);
assert.equal(run("simulate(analysis().bestB.plan).missed"), 0);
assert.ok(
  run(
    'allPlans().every(p=>!lower(simulate(p,"A"),analysis().bestA)&&!lower(simulate(p,"B"),analysis().bestB)&&!lower(average(simulate(p,"A"),simulate(p,"B")),analysis().blind))',
  ),
);
assert.equal(a.gross, a.blind.loss - (a.bestA.loss + a.bestB.loss) / 2);
run("state.revealed=true");
assert.equal(run("recommendation()===analysis().bestB"), true);
assert.equal(run("evaluate(recommendation().plan).loss"), a.bestB.loss);
// A low-severity scenario must show that information can cost more than it saves.
run(
  'Object.assign(state,{shock:"monsoon",duration:1,loss:500,creditFreeze:false})',
);
assert.equal(run("analysis().gross"), 0);
assert.equal(run("analysis().net"), -200);
console.timeEnd("exhaustive information search");
// Validate scripted state transitions with an artificial animation clock.
// This exercises real pitch logic while substituting only DOM rendering.
run("render=()=>{}; updateRescue=()=>{}; updateCascade=()=>{}; startPitch();");
for (let t = 0; t <= 46000; t += 100) run(`tickPitch(pitchState.last+100)`);
assert.equal(run("pitchState.running"), false);
assert.equal(run("state.step"), 3);
assert.equal(run("state.revealed"), true);
assert.deepEqual(run("state.alloc"), run("analysis().bestB.plan"));
run("startPitch();pitchState.paused=true;");
const pausedAt = run("pitchState.elapsed");
run("tickPitch(pitchState.last+100)");
assert.equal(run("pitchState.elapsed"), pausedAt);
run("endPitch(false);");
console.log(
  `PASS: ${cases} cash-flow scenarios, cash conservation, 3,876-plan optimality, VoI, and pitch transitions.`,
);
