// ============================================================
// atrum/prioritySequencer.js
// The strategic brain of Atrum. Manages Priority progression,
// pauses on threat, checks transition conditions, triggers
// Siege Mode. Depends on: StructureRegistry, ThreatMonitor,
// RebuildQueue.
// Rhino JS compatible.
// ============================================================

var PrioritySequencer = (function () {

  // ── State ─────────────────────────────────────────────────
  var state = {
    currentPriority:    0,      // 0 = pre-start, 1–5 = active, 6 = siege
    paused:             false,  // true when threat is active
    siegeMode:          false,
    buildProgress:      {},     // tracks completion of current build list
    constructionQueue:  [],     // ordered list of structures to place
    tickLastAdvance:    -1,     // tick when last priority advanced
  };

  // Tick interval for sequencer update
  var UPDATE_INTERVAL = 60; // every second

  // ── Atrum team reference (set on init) ────────────────────
  var atrumTeam = null;
  var atrumCore = null;

  // ── Priority data loaded from JSON ────────────────────────
  // In Rhino JS, JSON is loaded via Vars or passed in at init
  var priorityData = null;

  // ── Init ──────────────────────────────────────────────────
  function init(team, core, jsonData) {
    atrumTeam    = team;
    atrumCore    = core;
    priorityData = jsonData.priorities;

    // Register destroy listener
    Events.on(EventType.BuildingDestroyEvent, function (e) {
      ThreatMonitor.onBuildingDestroyed(e.build, atrumTeam);
    });

    Log.info("[Atrum|Sequencer] Initialized. Starting Priority 1.");
    _advanceTo(1);
  }

  // ── Main update — called every tick from main script ──────
  function update() {
    if (Vars.state.tick % UPDATE_INTERVAL !== 0) return;
    if (state.siegeMode) {
      _updateSiege();
      return;
    }

    // Update subsystems
    ThreatMonitor.update(atrumTeam);
    RebuildQueue.update(atrumCore);

    // Pause current Priority work if threat is active
    if (ThreatMonitor.isThreatActive()) {
      if (!state.paused) {
        state.paused = true;
        Log.info("[Atrum|Sequencer] Priority " +
                 state.currentPriority + " PAUSED — threat active");
      }
      // Still process ready rebuilds even while paused
      _processRebuildQueue();
      return;
    }

    // Resume if we were paused
    if (state.paused) {
      state.paused = false;
      Log.info("[Atrum|Sequencer] Priority " +
               state.currentPriority + " RESUMED");
    }

    // Process ready rebuilds
    _processRebuildQueue();

    // Work on current Priority construction
    _processConstructionQueue();

    // Check if current Priority is done
    if (_checkTransitionCondition()) {
      var next = state.currentPriority + 1;
      if (next > 5) {
        _enterSiegeMode();
      } else {
        _advanceTo(next);
      }
    }
  }

  // ── Advance to a new Priority ─────────────────────────────
  function _advanceTo(priorityId) {
    state.currentPriority  = priorityId;
    state.buildProgress    = {};
    state.constructionQueue = [];
    state.tickLastAdvance  = Vars.state.tick;

    var pData = _getPriorityData(priorityId);
    if (!pData) return;

    // Populate construction queue from build list
    pData.buildList.forEach(function (item) {
      state.constructionQueue.push({
        type:      item.type,
        target:    item.target,
        count:     item.count,
        placed:    0,
        complete:  false
      });
    });

    Log.info("[Atrum|Sequencer] ── PRIORITY " + priorityId +
             ": " + pData.name + " ──");
  }

  // ── Process the construction queue for current Priority ───
  function _processConstructionQueue() {
    for (var i = 0; i < state.constructionQueue.length; i++) {
      var item = state.constructionQueue[i];
      if (item.complete) continue;

      // Attempt to place next structure of this type
      var placed = _tryPlace(item);
      if (placed) {
        item.placed++;
        // count == -1 means "as many as needed" (conveyors etc)
        if (item.count !== -1 && item.placed >= item.count) {
          item.complete = true;
          Log.info("[Atrum|Sequencer] Build complete: " +
                   item.type + " (" + item.placed + " placed)");
        }
      }

      // Only attempt one placement per update cycle
      // to simulate realistic construction pacing
      break;
    }
  }

  // ── Process funded rebuilds from the rebuild queue ────────
  function _processRebuildQueue() {
    var ready = RebuildQueue.getReady();
    for (var i = 0; i < ready.length; i++) {
      var item = ready[i];
      var success = _placeAt(item.type, item.x, item.y, item.targetLevel);
      if (success) {
        StructureRegistry.completeRebuild(item.entryId);
        RebuildQueue.dequeue(item.entryId);
        Log.info("[Atrum|Sequencer] Rebuild complete: " +
                 item.type + " at Level " + item.targetLevel);
      }
    }
  }

  // ── Try to place a structure for the current Priority ─────
  // Returns true if placement succeeded
  function _tryPlace(queueItem) {
    // Resolve target tile based on target label
    var tile = _resolveTarget(queueItem.target, queueItem.type);
    if (!tile) return false;

    return _placeAt(queueItem.type, tile.x, tile.y, 1);
  }

  // ── Actually place a structure at tile coords ─────────────
  function _placeAt(blockName, tx, ty, level) {
    var block = Vars.content.block(blockName);
    if (!block) {
      Log.warn("[Atrum|Sequencer] Unknown block: " + blockName);
      return false;
    }

    var tile = Vars.world.tile(tx, ty);
    if (!tile) return false;

    // Place the building on the Atrum team
    Call.placeBlock(tx, ty, block, 0, atrumTeam);

    // Register in structure registry
    var placed = tile.build;
    if (placed) {
      StructureRegistry.register(placed, state.currentPriority);
      // If level > 1, apply level upgrade metadata
      if (level > 1) {
        placed.level = level; // custom field — requires block to support
      }
    }

    return true;
  }

  // ── Check if current Priority's transition condition is met
  function _checkTransitionCondition() {
    var pData = _getPriorityData(state.currentPriority);
    if (!pData) return false;

    var condition = pData.transitionCondition;

    switch (condition) {

      case "allDrillsActive":
        return _allBuildingsOfTypeActive("atrum-drill", state.currentPriority);

      case "perimeterSealed":
        return _constructionQueueComplete() &&
               _allBuildingsOfTypeActive("atrum-turret", state.currentPriority);

      case "factoryOperational":
        return _allBuildingsOfTypeActive("atrum-factory", state.currentPriority);

      case "allStructuresLevel2":
        // Priority 4: all P1+P2 structures upgraded to level 2
        return StructureRegistry.allAtLevel(1, 2) &&
               StructureRegistry.allAtLevel(2, 2);

      case "allOutpostsEstablished":
        return _allBuildingsOfTypeActive("atrum-outpost", state.currentPriority);

      default:
        return _constructionQueueComplete();
    }
  }

  // ── Enter Siege Mode ──────────────────────────────────────
  function _enterSiegeMode() {
    state.siegeMode = true;
    Log.info("[Atrum|Sequencer] ══ SIEGE MODE ACTIVATED ══");

    // Overclock vent reactor if present
    Groups.build.each(function (b) {
      if (b.team === atrumTeam && b.block.name === "atrum-vent-reactor") {
        b.timeScale = 2.5; // overclock
        Log.info("[Atrum|Sequencer] Vent reactor overclocked");
      }
    });
  }

  // ── Siege Mode update ─────────────────────────────────────
  function _updateSiege() {
    // Rebuild queue still runs in siege mode (faster)
    RebuildQueue.update(atrumCore);
    _processRebuildQueue();
    // Wave spawning is handled externally by the wave controller
  }

  // ── Helpers ───────────────────────────────────────────────

  function _getPriorityData(id) {
    for (var i = 0; i < priorityData.length; i++) {
      if (priorityData[i].id === id) return priorityData[i];
    }
    return null;
  }

  function _constructionQueueComplete() {
    for (var i = 0; i < state.constructionQueue.length; i++) {
      var item = state.constructionQueue[i];
      if (item.count !== -1 && !item.complete) return false;
    }
    return true;
  }

  function _allBuildingsOfTypeActive(blockName, priorityId) {
    var entries = StructureRegistry.getByPriority(priorityId);
    var found   = 0;
    var alive   = 0;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].type === blockName) {
        found++;
        if (!entries[i].destroyed) alive++;
      }
    }
    return found > 0 && alive === found;
  }

  // Stub — replace with your map layout logic
  // Returns {x, y} tile coords for a named build target
  function _resolveTarget(targetLabel, blockType) {
    // TODO: wire to your sector map data
    // Example: look up pre-defined node positions from a map config
    Log.warn("[Atrum|Sequencer] _resolveTarget not implemented: " +
             targetLabel);
    return null;
  }

  // ── Public API ────────────────────────────────────────────
  function getCurrentPriority() { return state.currentPriority; }
  function isSiegeMode()        { return state.siegeMode; }
  function isPaused()           { return state.paused; }

  return {
    init:               init,
    update:             update,
    getCurrentPriority: getCurrentPriority,
    isSiegeMode:        isSiegeMode,
    isPaused:           isPaused
  };

})();
