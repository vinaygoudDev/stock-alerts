// Tracks which conditions have already fired so we don't spam.
// A condition re-arms once it's no longer true (price moves back past threshold).

const fs   = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'state.json');

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return {}; }
}

function save(state) {
  fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
}

// Returns true if alert should fire; updates state accordingly
function shouldFire(conditionId, isTriggered) {
  const state = load();
  const wasTriggered = !!state[conditionId];

  if (isTriggered && !wasTriggered) {
    state[conditionId] = { firedAt: new Date().toISOString() };
    save(state);
    return true;
  }

  // Re-arm: condition is no longer true, clear the fired flag
  if (!isTriggered && wasTriggered) {
    delete state[conditionId];
    save(state);
  }

  return false;
}

module.exports = { shouldFire };
