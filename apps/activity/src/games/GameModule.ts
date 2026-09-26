import type { DiscordIdentity } from '@/platform/discord/auth';
import type { GameId } from '@marquinhos/contracts/activity/gameId';
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export interface GameProps {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}

export interface GameModule {
  id: GameId;
  status: 'PLAY' | 'COMING SOON';
  Game: LazyExoticComponent<ComponentType<GameProps>>;
  RoomBoard?: LazyExoticComponent<ComponentType>;
}

export function lazyGame<Name extends string>(
  load: () => Promise<Record<Name, ComponentType<GameProps>>>,
  name: Name,
): GameModule['Game'] {
  return lazy(() => load().then((module) => ({ default: module[name] })));
}

export function lazyRoomBoard<Name extends string>(
  load: () => Promise<Record<Name, ComponentType>>,
  name: Name,
): NonNullable<GameModule['RoomBoard']> {
  return lazy(() => load().then((module) => ({ default: module[name] })));
}
