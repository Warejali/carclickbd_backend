import express, { Application } from 'express';
import cors from 'cors';
import GlobalErrorHandler from './app/middlewares/GlobalErrorHanlder';
import handleNotFoundApi from './errors/handleNotFound';
import router from './app/routes';
import cookieParser from 'cookie-parser';
import { getUploadRoot, PUBLIC_UPLOAD_PREFIX } from './helper/uploadPath';

const app: Application = express();

app.use(
  cors({
    origin: [
      'http://localhost:3000',
      'https://carclickbd.vercel.app',
      'https://www.carclickbd.com',
      'https://carclickbd.com',
    ],
    credentials: true,
  }),
);

app.use(cookieParser());

app.get('/', (req, res) => {
  res.send('Server Working successfully');
});
//parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  PUBLIC_UPLOAD_PREFIX,
  express.static(getUploadRoot(), {
    maxAge: '30d',
    immutable: true,
  }),
);

// route
app.use('/api/v1', router);
// Global Error handler
app.use(GlobalErrorHandler);

// handle not found api/ route
app.use(handleNotFoundApi);

export default app;
