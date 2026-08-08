import nodemailer from 'nodemailer';
import config from '../config';

export type IEmailInfo = {
  to: string;
  subject: string;
  html: string;
};
const sendMail = async (emailInfo: IEmailInfo) => {
  const { html, subject, to } = emailInfo;
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.email,
      pass: config.email_secret,
    },
  });

  await transporter.sendMail({
    from: config.email,
    to,
    subject,
    html,
  });
};

export const sendMailerHelper = {
  sendMail,
};
