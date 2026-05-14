# SyncWave Empirical Failure Notebook

This notebook is the source of truth for real-world synchronization failures. We document every "ugly" reality here to inform future behavioral refinements.

---

## Session Template

**Date:** YYYY-MM-DD  
**Device Cluster:** [e.g., iPhone 15 (Follower) + MacBook Pro (Host)]  
**Network Environment:** [e.g., Variable LTE, Home WiFi, Hotspot]  
**Audio Route:** [e.g., AirPods, Wired Headphones, Internal Speaker]

### Test Scenario
[e.g., 2-minute screen lock, elevator partition, rapid seek spam]

### Observed Failure Pattern
*   **Engine Behavior:** [e.g., Confidence dropped to 0, 3 seeks in 10 seconds, stayed in quarantine for 5s]
*   **Physical Behavior:** [e.g., Song restarted from beginning, audio stuttered, audio paused indefinitely]

### Human Perception & Trust
*   **Perception Score (1-10):** [1 = Seamless, 10 = App feels completely broken]
*   **Emotional Reaction:** [e.g., "Frustrating," "Annoying but expected," "Didn't notice the drift until it snapped"]
*   **Trust Stability:** [Did the user feel the need to manualy refresh/restart?]

### Recovery Performance
*   **Latency to Sync:** [How many seconds until audio was perceived as 'together' again?]
*   **Recovery Feel:** [e.g., Smooth ramp, violent snap, multiple micro-corrections]

---

## Active Test Log

### Test A1: Short Lock (10s)
*   **Predicted Outcome:** `deltaMs` anomaly detected (~10,000ms). Temporal continuity transitions to `INVALID`. Revalidation Quarantine drops all background events. `SYNC_REQUEST` fired. Recovery completes within <2s.
*   **Human Goal:** Seamless audio preservation. No audible seek.
*   **Actual Results:** [PENDING USER RUN]

### Test A2: Medium Lock (60s)
*   **Predicted Outcome:** `ghostConfidence` decays significantly (linear drop over 60s). Continuity `INVALID`. `RECOVERY_SYNC_COMPLETE` triggers 1.5s revalidation window. Potential audible seek if physical drift exceeded 2000ms.
*   **Human Goal:** "Careful and intelligent" feel. Paused during revalidation, then snaps to truth.
*   **Actual Results:** [PENDING USER RUN]

### Test A3: Long Lock (5m) + Remote Mutation
*   **Predicted Outcome:** Confidence at `0.0`. Quarantine is absolute. Remote `PAUSE` or `SEEK` events are completely ignored during background. Wakeup forces `Snapshot Dominance`. Worldview is completely replaced.
*   **Human Goal:** No "ghost playback." The device should not play the "stale" song for a second before snapping.
*   **Actual Results:** [PENDING USER RUN]

| Date | Scenario | Failure Observed | Human Perception | Actionable Insight |
| :--- | :--- | :--- | :--- | :--- |
| 2026-05-13 | Baseline Join | None | Seamless (1) | Handshake works on Fiber. |
| | | | | |

---

## Emerging Behavioral Patterns
*   *Observation 1:* [e.g., Users forgive pauses if the "Revalidating" status is visible.]
*   *Observation 2:* [e.g., AirPods latency spikes trigger unnecessary hard seeks.]
