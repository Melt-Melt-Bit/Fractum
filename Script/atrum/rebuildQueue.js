// ============================================================
// atrum/rebuildQueue.js
// Manages the rebuild queue for destroyed Atrum structures.
// Atrum saves resources first, THEN rebuilds at Level+1.
// Rhino JS compatible.
// ============================================================

var RebuildQueue = (function () {

  // Queue entry = {
  //   entryId:    string  (registry id "x_y")
  //   type:       string  (block name)
  //   x:          number
  //   y:          number
  //   targetLevel: number (current level + 1, capped at 5)
  //   costMult:   number  (rebuild cost multiplier)
  //   resourcesReady: boolean
  //   tickQueued: number  (game tick when queued)
  // }
  var queue = [];

  // How often (in ticks) to check if resources are ready
  var CHECK_INTERVAL = 120; // every 2 seconds at 60tps

  // ── Add a destroyed structure to the rebuild queue ────────
  function enqueue(registryEntry, costMultiplier) {
    // Avoid duplicates
    for (var i = 0; i < queue.length; i++) {
      if (queue[i].entryId === registryEntry.id) return;
    }

    var targetLevel = Math.min(registryEntry.level + 1, 5);

    queue.push({
      entryId:        registryEntry.id,
      type:           registryEntry.type,
      x:              registryEntry.x,
      y:              registryEntry.y,
      targetLevel:    targetLevel,
      costMult:       costMultiplier,
      resourcesReady: false,
      tickQueued:     Vars.state.tick
    });

    Log.info("[Atrum|RebuildQueue] Enqueued: " + registryEntry.type +
             " at (" + registryEntry.x + "," + registryEntry.y +
             ") → Level " + targetLevel +
             " (cost x" + costMultiplier + ")");
  }

  // ── Called every CHECK_INTERVAL ticks ─────────────────────
  // Checks Atrum's resource reserves and marks entries ready
  function update(atrumCore) {
    if (Vars.state.tick % CHECK_INTERVAL !== 0) return;
    if (!atrumCore || atrumCore.dead) return;

    for (var i = 0; i < queue.length; i++) {
      var item = queue[i];
      if (item.resourcesReady) continue;

      // Check if core has enough resources for this rebuild
      if (_canAffordRebuild(atrumCore, item)) {
        item.resourcesReady = true;
        Log.info("[Atrum|RebuildQueue] Resources ready for: " +
                 item.type + " at (" + item.x + "," + item.y + ")");
      }
    }
  }

  // ── Get all items that are funded and ready to place ──────
  function getReady() {
    var ready = [];
    for (var i = 0; i < queue.length; i++) {
      if (queue[i].resourcesReady) {
        ready.push(queue[i]);
      }
    }
    return ready;
  }

  // ── Remove an item from the queue after rebuild completes ─
  function dequeue(entryId) {
    for (var i = 0; i < queue.length; i++) {
      if (queue[i].entryId === entryId) {
        queue.splice(i, 1);
        Log.info("[Atrum|RebuildQueue] Dequeued: " + entryId);
        return;
      }
    }
  }

  // ── Get current queue length (for debug/tuning) ───────────
  function size() {
    return queue.length;
  }

  // ── Peek at queue (for debug) ─────────────────────────────
  function dump() {
    return queue;
  }

  // ── Internal: resource check against Atrum core ──────────
  // Base costs are placeholder — tune to your resource amounts
  var BASE_COSTS = {
    "atrum-drill":        { "ferrite": 40,  "basalt": 20  },
    "atrum-wall":         { "basalt":  30,  "saltite": 15 },
    "atrum-turret":       { "ferrite": 60,  "saltite": 30 },
    "atrum-mender":       { "ferrite": 50,  "basalt":  25 },
    "atrum-factory":      { "ferrite": 120, "saltite": 80 },
    "atrum-junction":     { "basalt":  20                  },
    "atrum-conveyor":     { "basalt":  10                  },
    "atrum-outpost":      { "ferrite": 80,  "basalt":  60 },
    "atrum-vent-reactor": { "ferrite": 200, "sulfurite": 100 }
  };

  function _canAffordRebuild(core, item) {
    var baseCost = BASE_COSTS[item.type];
    if (!baseCost) return true; // unknown type, allow

    for (var resource in baseCost) {
      var required = Math.ceil(baseCost[resource] * item.costMult);
      var available = core.items.get(
        Items.getByName(resource)
      );
      if (available < required) return false;
    }
    return true;
  }

  return {
    enqueue:   enqueue,
    update:    update,
    getReady:  getReady,
    dequeue:   dequeue,
    size:      size,
    dump:      dump
  };

})();
