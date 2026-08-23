import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dns from 'node:dns';
import * as express from 'express';
import {
  AppSocketIoAdapter,
  getAllowedBrowserOrigins,
  isAllowedBrowserOrigin,
} from './socket-io.adapter';

// Force DNS lookup using Google public DNS to bypass querySrv resolver issues on local network
dns.setServers(['8.8.8.8', '8.8.4.4']);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const expressApp = app.getHttpAdapter().getInstance();
  if (typeof expressApp?.disable === 'function') {
    expressApp.disable('x-powered-by');
  }

  // Consistent security headers without breaking CORS/Embed/HLS/Media
  app.use((_req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });

  // Set payload limits for Base64 images uploading
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  const allowedOrigins = getAllowedBrowserOrigins();

  // Browser requests are restricted to local development and the exact
  // production/preview origins configured in FRONTEND_URL.
  app.enableCors({
    origin(origin, callback) {
      if (isAllowedBrowserOrigin(origin, allowedOrigins)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
    },
    credentials: true,
  });
  app.useWebSocketAdapter(new AppSocketIoAdapter(app, allowedOrigins));

  const port = process.env.PORT || 5000;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
