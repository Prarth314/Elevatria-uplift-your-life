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

Final reproducible measurements and source commit are recorded below. Browser paint/long-task profiling, low-end-device benchmarks, large embedded-image boards and hosted service latency remain unmeasured. The built-browser journey verifies behavior and responsiveness qualitatively, not a numeric frame-rate/INP claim.

## Final recorded run

Measured clean commit `f200a16f91221d13281d1585284ae1e2ae063ab0` (`dirty: false`), source SHA-256 `ed724b333582fd4921511798583a966ccc0710d449cfe3f3d08909a217472f4c`. Full samples/distributions, dataset shape and environment metadata are in [the machine-readable report](benchmarks/2026-11-01-node24.json). Source code is identical in the following documentation-only update.

| Tasks / goals | Schedule median / observed p95 | Recovery median / observed p95 | Cold Node-worker round trip median | Warm Node-worker round trip median |
| --- | --- | --- | --- | --- |
| 100 / 2 | 2.36 / 2.58 ms | 17.06 / 19.85 ms | 60.25 ms | 3.58 ms |
| 300 / 3 | 10.42 / 11.86 ms | 144.66 / 158.31 ms | 65.48 ms | 12.11 ms |
| 1000 / 5 | 30.13 / 32.4 ms | 508.65 / 521.12 ms | 90.95 ms | 33.39 ms |

For the 1,000-task fixture, validated JSON import median was 2.11 ms, synthetic memory-port save/load 4.08 ms, and ICS serialization 15.24 ms. These measurements exclude browser rendering, native localStorage/Web Lock I/O, and calendar-client import. The final large recovery median was 508.65 ms; differences from exploratory runs also reflect machine load and subsequent code/check changes. Use the final report for reproducibility, not a claimed percentage improvement.
