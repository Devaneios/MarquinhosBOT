# Achievement maintenance

- [x] 1. Pin the behavior contract first. Run the **how** skill over the affected subsystem to learn the contract, then write a characterization test, snapshot, or equivalence harness that captures current behavior before any structure moves. If the area has no coverage, write the pin before touching structure. Type check and lint are not a pin.
- [x] 2. Name the structure the code is missing per **principle-model-the-domain**. Boring code stays when the shape is already clear and local. The reshape must delete branches or invalid states, not add indirection.
- [x] 3. Name the target shape. State what the module layout, types, and call graph should be if built today (**principle-foundational-thinking**, **principle-redesign-from-first-principles**). If the target crosses a function boundary, run the **architect** skill for parallel design exploration of the shape before the move.
- [ ] 4. Subtract before you add. Delete dead code, collapse one-caller wrappers, drop redundant validators, and remove orphan references before introducing the new shape (**principle-subtract-before-you-add**). The smallest change that reaches the target shape ships (**principle-laziness-protocol**). A speculative cleanup that "might help" gets reverted.
- [ ] 5. Move in small behavior-preserving steps, each keeping the pin green. For API reshapes, migrate every caller and delete the old API in the same wave (**principle-migrate-callers-then-delete-legacy-apis**). No compatibility shims, no parallel old-and-new paths. Spot-check every rename against the actual files. Renames silently miss usages in strings, prose, and back-references. Delegate the mechanical edits to a subagent using your configured refactoring model (default in poteto-mode's Models section) with a specific scope (file paths, the names being moved, the behavior to hold). Pick each subagent's reasoning level for the job, per the Subagents section.
- [ ] 6. Prove behavior is unchanged on the real artifact, not "it compiles" (**principle-prove-it-works**). For larger reshapes, run an equivalence check: a script that diffs old-vs-new outputs, a recorded baseline replayed against the new code, or a smoke run on the matching surface via the relevant driver skill.
- [ ] 7. Confirm the change is worth keeping. The success measure is reduced reader load (**principle-minimize-reader-load**). If the diff does not lower reader load somewhere, revert it.
- [ ] 8. Rebase into small ordered commits. A subtraction commit, then the reshape, then any follow-on cleanup. Shape them with the **sequence-verifiable-units** principle skill, so each behavior-preserving slice stays green before the next. Run **Opening a PR**.

- [x] Pin current catalog, serialized rules, patterns and every rule kind.
- [ ] Convert content and reorganize engine, migrating all consumers.
- [ ] Add transactional retirement and concurrency coverage.
- [ ] Add authoring guide.
- [ ] Run parity, domain, API, bot, Activity, typecheck and lint.
- [ ] Independent whole-change review and resolve important findings.

Throughput checkpoint. Blocking first steps are current-working-tree behavior capture and the approved design. Domain and retirement writers have separate worktrees. Shared mutable state is eliminated until integration; import migrations are owned by the domain writer. Integration and verification serialize in the shared checkout. The smallest safe decomposition is two owners because retirement needs independent database/concurrency tests while the domain authoring change needs exact parity.
