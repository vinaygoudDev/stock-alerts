// Supported condition types:
//   price_above   — fires when price > value
//   price_below   — fires when price < value
//   pct_day       — fires when % change from prev close crosses value
//                   positive value = up alert, negative value = down alert
//   volume_spike  — fires when today's volume > value × 30-day average
//                   e.g. value: 2 means 2x average volume

function evaluate(condition, quote) {
  const { type, value } = condition;
  switch (type) {
    case 'price_above':
      return quote.price > value;
    case 'price_below':
      return quote.price < value;
    case 'pct_day':
      if (quote.pctDay === null) return false;
      return value >= 0 ? quote.pctDay >= value : quote.pctDay <= value;
    case 'volume_spike':
      if (!quote.avgVolume || !quote.todayVolume) return false;
      return quote.todayVolume > value * quote.avgVolume;
    default:
      console.warn(`[conditions] unknown type: ${type}`);
      return false;
  }
}

function label(condition, quote) {
  const { type, value } = condition;
  const sign = quote.pctDay >= 0 ? '+' : '';
  switch (type) {
    case 'price_above':
      return `Price crossed above $${value} — now $${quote.price}`;
    case 'price_below':
      return `Price dropped below $${value} — now $${quote.price}`;
    case 'pct_day': {
      const pct = quote.pctDay !== null ? quote.pctDay : '?';
      return value >= 0
        ? `Up +${pct}% today (above your +${value}% alert)`
        : `Down ${pct}% today (below your ${value}% alert)`;
    }
    case 'volume_spike': {
      const ratio = quote.avgVolume ? (quote.todayVolume / quote.avgVolume).toFixed(1) : '?';
      return `Volume spike — ${ratio}x the 30-day average (your alert: ${value}x)`;
    }
    default:
      return `Condition met for ${quote.symbol}`;
  }
}

module.exports = { evaluate, label };
