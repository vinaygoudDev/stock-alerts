require('dotenv').config();

const { fetchAll, resolveNames, getName } = require('./poller');
const { evaluate, label }                 = require('./conditions');
const { send, priorityFor, tagsFor }      = require('./notifier');
const { shouldFire }                      = require('./state');
const { startListener }                   = require('./listener');
const watchlist                           = require('../watchlist.json');

const INTERVAL = parseInt(process.env.POLL_INTERVAL_SECONDS || '30', 10) * 1000;
const symbols  = watchlist.map(s => s.symbol);

async function poll() {
  const quotes = await fetchAll(symbols);

  for (const quote of quotes) {
    const stock = watchlist.find(s => s.symbol === quote.symbol);
    if (!stock) continue;

    for (const condition of stock.conditions) {
      const triggered = evaluate(condition, quote);
      if (!shouldFire(condition.id, triggered)) continue;

      const message = label(condition, quote);
      const title   = `${quote.symbol} — ${getName(quote.symbol)}`;

      console.log(`[alert] ${title}: ${message}`);

      try {
        await send({
          title,
          message,
          priority: priorityFor(condition),
          tags:     tagsFor(condition, quote),
        });
      } catch (e) {
        console.error(`[notifier] failed to send: ${e.message}`);
      }
    }
  }
}

async function start() {
  console.log(`Resolving company names for: ${symbols.join(', ')}...`);
  await resolveNames(symbols);
  symbols.forEach(s => console.log(`  ${s} → ${getName(s)}`));
  console.log(`\nStock Alerts running — polling every ${INTERVAL / 1000}s`);
  console.log(`Notifications → ntfy.sh/${process.env.NTFY_TOPIC || '(no topic set)'}\n`);

  try {
    await send({
      title:    'Stock Alerts deployed',
      message:  `Watching ${symbols.join(', ')} — polling every ${INTERVAL / 1000}s`,
      priority: 'low',
      tags:     ['rocket'],
    });
  } catch (e) {
    console.error(`[notifier] startup ping failed: ${e.message}`);
  }

  startListener(symbols);
  poll();
  setInterval(poll, INTERVAL);
}

// Keeps Render's free tier awake — acts as a health-check endpoint
require('http').createServer((_, res) => res.end('ok')).listen(process.env.PORT || 3000);

start();
