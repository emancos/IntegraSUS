import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { SyncModule } from './sync/sync.module.js';
import { DownloaderModule } from './downloader/downloader.module.js';
import { ParserModule } from './parser/parser.module.js';
import { ImporterModule } from './importer/importer.module.js';
import { ProcedimentosModule } from './procedimentos/procedimentos.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CnesModule } from './cnes/cnes.module.js';
import { SiaModule } from './sia/sia.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      synchronize: false,
    }),
    ScheduleModule.forRoot(),
    SyncModule,
    DownloaderModule,
    ParserModule,
    ImporterModule,
    ProcedimentosModule,
    AuthModule,
    CnesModule,
    SiaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}