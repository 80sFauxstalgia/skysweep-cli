// utils/botCheck.js
export function checkIfLikelyBot(user) {
  const follows = Number(user?.followsCount ?? 0);
  const followers = Number(user?.followersCount ?? 0);
  const posts = Number(user?.postsCount ?? 0);
  const ratio = followers / Math.max(1, follows);
  const name = `${user?.displayName ?? ""} ${user?.handle ?? ""}`;

  // 1) classic empty spam
  if (follows > 100 && followers < 25 && posts < 5 && ratio < 0.05) {
    return `empty spam profile (ratio: ${ratio.toFixed(3)})`;
  }

  // 2) mass-follow botnet (big following, low ratio)
  if (follows > 5000 && ratio < 0.1) {
    return `mass-follow botnet (ratio: ${ratio.toFixed(3)})`;
  }

  // 3) suspiciously empty + keyword bait (still conservative)
  const bait =
    /(ai|girls?|sexy|crypto|btc|nft|onlyfans?|escort|xxx|free|hot|bet|gamble)/i;
  if (followers < 3 && posts === 0 && bait.test(name)) {
    return `keyword-bait empty account (ratio: ${ratio.toFixed(3)})`;
  }

  return null;
}
