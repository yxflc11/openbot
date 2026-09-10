import { z } from "zod";
export const reactionEmojiSchema = z.enum(["👍", "❤️", "😂", "🎉", "🤔", "👀"]);
export const setMessageReactionSchema = z
  .object({ emoji: reactionEmojiSchema, active: z.boolean() })
  .strict();
export const messageReactionSchema = z
  .object({ messageId: z.string().uuid(), emoji: reactionEmojiSchema, actor: z.literal("owner") })
  .strict();
