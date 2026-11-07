import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfig {
  constructor(private readonly config: ConfigService) {}

  private read(name: string): string | undefined {
    return process.env[name] ?? this.config.get<string>(name);
  }

  get httpPort(): number {
    return Number(this.read('HTTP_PORT')) || 3000;
  }

  get corsOrigins(): string[] {
    return (this.read('CORS_ORIGINS') ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  get nodeEnv(): string {
    return this.read('NODE_ENV') ?? 'development';
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get sqlitePath(): string | undefined {
    return this.read('SQLITE_PATH');
  }

  get marquinhosApiKey(): string | undefined {
    return this.read('MARQUINHOS_API_KEY');
  }

  get marquinhosSecretKey(): string | undefined {
    return this.read('MARQUINHOS_SECRET_KEY');
  }

  get marquinhosCryptoSalt(): string | undefined {
    return this.read('MARQUINHOS_CRYPTO_SALT');
  }

  get discordBotToken(): string | undefined {
    return this.read('DISCORD_BOT_TOKEN');
  }

  get discordClientId(): string | undefined {
    return this.read('DISCORD_CLIENT_ID');
  }

  get discordClientSecret(): string | undefined {
    return this.read('DISCORD_CLIENT_SECRET');
  }

  get discordRedirectUri(): string | undefined {
    return this.read('DISCORD_REDIRECT_URI');
  }

  get lastfmApiKey(): string | undefined {
    return this.read('LASTFM_API_KEY');
  }

  get lastfmSharedSecret(): string | undefined {
    return this.read('LASTFM_SHARED_SECRET');
  }

  get lastfmRedirectUri(): string | undefined {
    return this.read('LASTFM_REDIRECT_URI');
  }

  get spotifyClientId(): string | undefined {
    return this.read('SPOTIFY_CLIENT_ID');
  }

  get spotifyClientSecret(): string | undefined {
    return this.read('SPOTIFY_CLIENT_SECRET');
  }

  get openAiApiKey(): string | undefined {
    return this.read('OPENAI_API_KEY');
  }

  get openAiModel(): string {
    return this.read('OPENAI_MODEL') || 'gpt-5.4-mini';
  }

  get openAiReasoningEffort(): string {
    return this.read('OPENAI_REASONING_EFFORT') || 'medium';
  }

  get knowledgeBaseUrl(): string | undefined {
    return this.read('KNOWLEDGE_BASE_URL');
  }

  get knowledgeBaseApiKey(): string | undefined {
    return this.read('KNOWLEDGE_BASE_API_KEY');
  }

  get searxngUrl(): string {
    return this.read('SEARXNG_URL') ?? 'https://searxng.frois.net.br';
  }

  get sandboxImage(): string {
    return this.read('SANDBOX_IMAGE') ?? 'marquinhos-sandbox:latest';
  }

  get sandboxMirrorPath(): string {
    return this.read('SANDBOX_MIRROR_PATH') ?? '/opt/marquinhos/sandbox-mirror';
  }

  get aiTraceEnabled(): boolean {
    return this.read('AI_TRACE_ENABLED')?.toLowerCase() !== 'false';
  }

  get aiThreadTokenBudget(): number {
    return Number(this.read('AI_THREAD_TOKEN_BUDGET') ?? 120_000);
  }

  get aiResearchMaxRounds(): number {
    return Number(this.read('AI_RESEARCH_MAX_ROUNDS') ?? 5);
  }

  get aiResearchMaxSearches(): number {
    return Number(this.read('AI_RESEARCH_MAX_SEARCHES') ?? 30);
  }

  get aiResearchMaxFetches(): number {
    return Number(this.read('AI_RESEARCH_MAX_FETCHES') ?? 40);
  }

  get aiResearchDeadlineMs(): number {
    return Number(this.read('AI_RESEARCH_DEADLINE_MS') ?? 900_000);
  }
}
