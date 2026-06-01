// Each unit gets its own memory object
function createMemory() {
  return {
    knownAmmoSources: [],   // buildings seen with ammo
    knownEnemies: [],       // enemies spotted
    knownRuins: [],         // destroyed buildings to rebuild
    lastThreatPos: null,    // where danger was last seen
    currentGoal: null,      // what the unit is doing now
    idleTicks: 0,           // how long unit has been idle
  };
}

// Update memory with newly scanned data
function updateMemory(memory, scanData) {
  // Merge new ammo sources, avoid duplicates
  scanData.ammoSources.forEach(b => {
    if (!memory.knownAmmoSources.find(x => x.id === b.id)) {
      memory.knownAmmoSources.push({ id: b.id, pos: b, lastSeen: Date.now() });
    }
  });

  // Forget old entries after 10 seconds (simulates human forgetting)
  const now = Date.now();
  memory.knownAmmoSources = memory.knownAmmoSources.filter(
    x => now - x.lastSeen < 10000
  );

  // Update enemies
  memory.knownEnemies = scanData.enemies;

  // Track ruins for rebuilding
  scanData.ruins.forEach(r => {
    if (!memory.knownRuins.find(x => x.id === r.id)) {
      memory.knownRuins.push(r);
    }
  });
}