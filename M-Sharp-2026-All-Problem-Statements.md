# M# 2026: All 12 Problem Statements

Source: [M# 2026 official website](https://hackathon.manipal.edu), Tracks section, viewed in Zen during this conversation.

This document contains detailed paraphrases of all 12 statements across the six tracks. Titles are retained, with punctuation normalized. The explanations organize the official briefs into their underlying problem, requested capabilities, and open design choices. They are not verbatim copies or additional competition requirements. Illustrative examples are explicitly identified.

## Contents

| No. | Track | Problem statement |
| --- | --- | --- |
| 1 | Healthcare | The Vanishing Dose: Detecting Medication Non-Adherence Without Asking |
| 2 | Healthcare | From One Empty Shelf to a Regional Shortage |
| 3 | Disaster Resilience & Critical Infrastructure | Reading the Road |
| 4 | Disaster Resilience & Critical Infrastructure | Cascading Failure: When One Failure Becomes Many |
| 5 | Cybersecurity | Silent Shift: Detecting the Insider Before the Incident |
| 6 | Cybersecurity | Open Source Supply Chains: The Ripple Effect |
| 7 | Culture & Community | Build a Community from Zero: The FellaRide Butterfly Effect |
| 8 | Culture & Community | Custodian: Culture on Its Own Terms |
| 9 | Smart Governance & Compliance | Unverified Post-Award Subcontractor Variations |
| 10 | Smart Governance & Compliance | Automated Public Procurement Anomaly Detection |
| 11 | Microfinance | When One Borrower Falls Behind |
| 12 | Microfinance | Dynamic Microloan Repayment & Cash-Flow Planning |

## Track 1: Healthcare

### 1. The Vanishing Dose: Detecting Medication Non-Adherence Without Asking

**Track statement:** 01 of 02  
**SDG shown:** 3, Good Health and Well-being

#### The underlying problem

A correct prescription does not guarantee successful treatment. Patients may miss doses, take them at different times, or stop treatment. Clinicians often have little visibility into what happens between appointments. Intermittent changes are especially difficult to detect because they do not look like complete abandonment of treatment.

Routine healthcare information may contain indirect clues, including pharmacy refill history, prescription changes, symptom patterns, wearable observations, and follow-up records. These clues are often considered separately rather than together.

#### What the solution should do

- Combine indirect, routinely available signals to identify patterns that may indicate medication non-adherence.
- Reason across changes and inconsistencies over time rather than require patients to log every missed dose.
- Distinguish a temporary irregularity from a persistent or meaningful pattern.
- Explain uncertainty clearly so clinicians understand the strength and limits of a finding.
- Help healthcare professionals consider whether treatment outcomes may relate to how medication is being taken.

#### Important nuance

The brief does not ask for automatic declarations that a patient is non-compliant. A concerning pattern is evidence to investigate, not proof of a patient's behavior. A basic reminder app would address a different problem from the inference and uncertainty challenge described here.

**Illustrative example:** A delayed refill, a changed prescription, and a symptom change are reviewed together. The system explains why a follow-up may be useful while identifying alternative explanations and missing information.

### 2. From One Empty Shelf to a Regional Shortage

**Track statement:** 02 of 02  
**SDG shown:** 3, Good Health and Well-being

#### The underlying problem

A medicine stockout at one facility may appear isolated, but falling stock across multiple facilities can indicate a larger supply disruption. Consumption, delivery delays, uneven inventories, and geography can amplify shortages before authorities recognize the regional pattern.

Without shared visibility, one facility may run out while another holds unused supply.

#### What the solution should do

- Detect emerging medicine shortages across facilities.
- Explain how a local inventory issue could become a wider disruption.
- Consider stock levels, consumption, replenishment, location, and available supplies.
- Explore redistribution or other interventions where appropriate.
- Help decision-makers prioritize recommendations and understand uncertainty.

#### Open design choices and data

Teams may choose the forecasting approach, how to represent facilities and supplies, and how to rank possible responses. The brief explicitly permits simulated or public healthcare supply data for demonstration.

**Illustrative example:** Several nearby facilities show increasing consumption while an incoming shipment is delayed. The system identifies an approaching regional gap and evaluates whether another facility can share stock without creating a new shortage.

## Track 2: Disaster Resilience & Critical Infrastructure

### 3. Reading the Road

**Track statement:** 01 of 02  
**Organization shown:** Cognecto  
**SDG shown:** 9, Industry, Innovation and Infrastructure

#### The underlying problem

Road imagery contains information about physical road characteristics, but extracting reliable real-world measurements is difficult. Camera perspective, changing road geometry, and recording conditions affect what can be observed and quantified.

Manual measurement is slow and difficult to scale across large networks.

#### What the solution should do

- Derive real-world road-width measurements from available survey data with little manual intervention.
- Use visual information and other useful signals to understand road geometry.
- Translate observations into meaningful physical measurements.
- Handle different road environments and situations where evidence is incomplete or ambiguous.
- Indicate how trustworthy the resulting measurements are.

#### Important nuance

The requested output is a physical measurement, not just a highlighted road in an image. The brief leaves room to decide how survey information and supporting signals establish geometry and scale.

**Illustrative example:** A user selects a survey segment and receives estimated road widths along it, with lower-confidence sections flagged when boundaries are obscured or perspective is difficult.

### 4. Cascading Failure: When One Failure Becomes Many

**Track statement:** 02 of 02  
**SDG shown:** 11, Sustainable Cities and Communities

#### The underlying problem

Roads, bridges, hospitals, utilities, and other critical assets depend on one another. Monitoring each asset separately can miss the wider effects of a disruption. A single failure may redirect traffic or resources, overload alternatives, and damage services far from the original location.

#### What the solution should do

- Represent a selected infrastructure network and its relationships.
- Allow users to introduce one or more failures.
- Explore how disruptions propagate through the network.
- Estimate wider consequences and identify unusually important assets or connections.
- Compare alternative scenarios to help planners identify effective interventions.

#### Open design choices

Teams may define the infrastructure domain, geographic scope, disruption model, impact measures, data sources, and analytical methods. The aim is to support intervention planning through interconnected system modelling.

**Illustrative example:** Closing a bridge changes access routes to a hospital. The system compares the effects of restoring that connection versus increasing capacity on an alternative route.

## Track 3: Cybersecurity

### 5. Silent Shift: Detecting the Insider Before the Incident

**Track statement:** 01 of 02  
**SDG shown:** 16, Peace, Justice and Strong Institutions

#### The underlying problem

A compromised or malicious account may behave normally before gradually or suddenly changing how it accesses systems, files, privileges, or resources. Individual events can appear harmless even when their combined sequence is concerning.

At the same time, legitimate work changes can produce unusual behavior. Security teams need early signals without excessive false alarms.

#### What the solution should do

- Establish user behavior baselines.
- Detect meaningful deviations and correlate multiple signals over time.
- Explain why an account's behavior deserves investigation.
- Incorporate legitimate context, including new projects or role changes.
- Prioritize activity for human investigation while controlling false positives.

#### Open design choices

Teams decide how behavior is represented, how anomalies are combined, how context is included, and how alerts are explained. The objective is to identify potentially dangerous transitions before an incident becomes obvious.

**Illustrative example:** New access patterns are evaluated alongside a role change. The system distinguishes expected access expansion from a sequence that remains unexplained by the person's new responsibilities.

### 6. Open Source Supply Chains: The Ripple Effect

**Track statement:** 02 of 02  
**SDG shown:** 9, Industry, Innovation and Infrastructure

#### The underlying problem

Applications rely on deeply nested open-source packages. A compromise in a low-level dependency can affect many downstream applications. Evaluating packages individually does not necessarily reveal structural importance or the reach of a compromise.

A dependency's ecosystem role may therefore matter beyond its vulnerability score alone.

#### What the solution should do

- Map relationships in a software dependency ecosystem.
- Explore the downstream consequences of a compromised dependency.
- Identify critical dependencies, affected applications, and propagation paths.
- Prioritize mitigation options.
- Make the reasoning behind risk assessments visible.

#### Open design choices and data

Teams may choose relationship models, propagation simulations, impact measures, and mitigation-ranking methods. Public open-source dependency information and simulated compromise scenarios are explicitly allowed.

**Illustrative example:** Selecting a compromised transitive dependency reveals which applications depend on it and compares candidate mitigation steps by their potential to reduce exposure.

## Track 4: Culture & Community

### 7. Build a Community from Zero: The FellaRide Butterfly Effect

**Track statement:** 01 of 02  
**Organization shown:** FellaRide  
**SDG shown:** 11, Sustainable Cities and Communities

#### The underlying problem

Carpooling platforms need enough participants within the same community to create value, yet attracting those first participants is difficult when the platform starts empty. A university, company, residential community, alumni network, or professional group may contain potential users without an obvious path to activating them.

Public digital signals may reveal existing communities, interaction spaces, commuting patterns, and likely early adopters. The challenge is to convert those signals into the first meaningful interactions, not simply identify a broad advertising audience.

#### What the solution should do

- Help FellaRide establish an active community from zero users within a selected community.
- Discover relevant public digital communities and signals.
- Identify potential drivers, passengers, connectors, and early adopters.
- Design contextual engagement rather than purely promotional outreach.
- Demonstrate a growth loop from discovery and engagement to ride creation, matching, referrals, and repeat activity.
- Define success beyond registrations alone.

#### Open design choices and data

The brief allows exploration of publicly accessible websites, social-media pages, forums, event information, community networks, geographic information, and other legally accessible sources. Teams decide how AI discovers, prioritizes, personalizes, and learns from these signals, as well as the strategy, technology, intervention model, and success metrics.

The central question is which small intervention can produce a disproportionately large effect and turn the first few users into an active community.

**Illustrative example:** A system identifies a recurring event and a small set of participants with overlapping routes, then proposes a targeted activation experiment and measures completed rides and repeat participation.

### 8. Custodian: Culture on Its Own Terms

**Track statement:** 02 of 02  
**SDG shown:** 11, Sustainable Cities and Communities

#### The underlying problem

Cultural-tourism platforms often organize traditions, performances, crafts, rituals, and heritage around what visitors can find and buy. The artists, artisans, priests, elders, and community hosts who safeguard those practices may have limited control over their representation, pricing, and description.

This can reduce both economic participation and ownership of the cultural narrative.

#### What the solution should do

- Put cultural custodians at the center of representation, discovery, and optional monetisation.
- Let custodians decide what is shared and how it is framed.
- Support relevant capabilities such as language access, discovery, participation, or direct economic exchange.
- Preserve authenticity and community ownership through the chosen design.

#### Open design choices

Teams choose the interaction model, technology, governance mechanisms, and consent controls. The challenge is intentionally open-ended, but the primary user should be the custodian rather than the visitor.

**Illustrative example:** An artisan controls which parts of a practice are public, approves translated descriptions, defines participation conditions, and decides how any economic exchange occurs.

## Track 5: Smart Governance & Compliance

### 9. Unverified Post-Award Subcontractor Variations

**Track statement:** 01 of 02  
**SDG shown:** 16, Peace, Justice and Strong Institutions

#### The underlying problem

Public contracts receive detailed review before award, but projects can change considerably during execution. Contractors or subcontractors may change, materials and costs may shift, and schedules or project details may be revised.

When these changes are difficult to compare with the original commitment, authorities cannot easily tell whether a project remains aligned with its approval or whether a variation needs closer review.

#### What the solution should do

- Give stakeholders visibility into significant changes after contract award.
- Compare original commitments with subsequent project information.
- Explain the potential implications of detected changes.
- Surface variations that require review, intervention, or more evidence.
- Connect findings to supporting information and prioritize review.

#### Open design choices and important nuance

Teams define meaningful variation, detection methods, presentation, evidence connections, and review priority. The brief explicitly calls for oversight without assuming every change is improper.

**Illustrative example:** An approved materials specification is compared with an amendment and delivery documentation. A mismatch is flagged for reconciliation, and a later approval can resolve it when the evidence supports that conclusion.

### 10. Automated Public Procurement Anomaly Detection

**Track statement:** 02 of 02  
**SDG shown:** 16, Peace, Justice and Strong Institutions

#### The underlying problem

Government procurement produces large numbers of tenders, vendor records, contracts, and payments. Manual review can miss unusual bidding, repeated awards, unexplained price differences, or relationships between participants.

However, unusual transactions are not necessarily problematic. Specialized markets can have legitimate patterns that look anomalous without context.

#### What the solution should do

- Analyze available procurement evidence.
- Identify activities and relationships that deserve human investigation.
- Surface unusual patterns and prioritize cases.
- Show which relationships or signals generated each alert.
- Distinguish meaningful concerns from legitimate variation and reduce false positives.

#### Open design choices and important nuance

Teams choose patterns to model, vendor-relationship representations, procurement comparisons, and investigation-priority scoring. The system should direct review effort, not automatically label entities as corrupt.

**Illustrative example:** Repeated awards and price differences are examined alongside market context and vendor relationships. The output is an evidence-backed review queue, not a verdict.

## Track 6: Microfinance

### 11. When One Borrower Falls Behind

**Track statement:** 01 of 02  
**SDG shown:** 8, Decent Work and Economic Growth

#### The underlying problem

A microfinance group can appear healthy while one member is beginning to experience financial stress. Shared guarantees, lending arrangements, common income sources, and local economic conditions can connect borrowers and transmit pressure between them.

Some difficulties remain isolated or temporary; others can develop into a group-level problem.

#### What the solution should do

- Model how financial stress develops and may propagate through a connected borrower group.
- Distinguish isolated difficulty from vulnerability caused by another member.
- Distinguish those effects from independent deterioration in a borrower's own finances.
- Explore interventions that reduce wider risk without unnecessarily penalizing healthy borrowers.

#### Open design choices and data

Teams choose relationship representations, how shocks are introduced and propagated, and how intervention effects are assessed. Historical or simulated borrower, repayment, income, and relationship data are explicitly permitted.

**Illustrative example:** A missed payment is considered alongside shared guarantees and a local income shock to assess whether the concern is individual, interconnected, or caused by a common external factor.

### 12. Dynamic Microloan Repayment & Cash-Flow Planning

**Track statement:** 02 of 02  
**SDG shown:** 8, Decent Work and Economic Growth

#### The underlying problem

Many borrowers have irregular or seasonal income and expenses. A fixed repayment schedule can put pressure on someone who is financially healthy overall but lacks cash on a particular date.

Lenders therefore need to understand how repayment timing interacts with changing cash availability, rather than only whether a borrower is likely to repay eventually.

#### What the solution should do

- Help lenders structure and evaluate repayment plans that balance affordability and sustainable recovery.
- Reason about cash-flow patterns and periods of repayment stress.
- Compare alternative repayment structures.
- Detect changes in financial condition and explain recommendation evidence.
- Account for irregular or seasonal income without treating a temporary downturn as permanent deterioration.

#### Open design choices and data

Teams may choose models for cash flow, risk, affordability, interventions, and explainability. Historical income, expenses, transactions, and repayment behavior can provide relevant signals. Simulated financial data is explicitly allowed.

**Illustrative example:** Alternative repayment schedules are compared against a seasonal income pattern, showing when each schedule creates pressure and how it affects expected recovery.

## Key distinctions between related statements

| Statements | Difference in focus |
| --- | --- |
| Healthcare 1 vs. Healthcare 2 | Individual treatment-taking patterns versus medicine availability across a network of facilities. |
| Infrastructure 1 vs. Infrastructure 2 | Physical road measurement from survey data versus the propagation of failures through connected assets. |
| Cybersecurity 1 vs. Cybersecurity 2 | Changes in account behavior versus compromise consequences across software dependencies. |
| Culture 1 vs. Culture 2 | Activating the first participants in a carpooling community versus giving cultural custodians control over representation and participation. |
| Governance 1 vs. Governance 2 | Changes during execution of an awarded project versus unusual patterns across procurement activity and participant relationships. |
| Microfinance 1 vs. Microfinance 2 | Financial stress spreading between connected borrowers versus repayment timing and affordability for changing cash flows. |

## Round 1 evaluation context supplied in this conversation

The following summarizes the criteria pasted by the user. It is separate from the problem-statement descriptions above.

1. **Innovation beyond given requirements:** Novel additional functionality and the quality of its implementation and integration.
2. **Feasibility:** Practical execution, a reachable implementation roadmap, and consideration of diverse beneficiaries.
3. **Marketing / media strategy:** Outreach, understanding of the target audience, and a credible path to measurable real-world impact.
4. **Monetisation:** A clear revenue model, scalability, and sustainable operations.
5. **Format adherence:** Use of the mandatory presentation template and compliance with specified video guidelines.
6. **Prototype bonus:** A functional, accessible prototype meeting the Round 1 submission specifications can earn additional marks.

The supplied text mentions immediate disqualifications, minor deductions, and fair-play expectations, but does not include the actual violation tiers. Exact video rules, template contents, and detailed prototype specifications are not reproduced here because they were not included in that text or reviewed as part of compiling these statements.
