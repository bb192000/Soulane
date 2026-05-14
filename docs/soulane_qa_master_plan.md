# 🧪 SOULANE | Phase 1 QA Master Plan

This document serves as our **Confluence-style Wiki** for all production validation assets.

---

## 🛠️ 1. Functional Test Scenarios (Flow Validation)

### [SLN-TS-001] Successful Spotify Login
- **Steps:** Open app -> Tap Login -> Complete OAuth -> Return.
- **Expected:** Session created, redirected home, token stored in SecureStore.

### [SLN-TS-002] OAuth Cancel
- **Steps:** Start login -> Cancel OAuth midway.
- **Expected:** No crash, graceful return to Landing, error message shown.

### [SLN-TS-003] Network Loss During Auth
- **Steps:** Start login -> Disable internet during callback.
- **Expected:** Graceful retry, no infinite loading, no corrupted session.

---

## 📱 2. Mobile Lifecycle & Chaos Matrix

### [SLN-LIFE-001] App Kill Recovery
- **Steps:** Login -> Kill app -> Reopen.
- **Expected:** Session restored automatically from SecureStore.

### [SLN-LIFE-002] Background Suspension
- **Steps:** Join lane -> Lock device (60s) -> Unlock.
- **Expected:** Smooth sync recovery, no "correction storm".

### [SLN-CHAOS-001] LTE Transition
- **Steps:** Active play on WiFi -> Switch to LTE.
- **Expected:** Connection continuity, confidence decay handling.

### [SLN-CHAOS-002] Bluetooth Handover
- **Steps:** Active play -> Unpair headphones.
- **Expected:** Drift adaptation, pause handling, smoothness preserved.

---

## 🔐 3. Security & Resilience

### [SLN-SEC-001] Secure Token Storage
- **Validate:** Tokens present in `expo-secure-store`, not in `console.log`.

### [SLN-SEC-002] Invalid Session Replay
- **Validate:** Rejection of stale/expired tokens.

---

## 🐛 4. Bug Classification System

| Priority | Definition | Example |
| :--- | :--- | :--- |
| **CRITICAL** | Breaks shared listening illusion | Permanent desync, correction storm |
| **HIGH** | Trust damaged | Violent seek, reconnect failure |
| **MEDIUM** | Noticeable but tolerable | Brief drift, delayed recovery |
| **LOW** | Technical issue / Minor UI | Telemetry mismatch, glitch |

---

### **Exit Condition: Phase 1**
Phase 1 is complete ONLY when:
1. All **Critical** and **High** tests pass.
2. Emotional continuity scoring is > 90%.
