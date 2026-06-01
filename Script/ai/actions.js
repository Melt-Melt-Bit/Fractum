const { squadData } = require("ai/squad");

function act(ai, unit, mem) {
  switch (mem.goal) {

    case "ATTACK":
      // Use SHARED squad target for focus fire
      const target = squadData.attackTarget;
      if (target && !target.dead) {
        ai.circleAttack(120);
        ai.updateWeapons();
      }
      break;

    case "RESUPPLY":
      const ammo = mem.knownAmmoSources[0];
      if (ammo) ai.moveTo(ammo, 8, 0.1);
      break;

    case "DEFEND":
      const core = Vars.state.teams.cores(unit.team).first();
      if (core) ai.moveTo(core, 0, 0.05);
      break;

    case "RETREAT":
      const safeSpot = Vars.state.teams.cores(unit.team).first();
      if (safeSpot) ai.moveTo(safeSpot, 0, 0.08);
      break;

    case "REBUILD":
      const ruin = mem.knownRuins[0];
      if (ruin) {
        ai.moveTo(ruin, 4, 0.1);
        ai.updateMovement();
      }
      break;

    case "PATROL":
      ai.pathfind(Pathfinder.fieldCore);
      break;
  }

  ai.updateMovement();
  ai.updateVisuals();
}

module.exports = { act };