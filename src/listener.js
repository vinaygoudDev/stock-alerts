const https   = require('https');
const axios   = require('axios');
const { fetchAll, getName } = require('./poller');
const { send }              = require('./notifier');

// Opens a persistent SSE connection to the command topic.
// Reconnects automatically on disconnect or error.
function startListener(symbols) {
  const cmdTopic = `${process.env.NTFY_TOPIC}-cmd`;
  console.log(`[listener] watching ntfy.sh/${cmdTopic} for commands`);
  connect(cmdTopic, symbols);
}

function connect(cmdTopic, symbols) {
  axios.get(`https://ntfy.sh/${cmdTopic}/sse`, {
    responseType: 'stream',
    headers: { Accept: 'text/event-stream' },
    timeout: 0, // no timeout — connection must stay open indefinitely
  }).then(res => {
    let buffer = '';

    res.data.on('data', chunk => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(line.slice(6));
          console.log(`[listener] event received: ${event.event} — ${event.message || ''}`);
          if (event.event === 'message') handleCommand(event.message, symbols);
        } catch (e) {
          console.error(`[listener] parse error: ${e.message} — raw: ${line.slice(0, 80)}`);
        }
      }
    });

    res.data.on('end', () => {
      console.log('[listener] SSE connection closed, reconnecting in 5s...');
      setTimeout(() => connect(cmdTopic, symbols), 5000);
    });

    res.data.on('error', () => {
      setTimeout(() => connect(cmdTopic, symbols), 5000);
    });

  }).catch(() => {
    setTimeout(() => connect(cmdTopic, symbols), 5000);
  });
}

async function handleCommand(message, symbols) {
  const cmd = message.trim().toLowerCase();
  console.log(`[listener] received command: "${cmd}"`);

  // Any message triggers a price summary — "price", "p", or anything else
  try {
    const quotes = await fetchAll(symbols);
    if (!quotes.length) {
      await send({ title: 'Price Check', message: 'Could not fetch prices right now.', priority: 'low', tags: ['warning'] });
      return;
    }

    const lines = quotes.map(q => {
      const pctStr = q.pctDay !== null ? `${q.pctDay >= 0 ? '+' : ''}${q.pctDay}%` : 'N/A';
      const arrow  = (q.pctDay ?? 0) >= 0 ? '↑' : '↓';
      return `${arrow} ${q.symbol}  $${q.price}  ${pctStr} today`;
    });

    await send({
      title:    'Price Update',
      message:  lines.join('\n'),
      priority: 'default',
      tags:     ['chart_with_upwards_trend'],
    });
  } catch (e) {
    console.error(`[listener] price fetch failed: ${e.message}`);
  }
}

module.exports = { startListener };
