CREATE TABLE "wordle_community_win_announcements" (
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"word_date" text NOT NULL,
	"announced_at" bigint NOT NULL,
	CONSTRAINT "wordle_community_win_announcements_guild_id_user_id_word_date_pk" PRIMARY KEY("guild_id","user_id","word_date")
);
