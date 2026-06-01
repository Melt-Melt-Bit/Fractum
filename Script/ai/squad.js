// Global shared memory all units can read/write
const squadData = {
  knownEnemies:     [],   // enemies any unit has seen
  knownAmmoSources: [],   // ammo buildings any unit found
  knownRuins:       [],   // ruins any unit spotted
  attackTarget:     null, // current focus target for all units
  alarmLevel:       0,    // 0 = calm, 1 = alert, 2 = emergency
  unitRoles:        new Map(), // unitId -> role
};

// Roles units can be assigned
const ROLES = {
  ATTACKER:  "ATTACKER",
  DEFENDER:  "DEFENDER",
  SUPPLIER:  "SUPPLIER",
  REBUILDER: "REBUILDER",
};

// Called by each unit to broadcast what it sees
function broadcast(unitId, scanData) {
  const now = Date.now();

  // Share enemies
  scanData.enemies.forEach(e => {
    if (!squadData.knownEnemies.find(x => x.id === e.id)) {
      squadData.knownEnemies.push({ id: e.id, ref: e, seenAt: now });
    }
  });

  // Share ammo sources
  scanData.ammoSources.forEach(b => {
    if (!squadData.knownAmmoSources.find(x => x.id === b.id)) {
      squadData.knownAmmoSources.push({ id: b.id, ref: b, seenAt: now });
    }
  });

  // Share ruins
  scanData.ruins.forEach(r => {
    if (!squadData.knownRuins.find(x => x.id === r.id)) {
      squadData.knownRuins.push({ id: r.id, ref: r });
    }
  });

  // Forget old enemies after 8 seconds
  squadData.knownEnemies = squadData.knownEnemies.filter(
    e => now - e.seenAt < 8000
  );

  // Update alarm level based on threat count
  const threatCount = squadData.knownEnemies.length;
  if (threatCount === 0)      squadData.alarmLevel = 0;
  else if (threatCount < 5)   squadData.alarmLevel = 1;
  else                        squadData.alarmLevel = 2;

  // Set a shared attack target (focus fire)
  if (squadData.knownEnemies.length > 0) {
    squadData.attackTarget = squadData.knownEnemies[0].ref;
  } else {
    squadData.attackTarget = null;
  }
}

// Assign roles based on squad needs
function assignRole(unit, mem) {
  const totalUnits    = Groups.unit.count(
    u => u.team === unit.team
  );
  const attackers     = countRole(ROLES.ATTACKER);
  const defenders     = countRole(ROLES.DEFENDER);
  const suppliers     = countRole(ROLES.SUPPLIER);
  const rebuilders    = countRole(ROLES.REBUILDER);

  let role;

  // Balance squad composition dynamically
  if (defenders < Math.floor(totalUnits * 0.2)) {
    role = ROLES.DEFENDER;           // 20% defend core
  } else if (suppliers < Math.floor(totalUnits * 0.15)) {
    role = ROLES.SUPPLIER;           // 15% fetch ammo
  } else if (
    squadData.knownRuins.length > 0 &&
    rebuilders < Math.floor(totalUnits * 0.1)
  ) {
    role = ROLES.REBUILDER;          // 10% rebuild
  } else {
    role = ROLES.ATTACKER;           // rest attack
  }

  squadData.unitRoles.set(unit.id, role);
  return role;
}

function countRole(role) {
  let count = 0;
  squadData.unitRoles.forEach(r => { if (r === role) count++; });
  return count;
}

// Get this unit's current role
function getRole(unitId) {
  return squadData.unitRoles.get(unitId) || ROLES.ATTACKER;
}

// Clean up dead units from squad
function cleanupUnit(unitId) {
  squadData.unitRoles.delete(unitId);
}

module.exports = {
  squadData, ROLES,
  broadcast, assignRole, getRole, cleanupUnit
};