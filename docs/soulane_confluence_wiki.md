# Confluence | Soulane Testing Department

**Space:** Soulane Product Delivery  
**Owner:** `barka@` (Unified QA Team)  
**Status:** 🛠 IN PROGRESS (Phase 5: Product Realization)

---

## 1. Executive Summary
This document outlines the multi-tiered testing strategy for **Soulane**. Our goal is to ensure millisecond-perfect synchronization across mobile and web platforms while maintaining a premium emotional user experience.

---

## 2. Testing Roles & Responsibilities

| Role | Responsibility |
| :--- | :--- |
| **Test Manager** | Strategic alignment, risk management, and production go/no-go. |
| **QA Lead** | Infrastructure setup (CI/CD integration) and sprint planning. |
| **Sr. Software Tester** | Complex automation (Sync Engine drift tests, Chaos testing). |
| **Jr. Software Tester** | Manual UI validation, regression testing, and bug reporting. |

---

## 3. Tooling & Extensions (Installation Guide)

### **3.1 API & Backend Testing**
- **Tool:** Jest + Supertest
- **Scope:** REST Endpoints (Spotify Proxy, Room Manager).
- **Extension:** `Rest Client` (VS Code) for rapid manual API probing.

### **3.2 Automation & E2E**
- **Tool:** Playwright (Web) + Detox (Mobile)
- **Scope:** Cross-platform lane joining flows.
- **Extension:** `Playwright Test` (VS Code) for visual debugging.

### **3.3 Performance & Load**
- **Tool:** **k6**
- **Scope:** 1,000+ concurrent listeners in a single Lane.
- **Metric:** Socket.IO broadcast latency < 100ms.

### **3.4 A/B Testing & Product**
- **Tool:** **Soulane Feature Flags** (Custom Config)
- **Experiments:** 
    - `Exp-01`: "Wave" vs "Lane" UI naming.
    - `Exp-02`: 500ms vs 250ms Sync Tick interval.

---

## 4. Automated Test Suite (Master Checklist)

### **Unit Testing (Packages/sync-core)**
- [ ] `drift.calc.test.ts`: Verify math for Nudge Rate logic.
- [ ] `adapter.queue.test.ts`: Ensure commands don't overlap.

### **Integration Testing (Apps/server)**
- [ ] `room.lifecycle.test.ts`: Create → Join → Leave flow.
- [ ] `spotify.proxy.test.ts`: Verify token exchange and search.

### **E2E Testing (Cross-Platform)**
- [ ] `sync.handshake.spec.ts`: Verify sub-200ms alignment on boot.
- [ ] `chaos.recovery.spec.ts`: Simulate WiFi drop during playback.

---

## 5. Manual Empirical Tests (Human-Centric)

### **"The Echo Test"**
- **Step 1:** Two testers in a physical room, 1 meter apart.
- **Step 2:** Play a drum-heavy track.
- **Step 3:** Score 1-10 on perceived echo (Target: > 9.0).

### **"The Emotional Sync Score"**
- **Step 1:** Couple listens to a playlist for 30 minutes in separate rooms.
- **Step 2:** Qualitative survey on "Shared Feeling".

---

## 6. Performance Benchmarks

| Environment | Concurrent Users | Sync Latency | Status |
| :--- | :--- | :--- | :--- |
| **Local** | 10 | 12ms | 🟢 |
| **Staging** | 100 | 45ms | 🟢 |
| **Production** | 1,000 (Target) | < 100ms | 🟡 |

---

**Next Action:** Initialize the Playwright and k6 testing directories.
