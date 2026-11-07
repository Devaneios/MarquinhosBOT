import { Module } from '@nestjs/common';
import { WordleModule } from 'modules/wordle/wordle.module';

@Module({ imports: [WordleModule] })
export class ScriptsModule {}
