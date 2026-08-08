// /**
//  * Title: 'Logger file handle to store all of errors or success history'
//  * Description: ''
//  * Author: 'Masum Rana'
//  * Date: 27-12-2023
//  *
//  */

// import { createLogger, format, transports } from 'winston';
// import DailyRotateFile from 'winston-daily-rotate-file';

// const { combine, timestamp, label, printf, prettyPrint } = format;
// import path from 'path';

// // custom formet
// const customFormet = printf(({ level, message, label, timestamp }) => {
//   const date = new Date(timestamp);
//   const hour = date.getHours();
//   const minutes = date.getMinutes();
//   const seconds = date.getSeconds();

//   return ` [${label}] ${level}: ${message}-> ${date.toDateString()} ${hour}:${minutes}m:${seconds}s`;
// });

// const logger = createLogger({
//   format: combine(label({ label: 'right meow!' }), timestamp(), customFormet),
//   transports: [
//     new transports.Console(),
//     new DailyRotateFile({
//       filename: path.join(
//         process.cwd(),
//         'logs',
//         'winston',
//         'succeses',
//         'success-%DATE%.log',
//       ),
//       datePattern: 'YYYY-MM-DD-HH',
//       zippedArchive: true,
//       maxSize: '20m',
//       maxFiles: '14d',
//     }),
//   ],
// });

// const errorLogger = createLogger({
//   format: combine(
//     label({ label: 'right meow!' }),
//     timestamp(),
//     customFormet,
//     prettyPrint(),
//   ),

//   transports: [
//     new transports.Console(),
//     new DailyRotateFile({
//       filename: path.join(
//         process.cwd(),
//         'logs',
//         'winston',
//         'errors',
//         'error-%DATE%.log',
//       ),
//       datePattern: 'YYYY-MM-DD-HH',
//       zippedArchive: true,
//       maxSize: '20m',
//       maxFiles: '14d',
//     }),
//   ],
// });

// export { logger, errorLogger };
