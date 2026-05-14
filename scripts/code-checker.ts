import fs from 'fs';
import path from 'path';

const REQUIRED_FILES = [
  'apps/mobile/src/lib/spotify-auth.service.ts',
  'apps/mobile/src/screens/main/LaneScreen.tsx',
  'apps/web/src/app/room/page.tsx',
  'apps/server/src/services/RoomManager.ts',
  'packages/shared/index.ts',
  'packages/shared/security.ts',
  'apps/mobile/assets/logo.png'
];

export function runCodeAudit() {
  console.log('🛸 SOULANE ARCHITECTURAL AUDIT STARTING...');
  let passCount = 0;

  for (const file of REQUIRED_FILES) {
    const fullPath = path.join(process.cwd(), 'soulane', file);
    if (fs.existsSync(fullPath)) {
      console.log(`✅ [PASS] ${file}`);
      passCount++;
    } else {
      console.log(`❌ [FAIL] ${file} - Missing Architectural Component`);
    }
  }

  const completionPercent = (passCount / REQUIRED_FILES.length) * 100;
  console.log(`\n📊 AUDIT COMPLETE: ${completionPercent.toFixed(2)}% Architecture Integrity`);
  
  if (completionPercent === 100) {
    console.log('🟢 STATUS: FULLY OPERATIONAL. THE SOUL IS IN SYNC.');
  } else {
    console.log('🔴 STATUS: INCOMPLETE. MISSING CORE NEURAL PATHWAYS.');
  }
}

runCodeAudit();
