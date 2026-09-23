import { z } from "zod";

export const letterFeedbackSchema = z.enum(["correct", "present", "absent"]);
export type LetterFeedback = z.infer<typeof letterFeedbackSchema>;

export const guessRowSchema = z.object({
  guess: z.string(),
  feedback: z.array(letterFeedbackSchema),
});
export type GuessRow = z.infer<typeof guessRowSchema>;

const wordleUserConfigBaseSchema = z.object({
  invertActionKeys: z.boolean(),
  enableSounds: z.boolean(),
});

export const wordleUserConfigSchema = z.discriminatedUnion("enableSpaceKey", [
  wordleUserConfigBaseSchema.extend({
    enableSpaceKey: z.literal(false),
    enableArrowKeys: z.literal(false),
  }),
  wordleUserConfigBaseSchema.extend({
    enableSpaceKey: z.literal(true),
    enableArrowKeys: z.boolean(),
  }),
]);
export type WordleUserConfig = z.infer<typeof wordleUserConfigSchema>;
