import mongoose from 'mongoose';
import config from './config/index';
import app from './app';
import { Server } from 'http';
// import { logger, errorLogger } from './shared/logger';

process.on('uncaughtException', () => {
  // errorLogger.error('uncaughtException detected ...');
  console.log('uncaughtException detected ...');
  process.exit(1);
});

let server: Server;

const Run = async () => {
  try {
    await mongoose.connect(config.database_url as string);
    server = app.listen(config.port, () => {
      console.log(`Example app listening on port ${config.port}`);
    });
  } catch (error) {
    console.log('something is wrong', error);
  }

  process.on('unhandledRejection', (reason, promise) => {
    // logger.error(
    //   `Unhandle Rejection is detected resion ${reason}  , and promise ${promise} we are closing our server`,
    // );
    console.log(
      `Unhandle Rejection is detected resion ${reason}  , and promise ${promise} we are closing our server`,
    );
    if (server) {
      server.close(() => {
        process.exit(1);
      });
    } else {
      process.exit(1);
    }
  });
};

Run();

process.on('SIGTERM', () => {
  // errorLogger.error('Sigterm is Recived');

  if (server) {
    server.close();
  }
});
