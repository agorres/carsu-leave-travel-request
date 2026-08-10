import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChecklistModule } from './checklist/checklist.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'admin123',
      database: 'carsu_leave_travel_request',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true, // dev only — turn off once you have real data
    }),
    ChecklistModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}