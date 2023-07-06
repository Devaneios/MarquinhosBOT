import { GuildMember } from 'discord.js';

export const checkInReply = (member: GuildMember, guildName: string) => {
  const memberJoinedTimestamp = member.joinedTimestamp;
  const memberJoinedTimestampAsDate = new Date(memberJoinedTimestamp);
  const formatedMemberJoinedTimestamp =
    memberJoinedTimestampAsDate.toLocaleString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Recife',
    });
  const dayOfTheWeekMemberJoined = memberJoinedTimestampAsDate.toLocaleString(
    'pt-BR',
    {
      weekday: 'long',
    }
  );

  return `Você entrou no ${guildName} ${
    dayOfTheWeekMemberJoined == 'sábado' ||
    dayOfTheWeekMemberJoined == 'domingo'
      ? 'no'
      : 'na'
  } ${formatedMemberJoinedTimestamp}`;
};
