// Accepts assorted Imgur URL forms and returns a direct image URL.
// Examples:
//   https://i.imgur.com/Poarb0q.png  → https://i.imgur.com/Poarb0q.png
//   https://imgur.com/Poarb0q         → https://i.imgur.com/Poarb0q.png
//   https://imgur.com/a/Poarb0q       → https://i.imgur.com/Poarb0q.png
//   https://imgur.com/gallery/Poarb0q → https://i.imgur.com/Poarb0q.png
// Anything we don't recognize is passed through unchanged so custom hosts still work.
export function imgurDirectUrl(input) {
  if (!input) return null;
  const url = String(input).trim();
  if (!url) return null;

  if (/^https?:\/\/i\.imgur\.com\/[\w-]+\.(png|jpe?g|gif|webp)/i.test(url)) {
    return url;
  }

  const m = url.match(/^https?:\/\/(?:www\.)?imgur\.com\/(?:a\/|gallery\/)?([\w-]+)/i);
  if (m) return `https://i.imgur.com/${m[1]}.png`;

  return url;
}
