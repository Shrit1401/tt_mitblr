# DOMINO light redesign

Final result: passed for the reviewed desktop flow.

The supplied Cashly dashboard screenshot guided the white cards, pale neutral page background, soft coral controls, compact headings, muted chart colors, and spacious grid. The application retains DOMINO's four-stage narrative rather than adding unrelated personal-finance widgets.

The live model now contains four households and four guarantee links in one closed circle. Each household both covers a borrower and depends on another guarantor. The previous 16-household dark version is preserved in `domino-cinematic.html`.

Reviewed Safari screenshots of the network, investigation, and rescue screens against the supplied reference. Corrected dark styles in the household selector, explanatory card, and allocation buttons; increased arrow clearance around the larger nodes. Verified manual coin allocation, application of the full recommended budget, and TXN-014 changing both probabilities and allocation. Reset the preview to the opening case.

`node tests/light.test.cjs` passes 216 model scenarios, cash conservation, guarantee transfers, support timing, score arithmetic, all 35 valid four-coin plans, optimizer optimality, information value, and scripted pitch transitions. Default expected net information value is ₹320 after a ₹200 fee. Actual results remain calculated from the selected assumptions.

Limits: mobile viewport rendering has responsive rules but was not visually reviewed. Full autoplay timing was tested with a controlled animation clock, not a complete real-time browser recording. The earlier ZIP contains an older version and is not the current deliverable.
