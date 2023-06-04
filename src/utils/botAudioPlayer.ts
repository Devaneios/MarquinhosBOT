import {
  AudioPlayer,
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
} from '@discordjs/voice';
import { logger } from './logger';
import { SafeAny } from '../types';
import { AudioPlayerDisconnectEvent } from './discord';

class BotAudioPlayer {
  private static instance: BotAudioPlayer;
  player: AudioPlayer;
  queue: SafeAny[] = [];

  constructor() {
    this.player = createAudioPlayer();
    this.player.on(AudioPlayerStatus.Idle, () => {
      if (this.queue.length === 0) {
        this.player.emit(AudioPlayerDisconnectEvent.Disconnect);
      } else {
        this.play(this.queue.shift());
      }
    });
    this.player.on('error', (error) => {
      logger.error(error);
    });

    this.player.on(AudioPlayerStatus.Playing, (event) => {
      if (event.status === 'buffering') {
        logger.info('Audio player has started playing!');
      }
    });
  }

  public static getInstance(): BotAudioPlayer {
    if (!BotAudioPlayer.instance) {
      BotAudioPlayer.instance = new BotAudioPlayer();
    }

    return BotAudioPlayer.instance;
  }

  public play(resourcePath: string) {
    if (this.player.state.status !== AudioPlayerStatus.Idle) {
      this.queue.push(resourcePath);
    } else {
      const resource = createAudioResource(resourcePath, {
        inlineVolume: true,
      });
      resource.volume?.setVolume(0.7);

      this.player.play(resource);
    }
  }
}

export default BotAudioPlayer;
