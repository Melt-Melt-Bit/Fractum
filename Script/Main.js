// ============================================================
// main.js
// Entry point for the Theralis mod + Atrum escalation system.
// Load order (in your mod's scripts/):
//   1. atrum/structureRegistry.js
//   2. atrum/rebuildQueue.js
//   3. atrum/threatMonitor.js
//   4. atrum/prioritySequencer.js
//   5. main.js  ← this file
// ============================================================

// ── Assign Fractum AI to player-team units ─────────────────
Events.on(EventType.UnitSpawnEvent, function (e) {
  var unit = e.unit;
  if (unit.team !== Vars.state.rules.defaultTeam) return;
  unit.controller(new FractumAI());
});

// ── Load Atrum priority data from JSON ────────────────────
var priorityJson = (function () {
  try {
    var file = Vars.mods.getMod("theralis").root.child(
      "data/priorities.json"
    );
    return JSON.parse(file.readString());
  } catch (e) {
    Log.err("[Atrum] Failed to load priorities.json: " + e);
    return { priorities: [], siegeMode: {} };
  }
})();

// ── Boot escalation system on world load ──────────────────
// NOTE: Planet guard is disabled for Serpulo testing.
// When ready for Theralis-only, uncomment the guard line.
Events.on(EventType.WorldLoadEvent, function () {

  // Uncomment when testing on Theralis only:
  //ingat buat uncomment, biar ga jalan di planet lain, biar aman
  // if (Vars.state.planet.name !== "theralis") return;

  var atrumTeam = Team.get(7); // adjust team id as needed

  var atrumCore = null;
  Groups.build.each(function (b) {
    if (b.team === atrumTeam && b.block.name === "atrum-core") {
      atrumCore = b;
    }
  });

  if (!atrumCore) {
    Log.warn("[Atrum] No atrum-core found on world load. " +
             "Escalation system not started.");
    return;
  }

  Log.info("[Atrum] World loaded. Booting escalation system.");
  PrioritySequencer.init(atrumTeam, atrumCore, priorityJson);
});

// ── Main update loop ──────────────────────────────────────
Events.on(EventType.Trigger.update, function () {
  if (!Vars.state.isGame()) return;
  PrioritySequencer.update();
});

// ── Debug command ─────────────────────────────────────────
// Type /atrum-status in-game chat to see current state
// Remove before release
Events.on(EventType.PlayerChatEvent, function (e) {
  if (e.message !== "/atrum-status") return;
  var p = e.player;
  if (!p) return;

  var priority = PrioritySequencer.getCurrentPriority();
  var siege    = PrioritySequencer.isSiegeMode();
  var paused   = PrioritySequencer.isPaused();
  var qSize    = RebuildQueue.size();

  p.sendMessage(
    "[cyan]── Atrum Status ──[]\n" +
    "Priority: [yellow]" + (siege ? "SIEGE MODE" : priority) + "[]\n" +
    "Paused:   [red]"    + paused  + "[]\n" +
    "Rebuild queue: [orange]" + qSize + "[] pending"
  );
});