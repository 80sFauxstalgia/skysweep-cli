// utils/marketerCheck.js
// Heuristic, conservative by default. Returns a reason string or null.
export function checkIfLikelyMarketer(user) {
  const follows = Number(user?.followsCount ?? 0);
  const followers = Number(user?.followersCount ?? 0);
  const posts = Number(user?.postsCount ?? 0);
  const ratio = followers / Math.max(1, follows);

  const display = `${user?.displayName ?? ""}`.toLowerCase();
  const handle = `${user?.handle ?? ""}`.toLowerCase();
  const bio = `${user?.description ?? ""}`.toLowerCase(); // Bluesky profile bio if present
  const text = `${display} ${handle} ${bio}`;

  // Common promo/link hubs & shorteners
  const linkHubs =
    /(linktr\.ee|beacons?\.ai|lnk\.bio|carrd\.co|stan\.store|gumroad|ko-fi|patreon|buymeacoffee|onlyfans|fansly|taplink|bit\.ly|tinyurl|t\.co|amzn\.to)/i;

  // Promo-y keywords (keep conservative)
  const promoKw =
    /(brand(?:ing)?|growth|dm (?:me|us)|promo|marketing|spon|collab|partnership|ambassador|leads?|funnels?|newsletter|courses?|coaching|consult(ing)?|shop my|discount|affiliate|dropship|crypto|nft)/i;

  // “Marketer pattern”: follows a lot relative to audience,
  // not a ghost (posts >= 20), AND ad-like signals in bio/name/links.
  const highFollowSkew =
    (follows >= 10000 && follows > followers * 2) ||
    (follows >= 5000 && ratio < 0.5);
  const hasPromoSignal = linkHubs.test(text) || promoKw.test(text);

  if (posts >= 20 && highFollowSkew && hasPromoSignal) {
    const matched = linkHubs.test(text) ? "link-hub" : "promo-keywords";
    return `marketer pattern (${matched}; ratio: ${ratio.toFixed(3)})`;
  }

  return null;
}
