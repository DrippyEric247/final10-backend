const fetch = require('node-fetch');
const FeedItem = require('../models/FeedItem');
const { isProductText } = require('../lib/productFilter');

const YT_API = 'https://www.googleapis.com/youtube/v3/search';

async function ingestYouTube({ q = '#Final10|#StayEarning|#StaySavvy|unboxing|deal', max = 20 }) {
  const key = process.env.YT_API_KEY;
  const url = `${YT_API}?part=snippet&type=video&maxResults=${max}&q=${encodeURIComponent(q)}&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube API ${res.status}`);
  const data = await res.json();

  const items = data.items || [];
  for (const it of items) {
    const vid = it.id.videoId;
    const sn = it.snippet;
    const text = `${sn.title} ${sn.description || ''}`;
    const tags = ['#StaySavvy','#StayEarning'].filter(t => text.toLowerCase().includes(t.toLowerCase()));

    const doc = {
      source: 'youtube',
      sourceId: vid,
      author: { name: sn.channelTitle, handle: sn.channelTitle },
      text,
      permalink: `https://www.youtube.com/watch?v=${vid}`,
      media: [{ type: 'video', url: `https://www.youtube.com/watch?v=${vid}` }],
      tags,
      products: [], // (optional: map brand mentions)
      metrics: {},
      timestamp: new Date(sn.publishedAt),
      rank: Date.now() / 1000,
      isProduct: isProductText(text)
    };

    try {
      await FeedItem.updateOne(
        { source: 'youtube', sourceId: vid },
        { $setOnInsert: doc },
        { upsert: true }
      );
    } catch (e) {
      // ignore duplicates
    }
  }
}

module.exports = { ingestYouTube };

