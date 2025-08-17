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
      console.log(`Failed to send email: ${error.message}`);
      throw new Error('Email delivery failed');
    }
  }

  async sendResetPasswordEmail(email: string, resetLink: string) {
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border-radius: 8px; background-color: #f9f9f9; color: #333;">
      <div style="text-align: center; padding-bottom: 20px;">
        <h2 style="color: #222;">Reset Your Password</h2>
        <p style="font-size: 16px;">We received a request to reset your password. Click the button below to proceed.</p>
      </div>
      <div style="text-align: center;">
        <a href="${resetLink}" style="
          display: inline-block;
          padding: 12px 24px;
          font-size: 16px;
          color: #ffffff;
          background-color: #1f2937;
          text-decoration: none;
          border-radius: 5px;
          font-weight: bold;
        ">Reset Password</a>
      </div>
      <p style="font-size: 14px; text-align: center; color: #666; margin-top: 20px;">
        If you didn't request this, you can safely ignore this email.
      </p>
      <hr style="border: none; border-top: 1px solid #ddd; margin-top: 20px;">
      <p style="font-size: 12px; text-align: center; color: #999;">
        Need help? Contact Support
      </p>
    </div>
  `;

    await this.sendMail(
      email,
      'Reset Your Password',
      `Hello,\n\nWe received a request to reset your password. Click the link below to proceed:\n\n${resetLink}\n\nIf you didn't request this, ignore this email.\n\nNeed help? Contact support@yourdomain.com`,
      html,
    );
  }
}
