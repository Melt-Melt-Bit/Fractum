const { Vars, Timer, Groups } = require("mindustry");

Events.on(EventType.UnitUpdateEvent, (e) => {
  const unit = e.unit;
  // Your AI logic goes here
});
function getClosestAmmoSource(unit) {
  let closest = null;
  let minDist = Infinity;

  Groups.build.each((building) => {
    // Check if building produces ammo
    if (building.block.hasItems) {
      let dist = unit.dst(building);
      if (dist < minDist) {
        minDist = dist;
        closest = building;
      }
    }
  });

  return closest;
}