// utils/marketerCheck.js
// Heuristic, conservative by default. Returns a score and reasons.
export function checkIfLikelyMarketer(user) {
  let score = 0;
  const reasons = [];

  const follows = Number(user?.followsCount ?? 0);
  const followers = Number(user?.followersCount ?? 0);
  const posts = Number(user?.postsCount ?? 0);
  const ratio = followers / Math.max(1, follows);

  const text = `${user?.displayName ?? ""} ${user?.handle ?? ""} ${user?.description ?? ""}`.toLowerCase();

  // --- Heuristics & Weights ---

  // 1. Link Hubs (Strong signal)
  const linkHubs = /(linktr\.ee|beacons?\.ai|lnk\.bio|carrd\.co|stan\.store|gumroad|ko-fi|patreon|buymeacoffee|onlyfans|fansly|taplink|bit\.ly|tinyurl|t\.co|amzn\.to)/i;
  if (linkHubs.test(text)) {
    score += 25;
    reasons.push("Contains link hub (e.g., linktr.ee)");
  }

  // 2. Promotional Keywords (Medium signal)
  const promoKw = /(brand(?:ing)?|growth|dm (?:me|us)|promo|marketing|spon|collab|partnership|ambassador|leads?|funnels?|newsletter|courses?|coaching|consult(?:ing)?|shop my|discount|affiliate|dropship|crypto|nft|webinar|masterclass|e-book|creator|influencer|agency)/i;
  if (promoKw.test(text)) {
    score += 20;
    reasons.push("Contains promotional keywords (e.g., marketing, course)");
  }

  // 3. High Follow Skew (Medium signal for marketers)
  // Follows a lot more people than follow them back.
  if (posts >= 20 && follows >= 5000 && ratio < 0.5) {
    score += 15;
    reasons.push(`High follow-to-follower skew (ratio: ${ratio.toFixed(3)})`);
  }

  // 4. Emoji Spam (Weak signal)
  // Using lots of "business" emojis in their name/bio.
  const emojiSpam = /[🚀📈💰💸🔥🎯✨✔️☑️✅]/g;
  const emojiMatches = text.match(emojiSpam) || [];
  if (emojiMatches.length >= 3) {
    score += 10;
    reasons.push(`Excessive promotional emojis (${emojiMatches.length})`);
  }

  return { score, reasons };
}