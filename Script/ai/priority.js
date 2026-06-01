const { ROLES, squadData } = require("ai/squad");

function decideByRole(unit, mem, role) {
  const health  = unit.health / unit.maxHealth;
  const hasAmmo = unit.ammo > unit.type.ammoCapacity * 0.2;
  const core    = Vars.state.teams.cores(unit.team).first();

  // Emergency overrides regardless of role
  if (health < 0.2) return "RETREAT";
  if (!hasAmmo)     return "RESUPPLY";

  // Role-based behavior
  switch (role) {
    case ROLES.ATTACKER:
      // Focus fire the squad's shared target
      return squadData.attackTarget ? "ATTACK" : "PATROL";

    case ROLES.DEFENDER:
      return "DEFEND";

    case ROLES.SUPPLIER:
      // Fetch ammo then bring it back
      return hasAmmo ? "RESUPPLY" : "DEFEND";

    case ROLES.REBUILDER:
      return mem.knownRuins.length > 0 ? "REBUILD" : "PATROL";

    default:
      return "PATROL";
  }
}

module.exports = { decideByRole };