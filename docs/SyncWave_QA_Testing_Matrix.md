# SyncWave Empirical QA Matrix: Human Perception & Continuity Testing

This document defines the testing protocols required to validate the SyncWave Synchronization Core against human perception and physical device entropy. We are no longer testing "does the math work?" We are testing "does the user trust the system?"

## 1. The Multi-Device Reality Matrix

Tests must be executed across heterogeneous device clusters to expose hardware-specific latency and OS suspension behaviors.

| Test Cluster | Host Device | Follower Device | Network Conditions | Audio Route | Target Discovery |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **A: Baseline** | MacBook (Chrome) | MacBook (Safari) | Fiber (Strong) | Wired/Internal | Baseline jitter & socket latency |
| **B: Commuter** | iPhone (Safari) | Android (Chrome) | LTE -> 3G | Bluetooth | Bluetooth latency & jitter |
| **C: Hostile** | Android (Chrome) | iPhone (Safari) | Hotspot | Speaker | Severe packet loss & buffering |
| **D: Cross-Platform**| Windows (Edge) | iPhone (Safari) | Wi-Fi | Bluetooth | OS suspension behaviors |

---

## 2. Psychological Chaos Protocols

These are deliberate failure injections designed to trigger the engine's Trust Management defenses in the real world.

### Protocol 1: The Elevator (Network Partition)
*   **Execution:** Follower joins room, listens for 30s. Follower toggles Airplane Mode for 20s, then reconnects.
*   **Engine Defense:** Ghost Confidence Decay -> Controlled Halt -> Revalidation Quarantine -> Snapshot Dominance.
*   **Human Scoring (1-5):**
    *   *Whiplash:* Was the resumption jarring?
    *   *Isolation:* Did the 20s offline feel broken, or just "waiting"?

### Protocol 2: The Screen Lock (Execution Suspension)
*   **Execution:** Follower locks phone screen for 2 minutes while playing. Host seeks the track 3 times while Follower is locked. Follower unlocks phone.
*   **Engine Defense:** Suspension Detection -> Zero Confidence -> Event Supersession -> Snapshot Dominance.
*   **Human Scoring (1-5):**
    *   *Chaos:* Did the app violently spasm through multiple seeks upon wakeup?
    *   *Clarity:* Did the UI communicate "re-syncing"?

### Protocol 3: The Bluetooth Handover (Physical Hardware Lag)
*   **Execution:** Follower switches audio output from Phone Speaker to Bluetooth Car Audio mid-song.
*   **Engine Defense:** The adapter experiences a sudden ~400ms physical drift spike. Adaptive Controller should evaluate the slope, potentially Nudge or Hard Seek.
*   **Human Scoring (1-5):**
    *   *Smoothness:* Did the song stutter excessively?
    *   *Continuity:* Did the engine overreact to the Bluetooth handshake?

### Protocol 4: The Hotspot Degradation (Buffering Storm)
*   **Execution:** Follower connects via heavily throttled Hotspot (256kbps). Spotify SDK frequently stutters.
*   **Engine Defense:** Buffering Confidence Lock. Engine should refuse to seek while buffering is resolving.
*   **Human Scoring (1-5):**
    *   *Panic:* Did the app get stuck in a "Seek -> Buffer -> Seek -> Buffer" loop?
    *   *Forgiveness:* Did the system successfully "let it ride" once audio resumed?

---

## 3. Telemetry & Human Perception Scoring

For every test run, we must capture both the machine truth and the human emotional response.

### Machine Telemetry (Logged)
*   `seek_frequency`: Number of Hard Seeks per minute (Target: < 1).
*   `recovery_latency`: Milliseconds between Reconnect and Audio Output.
*   `confidence_collapses`: Number of times trust dropped to `0.0`.

### Human Perception (Surveyed)
*   **Annoyance Threshold:** "At what point did you take off your headphones?"
*   **Broken Illusion:** "Did you feel like you were listening to the same song, or just chasing my song?"
*   **Trust:** "When the music paused, did you trust it was going to fix itself?"
