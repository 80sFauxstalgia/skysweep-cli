// utils/botCheck.js
export function checkIfLikelyBot(user) {
  let score = 0;
  const reasons = [];

  const follows = Number(user?.followsCount ?? 0);
  const followers = Number(user?.followersCount ?? 0);
  const posts = Number(user?.postsCount ?? 0);
  const ratio = followers / Math.max(1, follows);
  const name = `${user?.displayName ?? ""} ${user?.handle ?? ""}`;
  const bio = user?.description ?? "";

  // Heuristic 1: Mass-follow botnet (Strong signal)
  // Very high following, very low follower ratio
  if (follows > 4000 && ratio < 0.01) {
    score += 50;
    reasons.push(`Extreme mass-follow pattern (ratio: ${ratio.toFixed(3)})`);
  } else if (follows > 1200 && ratio < 0.15) {
    score += 30;
    reasons.push(`Mass-follow pattern (ratio: ${ratio.toFixed(3)})`);
  }

  // Heuristic 2: Empty spam profile (Strong signal)
  // Moderate following, very few followers, few posts
  if (follows > 100 && followers < 15 && posts < 5 && ratio < 0.05) {
    score += 40;
    reasons.push(`Likely empty spam profile (ratio: ${ratio.toFixed(3)})`);
  }

  // Heuristic 3: Keyword-bait empty account (Medium signal)
  const bait =
    /(ai|girls?|sexy|crypto|btc|nft|onlyfans?|escort|xxx|free|hot|bet|gamble)/i;
  if (followers < 5 && posts < 2 && bait.test(name)) {
    score += 25;
    reasons.push("Keyword-bait on near-empty account");
  }

  // Heuristic 4: Missing bio (Weak signal)
  if (!bio) {
    score += 5;
    reasons.push("Missing profile bio");
  }

  // Heuristic 5: No profile picture (Weak signal)
  if (!user.avatar) {
    score += 5;
    reasons.push("Default profile picture");
  }
  
  // Heuristic 6: Generic handle with numbers (Weak signal)
  if (/[a-zA-Z]+[0-9]{4,}/.test(user.handle)) {
    score += 5;
    reasons.push("Generic handle with numbers");
  }

  return { score, reasons };
}
