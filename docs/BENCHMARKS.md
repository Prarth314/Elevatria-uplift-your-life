# Scheduler benchmark method and observations

Run `npm run benchmark` from the repository root with Node 24 and installed dependencies. The script writes `artifacts/scheduling-benchmark.json` (ignored). No external API or service is called. Timing thresholds do not run in CI.

The fixture generator fixes seed 314 and a synthetic planning clock. Workloads vary 100/300/1000 tasks, 2/3/5 competing goals, prerequisite chain segment limits 5/20/100, up to 1/4/2 sampled parents, 2/5/7 weekly windows, 2/12/30 commitments and 14/28/56-day horizons. Budgets and deadlines vary; finite windows and heuristic ordering leave work unplaced. These are examples, not evidence of user demand or exhaustive graph support. “Depth” in the shape describes the generation segment bound, not measured graph diameter.

Each direct operation has two warm-ups and nine measured samples; statistics include min, median, observed p95 and max. With nine samples p95 is the maximum, not a reliable estimate of population-tail latency. Recordings include exact Git HEAD, dirty status, source SHA-256, CPU, OS architecture, Node, logical CPU count, memory, dataset and measurement boundaries. Compare equivalent machines, clocks, seeds and shapes; device load and JIT/GC affect results.

Measurements include:

- Scheduling/repair including independent validation; repair halves goal budgets and reviews prior whole-task allocations without persistent locks.
- JSON serialization, validated import, ICS construction and a synthetic in-memory storage save/load. The storage port does **not** measure browser localStorage I/O, Web Lock waiting or hardware durability.
- Actual production worker entry through a Node worker_threads bridge. Cold round trips include worker construction/module import, structured cloning, computation and reply. Warm measurements reuse a worker, excluding initial warm-ups. In-worker computation excludes startup and cloning. Termination waits for Node termination, not browser UI repaint or abort-handler timing.

## Measured optimization

An initial working-tree run on Windows x64, Node 24.15.0, Ryzen 7 8840HS (16 logical CPUs, about 15 GiB RAM) found the large fixture's recovery median approximately **1,934 ms**. A follow-up same-workload observation after caching immutable availability within one repair run was approximately **915 ms**. All candidate invariant checks remained, with parity tests against uncached validation. These exploratory runs identified and checked the bottleneck; later modeling/verification changes mean they are not a controlled final-version A/B trial. Do not turn them into a guaranteed speedup or a production SLA.

The per-run cache is bounded to one creation clock and a private snapshot of goals/settings, and is released after the repair. It does not introduce a global cross-account cache. Complexity remains heuristic: eligible-task sorting/scanning is repeated, free intervals are scanned, and recovery can test up to 200 whole-task candidates. Larger/dense graphs or slower devices can hit the five-second browser worker limit; that failure terminates the worker and preserves accepted work.

Final reproducible measurements and source commit are recorded in the checked-in report added with the final evidence update. Browser paint/long-task profiling, low-end-device benchmarks, large embedded-image boards and hosted service latency remain unmeasured. The built-browser journey verifies behavior and responsiveness qualitatively, not a numeric frame-rate/INP claim.
