import * as nodemailer from 'nodemailer';
import { Injectable } from '@nestjs/common';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: +process.env.SMTP_PORT || 465, // Ensure port matches the secure setting
      secure: true, // Use true for SSL (465), false for STARTTLS (587)
      auth: {
        user: process.env.SMTP_USER, // Gmail address
        pass: process.env.SMTP_PASSWORD, // App password
      },
      logger: true, // Enable debug logging
      debug: true, // Include debug info
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
      console.log(`Email sent: ${info.messageId}`);
    } catch (error) {
      console.error(`Failed to send email: ${error.message}`);
      throw new Error('Email delivery failed');
    }
  }
}
