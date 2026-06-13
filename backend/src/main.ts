import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dns from 'node:dns';

// Force DNS lookup using Google public DNS to bypass querySrv resolver issues on local network
dns.setServers(['8.8.8.8', '8.8.4.4']);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS
  app.enableCors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
  });

  const port = process.env.PORT || 5000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
