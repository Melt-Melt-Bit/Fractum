function scan(unit, mem) {
  const RANGE = 30 * 8; // 30 tiles in world units

  mem.knownAmmoSources = [];
  mem.knownEnemies     = [];
  mem.knownRuins       = [];

  // Scan buildings using real Mindustry Groups
  Groups.build.each(b => {
    if (unit.dst(b) > RANGE) return;

    if (b.team === unit.team) {
      if (!b.dead && b.block.hasItems) {
        mem.knownAmmoSources.push(b);
      }
      // Detect destroyed friendly buildings for rebuild
      if (b.dead) {
        mem.knownRuins.push(b);
      }
    }
  });

  // Scan enemy units
  Groups.unit.each(u => {
    if (u.team !== unit.team && unit.dst(u) <= RANGE) {
      mem.knownEnemies.push(u);
    }
  });
}