// ============================================================
// atrum/structureRegistry.js
// Tracks every Atrum-placed structure: level, priority origin,
// destroyed state, and rebuild queue status.
// Rhino JS compatible — no require(), no Date.now()
// ============================================================

var StructureRegistry = (function () {

  // Map of buildingId -> StructureEntry
  // StructureEntry = {
  //   id:          number   (building tile pos packed int)
  //   type:        string   (block name)
  //   priorityOrigin: number (which Priority built this, 1–5)
  //   level:       number   (1–5)
  //   destroyed:   boolean
  //   rebuildQueued: boolean
  //   rebuildCostPaid: boolean
  //   x:           number   (tile x)
  //   y:           number   (tile y)
  // }
  var registry = {};

  // Cost multiplier table per level upgrade
  // Index = current level (1-based), value = multiplier
  var COST_MULTIPLIERS = [0, 1.5, 2.0, 3.0, 4.5, 1.0];

  // ── Register a newly placed structure ──────────────────────
  function register(building, priorityOrigin) {
    var id = _buildingId(building);
    registry[id] = {
      id:               id,
      type:             building.block.name,
      priorityOrigin:   priorityOrigin,
      level:            1,
      destroyed:        false,
      rebuildQueued:    false,
      rebuildCostPaid:  false,
      x:                building.tileX(),
      y:                building.tileY()
    };
    Log.info("[Atrum] Registered structure: " + building.block.name +
             " at (" + building.tileX() + "," + building.tileY() +
             ") for Priority " + priorityOrigin);
  }

  // ── Mark a structure as destroyed ─────────────────────────
  function markDestroyed(building) {
    var id = _buildingId(building);
    var entry = registry[id];
    if (!entry) return;

    entry.destroyed      = true;
    entry.rebuildQueued  = false;
    entry.rebuildCostPaid = false;

    Log.info("[Atrum] Structure destroyed: " + entry.type +
             " at (" + entry.x + "," + entry.y +
             ") was Level " + entry.level);
  }

  // ── Queue a rebuild for a destroyed structure ──────────────
  function queueRebuild(buildingId) {
    var entry = registry[buildingId];
    if (!entry || !entry.destroyed) return;
    entry.rebuildQueued = true;
  }

  // ── Mark rebuild cost as paid, ready to place ─────────────
  function markCostPaid(buildingId) {
    var entry = registry[buildingId];
    if (!entry) return;
    entry.rebuildCostPaid = true;
  }

  // ── Complete a rebuild — increments level, resets state ───
  function completeRebuild(buildingId) {
    var entry = registry[buildingId];
    if (!entry) return;

    // Cap at level 5
    if (entry.level < 5) {
      entry.level += 1;
    }
    entry.destroyed       = false;
    entry.rebuildQueued   = false;
    entry.rebuildCostPaid = false;

    Log.info("[Atrum] Rebuilt: " + entry.type +
             " at (" + entry.x + "," + entry.y +
             ") now Level " + entry.level);
  }

  // ── Get cost multiplier for rebuilding this entry ─────────
  function getRebuildMultiplier(buildingId) {
    var entry = registry[buildingId];
    if (!entry) return 1.0;
    var level = Math.min(entry.level, 5);
    return COST_MULTIPLIERS[level] || 1.0;
  }

  // ── Get all destroyed structures needing rebuild ──────────
  function getPendingRebuilds() {
    var pending = [];
    for (var id in registry) {
      var e = registry[id];
      if (e.destroyed && !e.rebuildQueued) {
        pending.push(e);
      }
    }
    return pending;
  }

  // ── Get all structures from a given Priority ───────────────
  function getByPriority(priorityId) {
    var result = [];
    for (var id in registry) {
      if (registry[id].priorityOrigin === priorityId) {
        result.push(registry[id]);
      }
    }
    return result;
  }

  // ── Check if all structures of a Priority are at least level N
  function allAtLevel(priorityId, minLevel) {
    var structures = getByPriority(priorityId);
    if (structures.length === 0) return false;
    for (var i = 0; i < structures.length; i++) {
      if (structures[i].level < minLevel || structures[i].destroyed) {
        return false;
      }
    }
    return true;
  }

  // ── Get entry by id ───────────────────────────────────────
  function get(buildingId) {
    return registry[buildingId] || null;
  }

  // ── Get full registry snapshot (for debug) ────────────────
  function dump() {
    return registry;
  }

  // ── Internal: stable ID from building ────────────────────
  function _buildingId(building) {
    return building.tileX() + "_" + building.tileY();
  }

  return {
    register:             register,
    markDestroyed:        markDestroyed,
    queueRebuild:         queueRebuild,
    markCostPaid:         markCostPaid,
    completeRebuild:      completeRebuild,
    getRebuildMultiplier: getRebuildMultiplier,
    getPendingRebuilds:   getPendingRebuilds,
    getByPriority:        getByPriority,
    allAtLevel:           allAtLevel,
    get:                  get,
    dump:                 dump
  };

})();
