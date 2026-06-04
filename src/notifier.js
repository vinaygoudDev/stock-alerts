const axios = require('axios');

const NTFY_BASE = 'https://ntfy.sh';

async function send({ title, message, priority = 'default', tags = [] }) {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) throw new Error('NTFY_TOPIC not set in .env');

  await axios.post(`${NTFY_BASE}/${topic}`, message, {
    headers: {
      Title:    title,
      Priority: priority,
      Tags:     tags.join(','),
    },
    timeout: 8000,
  });
}

// priority: min | low | default | high | urgent
function priorityFor(condition) {
  if (condition.type === 'pct_day' && Math.abs(condition.value) >= 8) return 'urgent';
  if (condition.type === 'pct_day') return 'high';
  return 'default';
}

function tagsFor(condition, quote) {
  const tags = ['chart_with_upwards_trend'];
  if (condition.type === 'price_below' || (condition.type === 'pct_day' && condition.value < 0)) {
    tags[0] = 'chart_with_downwards_trend';
    tags.push('red_circle');
  } else {
    tags.push('green_circle');
  }
  return tags;
}

module.exports = { send, priorityFor, tagsFor };
