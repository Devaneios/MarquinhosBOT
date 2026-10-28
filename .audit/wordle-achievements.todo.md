# Wordle achievement rebuild

- [x] Read the Principles section of the poteto-mode skill.
- [x] Phase A: Frame
- [x] Phase B: Design the workflow
- [x] Phase C: Run the loop
- [x] Inspect domain rules, storage, award transactions, clients, and reset behavior.
- [x] Check representative drawings against accepted dictionary guesses.
- [x] Prepare a concrete discovery proposal with alternatives and acceptance checks.
- [x] Resolve the pattern semantics and catalog approach with the user. Matching subsets and a curated catalog with reusable rules are selected.
- [x] Write the final design after the user selects an approach.
- [x] Complete the independent builder check and resolve material gaps. No important planning questions remain. Reachability for 50 of 53 target patterns is pending implementation verification.
- [x] Obtain design approval before product implementation, as required by brainstorming. User approved and emphasized yellow for win-oriented drawing opportunities.
- [x] Architect. Ground, Sketch, Agree, Implement, Scrap.
- [x] Arena. Frame, Fan out, Cross-judge, Pick, Graft, Verify.
- [x] Save and execute the implementation plan without another approval round.
- [x] Capture baseline domain tests. All 40 pass with 327 assertions.
- [x] Implement and verify the reset boundary.
- [x] Document the old-writer rollout requirement in the activation guide. Skip live cutover because no deployment or live activation is authorized.
- [x] Implement and verify pattern recognition and the replacement catalog.
- [x] Verify API, backfill, Activity, and bot behavior.
- [x] Phase D: Keep the audit trail
- [x] Phase E: Verify and hand back

Throughput checkpoint. Four implementation units follow design approval. First prove fresh eligibility without erasing lifetime statistics. Then prove shape matching with real-word examples and negative boards. Then replace the catalog. Finally verify both clients and retry behavior. Pattern reachability and reset correctness are the first risks to resolve.

Current scope. Implementation and verification are complete on codex/wordle-achievements-v2. Production activation and deployment are outside this delivery. README.md had user edits before this work and is untouched. Activity browser drive is skipped because no browser provider was available and native browser calls timed out. Actual Activity DOM interaction checks and production build pass. Live remaining-answer availability is deferred to deployment. Architect scrap phase was unnecessary because the accepted interfaces remained stable.
