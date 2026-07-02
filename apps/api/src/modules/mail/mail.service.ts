import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor() {
    const host = process.env.SMTP_HOST?.trim();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    if (host && user && pass) {
      const port = Number(process.env.SMTP_PORT ?? 465);
      const secure = (process.env.SMTP_SECURE ?? 'true').trim() !== 'false';
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
      });
    } else {
      this.transporter = null;
    }
    this.from =
      process.env.SMTP_FROM?.trim() || `Velay <${user || 'bookings@velay.pro'}>`;
  }

  isEnabled(): boolean {
    return this.transporter !== null;
  }

  async sendMail(opts: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn(`Mail skipped (SMTP not configured): ${opts.subject}`);
      return false;
    }
    await this.transporter.sendMail({
      from: this.from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html ?? opts.text.replace(/\n/g, '<br>'),
    });
    return true;
  }

  async sendOtpEmail(to: string, code: string, purpose: 'login' | 'register') {
    const action = purpose === 'login' ? 'sign in' : 'complete registration';
    const mins = this.otpExpiresMinutes();
    return this.sendMail({
      to,
      subject: `Your Velay verification code: ${code}`,
      text: [
        `Your verification code to ${action} is: ${code}`,
        '',
        `This code expires in ${mins} minutes.`,
        'If you did not request this, you can ignore this email.',
      ].join('\n'),
    });
  }

  async sendPasswordResetEmail(to: string, resetUrl: string) {
    return this.sendMail({
      to,
      subject: 'Reset your Velay password',
      text: [
        'You requested a password reset for your Velay account.',
        '',
        `Reset your password: ${resetUrl}`,
        '',
        'If you did not request this, you can ignore this email.',
      ].join('\n'),
    });
  }

  async sendVendorWelcomeEmail(opts: {
    to: string;
    fullName: string;
    businessName: string;
    loginUrl: string;
    email: string;
    tempPassword?: string;
  }) {
    const lines = [
      `Hello ${opts.fullName},`,
      '',
      `Your business "${opts.businessName}" has been created on Velay.`,
      '',
      `Login URL: ${opts.loginUrl}`,
      `Email: ${opts.email}`,
    ];
    if (opts.tempPassword) {
      lines.push(`Temporary password: ${opts.tempPassword}`);
      lines.push('', 'Please change your password after your first login.');
    }
    lines.push('', 'Welcome to Velay!');
    return this.sendMail({
      to: opts.to,
      subject: `Welcome to Velay — ${opts.businessName}`,
      text: lines.join('\n'),
    });
  }

  private otpExpiresMinutes(): number {
    const mins = Number(process.env.OTP_EXPIRES_MINUTES ?? '10');
    return Number.isFinite(mins) && mins > 0 && mins <= 60 ? mins : 10;
  }
}
