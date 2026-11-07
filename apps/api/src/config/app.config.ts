import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfig {
  constructor(private readonly config: ConfigService) {}

  get httpPort(): number {
    return Number(this.config.get<string>('HTTP_PORT')) || 3000;
  }

  get corsOrigins(): string[] {
    return (this.config.get<string>('CORS_ORIGINS') ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  get nodeEnv(): string {
    return this.config.get<string>('NODE_ENV') ?? 'development';
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get sqlitePath(): string | undefined {
    return this.config.get<string>('SQLITE_PATH');
  }

  get marquinhosApiKey(): string | undefined {
    return this.config.get<string>('MARQUINHOS_API_KEY');
  }
}
