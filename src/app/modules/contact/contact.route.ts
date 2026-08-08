import express from 'express';
import { ContactController } from './contact.controller';

const router = express.Router();

router.post('/create-order', ContactController.createContactMessage);
router.post('/', ContactController.createContactMessage);

export const ContactRoute = router;
