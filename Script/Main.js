const { FractumAI } = require("ai/brain");
Events.on(EventType.UnitSpawnEvent, (e) => {
  const unit = e.unit;
  if (unit.team !== Vars.state.rules.defaultTeam) return;
  unit.controller(new FractumAI());
});