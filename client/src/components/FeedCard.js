import React from 'react';

export default function FeedCard({ item }) {
  const { source, author, text, permalink, media, embedHtml, timestamp } = {
    ...item,
    embedHtml: item?.media?.[0]?.embedHtml
  };

  const renderMedia = () => {
    // If we have platform embed HTML (TikTok/IG later)
    if (embedHtml) {
      return <div dangerouslySetInnerHTML={{ __html: embedHtml }} />;
    }
    // YouTube video via iframe if url holds watch link or videoId stored separately
    if (source === 'youtube' && item.sourceId) {
      const src = `https://www.youtube.com/embed/${item.sourceId}`;
      return (
        <iframe
          title={item.sourceId}
          width="100%" height="360"
          src={src} frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture;"
          allowFullScreen
        />
      );
    }
    // Image fallback
    const m = media?.[0];
    if (m?.type === 'image' && m.url) {
      return <img src={m.url} alt="" className="w-full rounded-lg" />;
    }
    return null;
  };

  return (
    <article className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 mb-4">
      <div className="text-sm text-neutral-400 mb-2">
        <span className="font-semibold text-white">{author?.name || source}</span>
        {timestamp && <span className="ml-2">{new Date(timestamp).toLocaleString()}</span>}
        <a href={permalink} className="ml-3 underline" target="_blank" rel="noreferrer">Open</a>
      </div>
      <div className="mb-3 text-neutral-200">{text}</div>
      <div className="mb-3">{renderMedia()}</div>
      <div className="text-xs text-neutral-500">#{source}</div>
    </article>
  );
}



