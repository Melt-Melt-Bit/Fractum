const { createMemory, updateMemory } = require("ai/memory");
const { scanEnvironment }            = require("ai/scanner");
const { evaluatePriorities }         = require("ai/priority");
const { executeAction }              = require("ai/actions");
const {
  broadcast, assignRole,
  getRole, cleanupUnit, squadData
} = require("ai/squad");

const unitMemories = new Map();

const FractumAI = extend(BuilderAI, {
  updateUnit() {
    const unit = this.unit;

    if (!unitMemories.has(unit.id)) {
      unitMemories.set(unit.id, createMemory());
    }

    const mem = unitMemories.get(unit.id);

    if (Vars.state.tick % 10 === 0) {
      // 1. Scan environment
      const scanData = scanEnvironment(unit);

      // 2. Update own memory
      updateMemory(mem, scanData);

      // 3. Broadcast to squad (share what you see)
      broadcast(unit.id, scanData);

      // 4. Merge squad knowledge into own memory
      mem.knownEnemies     = squadData.knownEnemies.map(e => e.ref);
      mem.knownAmmoSources = squadData.knownAmmoSources.map(b => b.ref);
      mem.knownRuins       = squadData.knownRuins.map(r => r.ref);

      // 5. Get assigned role
      const role = assignRole(unit, mem);

      // 6. Decide based on role + situation
      mem.goal = decideByRole(unit, mem, role);
    }

    // 7. Act every tick
    act(this, unit, mem);

    if (unit.dead) {
      cleanupUnit(unit.id);
      unitMemories.delete(unit.id);
    }
  }
});

module.exports = { FractumAI };