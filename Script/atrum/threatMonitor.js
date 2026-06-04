// ============================================================
// atrum/threatMonitor.js
// Detects player threats against Atrum structures.
// Triggers Priority pause and rebuild queue population.
// Rhino JS compatible.
// ============================================================

var ThreatMonitor = (function () {

  // Threat state
  var state = {
    active:           false,   // is Atrum currently responding to a threat?
    threatenedIds:    [],      // registry ids currently under threat
    lastThreatTick:   -1,      // tick when last threat was detected
    cooldownTicks:    300,     // ticks after last threat before resuming (5s)
  };

  // HP threshold — structure is "threatened" if below this fraction
  var THREAT_HP_THRESHOLD = 0.6;

  // Scan interval in ticks
  var SCAN_INTERVAL = 30;

  // ── Called every tick from the main escalation loop ───────
  function update(atrumTeam) {
    if (Vars.state.tick % SCAN_INTERVAL !== 0) return;

    var threatened = [];

    // Scan all Atrum buildings for damage
    Groups.build.each(function (building) {
      if (building.team !== atrumTeam) return;
      if (building.dead) return;

      var hpFraction = building.health / building.maxHealth;
      if (hpFraction < THREAT_HP_THRESHOLD) {
        var id = building.tileX() + "_" + building.tileY();
        threatened.push(id);
      }
    });

    if (threatened.length > 0) {
      // New threats detected
      state.active        = true;
      state.lastThreatTick = Vars.state.tick;

      // Add newly threatened ids (avoid duplicates)
      threatened.forEach(function (id) {
        if (state.threatenedIds.indexOf(id) === -1) {
          state.threatenedIds.push(id);
          Log.info("[Atrum|Threat] Structure threatened: " + id);
        }
      });

    } else {
      // No current threats — check cooldown
      if (state.active) {
        var elapsed = Vars.state.tick - state.lastThreatTick;
        if (elapsed >= state.cooldownTicks) {
          _clearThreat();
        }
      }
    }
  }

  // ── Called by event listener when a building is destroyed ─
  function onBuildingDestroyed(building, atrumTeam) {
    if (building.team !== atrumTeam) return;

    var id = building.tileX() + "_" + building.tileY();

    // Mark as threatened (destroyed counts as max threat)
    if (state.threatenedIds.indexOf(id) === -1) {
      state.threatenedIds.push(id);
    }
    state.active         = true;
    state.lastThreatTick = Vars.state.tick;

    Log.info("[Atrum|Threat] Structure destroyed — threat active: " + id);

    // Notify registry and queue rebuild
    var entry = StructureRegistry.get(id);
    if (entry) {
      StructureRegistry.markDestroyed(building);
      var costMult = StructureRegistry.getRebuildMultiplier(id);
      RebuildQueue.enqueue(entry, costMult);
      StructureRegistry.queueRebuild(id);
    }
  }

  // ── Is a threat currently active? ─────────────────────────
  // Used by the Priority Sequencer to pause current work
  function isThreatActive() {
    return state.active;
  }

  // ── Get list of currently threatened structure ids ────────
  function getThreatenedIds() {
    return state.threatenedIds;
  }

  // ── Internal: reset threat state ─────────────────────────
  function _clearThreat() {
    state.active        = false;
    state.threatenedIds = [];
    Log.info("[Atrum|Threat] Threat cleared — resuming Priority");
  }

  return {
    update:               update,
    onBuildingDestroyed:  onBuildingDestroyed,
    isThreatActive:       isThreatActive,
    getThreatenedIds:     getThreatenedIds
  };

})();
