const axios = require('axios');

const BASE = 'https://finnhub.io/api/v1';

const nameCache   = {};
// volume cache refreshes every hour — daily candle data doesn't change faster
const volumeCache = {};
const VOLUME_TTL  = 60 * 60 * 1000;

async function resolveNames(symbols) {
  for (const symbol of symbols) {
    if (nameCache[symbol]) continue;
    try {
      const { data } = await axios.get(`${BASE}/stock/profile2`, {
        params: { symbol, token: process.env.FINNHUB_API_KEY },
        timeout: 8000,
      });
      nameCache[symbol] = data.name || symbol;
    } catch {
      nameCache[symbol] = symbol;
    }
  }
}

function getName(symbol) {
  return nameCache[symbol] || symbol;
}

// Fetches last 30 days of daily candles to compute average volume.
// Returns { avgVolume, todayVolume } or null if unavailable (e.g. indices).
async function fetchVolumeData(symbol) {
  const cached = volumeCache[symbol];
  if (cached && (Date.now() - cached.fetchedAt) < VOLUME_TTL) return cached;

  try {
    const now  = Math.floor(Date.now() / 1000);
    const from = now - 30 * 24 * 60 * 60;

    const { data } = await axios.get(`${BASE}/stock/candle`, {
      params: { symbol, resolution: 'D', from, to: now, token: process.env.FINNHUB_API_KEY },
      timeout: 8000,
    });

    if (!data || data.s !== 'ok' || !data.v || data.v.length < 2) return null;

    const todayVolume = data.v[data.v.length - 1];
    const pastVolumes = data.v.slice(0, -1);
    const avgVolume   = pastVolumes.reduce((a, b) => a + b, 0) / pastVolumes.length;

    const result = { avgVolume, todayVolume, fetchedAt: Date.now() };
    volumeCache[symbol] = result;
    return result;
  } catch {
    return null;
  }
}

// Returns { symbol, price, open, prevClose, pctDay, high, low, avgVolume, todayVolume }
async function fetchQuote(symbol) {
  const { data } = await axios.get(`${BASE}/quote`, {
    params: { symbol, token: process.env.FINNHUB_API_KEY },
    timeout: 8000,
  });

  if (!data || data.c === 0) throw new Error(`No data for ${symbol}`);

  const pctDay      = data.pc > 0 ? ((data.c - data.pc) / data.pc) * 100 : 0;
  const volumeData  = await fetchVolumeData(symbol);

  return {
    symbol,
    price:       data.c,
    open:        data.o,
    prevClose:   data.pc,
    high:        data.h,
    low:         data.l,
    pctDay:      parseFloat(pctDay.toFixed(2)),
    avgVolume:   volumeData?.avgVolume   ?? null,
    todayVolume: volumeData?.todayVolume ?? null,
  };
}

async function fetchAll(symbols) {
  const results = [];
  for (const symbol of symbols) {
    try {
      results.push(await fetchQuote(symbol));
    } catch (e) {
      console.error(`[poller] failed to fetch ${symbol}: ${e.message}`);
    }
  }
  return results;
}

module.exports = { fetchAll, resolveNames, getName };
