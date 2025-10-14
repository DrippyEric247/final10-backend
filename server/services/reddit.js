const fetch = require('node-fetch');
const FeedItem = require('../models/feeditem');
const { isProductText } = require('../lib/productFilter');

async function ingestReddit({ subs = ['BuyItForLife','Sneakers'], limit = 25 }) {
  for (const sub of subs) {
    const url = `https://www.reddit.com/r/${sub}/hot.json?limit=${limit}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Final10/1.0' }});
    if (!res.ok) continue;
    const data = await res.json();
    const posts = data?.data?.children || [];

    for (const p of posts) {
      const post = p.data;
      const text = `${post.title} ${post.selftext || ''}`;
      const id = post.id;

      const doc = {
        source: 'reddit',
        sourceId: id,
        author: { name: post.author, handle: post.author },
        text,
        permalink: `https://www.reddit.com${post.permalink}`,
        media: post.is_video
          ? [{ type: 'video', url: post.url }]
          : (post.url && /\.(jpg|png|gif|jpeg)$/i.test(post.url))
              ? [{ type: 'image', url: post.url }]
              : [],
        tags: ['#StaySavvy','#StayEarning'].filter(t => text.toLowerCase().includes(t.toLowerCase())),
        products: [],
        metrics: { likes: post.ups, comments: post.num_comments },
        timestamp: new Date(post.created_utc * 1000),
        rank: post.ups || 0,
        isProduct: isProductText(text)
      };

      try {
        await FeedItem.updateOne(
          { source: 'reddit', sourceId: id },
          { $setOnInsert: doc },
          { upsert: true }
        );
      } catch (e) {}
    }
  }
}

module.exports = { ingestReddit };

