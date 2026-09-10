export const reactionEmojis = ["👍", "❤️", "😂", "🎉", "🤔", "👀"] as const;
export type ReactionEmoji = (typeof reactionEmojis)[number];
/** OpenBot currently has one Owner; this is not a fabricated participant count. */
export interface MessageReaction {
  messageId: string;
  emoji: ReactionEmoji;
  actor: "owner";
}
