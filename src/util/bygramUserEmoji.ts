const BYGRAM_USER_EMOJIS = [
  '🦊', '🐼', '🐯', '🦁', '🐸', '🐙', '🦄', '🐝',
  '🍀', '🌙', '⭐️', '⚡️', '🔥', '🌊', '🍉', '🍒',
  '🎧', '🎮', '🚀', '🛸', '💎', '🧩', '🎨', '🪐',
] as const;

export function getBygramUserEmoji(userId: string) {
  let hash = 0;
  for (let index = 0; index < userId.length; index += 1) {
    hash = ((hash << 5) - hash + userId.charCodeAt(index)) | 0;
  }

  return BYGRAM_USER_EMOJIS[Math.abs(hash) % BYGRAM_USER_EMOJIS.length];
}
