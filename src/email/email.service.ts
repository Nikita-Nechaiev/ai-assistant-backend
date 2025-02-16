import * as nodemailer from 'nodemailer';
import { Injectable } from '@nestjs/common';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: +process.env.SMTP_PORT || 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER, 
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  async sendMail(to: string, subject: string, text: string, html: string) {
    const mailOptions = {
      from: process.env.SMTP_FROM || '"Your App" <no-reply@example.com>',
      to,
      subject,
      text,
      html,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error(`Failed to send email: ${error.message}`);
      throw new Error('Email delivery failed');
    }
  }

  async sendResetPasswordEmail(email: string, resetLink: string) {
    const html = `<p>Reset your password here: <a href="${resetLink}">Reset Password</a></p>`;
    await this.sendMail(
      email,
      'Reset Your Password',
      `Use this link: ${resetLink}`,
      html,
    );
  }
}
