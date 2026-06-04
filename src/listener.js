const https   = require('https');
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
  const req = https.get(`https://ntfy.sh/${cmdTopic}/sse`, res => {
    let buffer = '';

    res.on('data', chunk => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line for next chunk

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(line.slice(6));
          if (event.event === 'message') handleCommand(event.message, symbols);
        } catch {}
      }
    });

    res.on('end', () => {
      console.log('[listener] SSE connection closed, reconnecting...');
      setTimeout(() => connect(cmdTopic, symbols), 5000);
    });
  });

  req.on('error', () => {
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
      const sign  = q.pctDay >= 0 ? '+' : '';
      const arrow = q.pctDay >= 0 ? '↑' : '↓';
      return `${arrow} ${q.symbol} $${q.price}  ${sign}${q.pctDay}% today`;
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
