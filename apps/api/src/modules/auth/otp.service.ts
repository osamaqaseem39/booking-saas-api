import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomInt } from 'crypto';
import { LessThan, Repository } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { EmailOtp, type OtpPurpose } from './entities/email-otp.entity';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @InjectRepository(EmailOtp)
    private readonly otpRepository: Repository<EmailOtp>,
    private readonly mailService: MailService,
  ) {}

  isRequired(): boolean {
    if (process.env.AUTH_OTP_REQUIRED?.trim() === 'false') return false;
    return this.mailService.isEnabled();
  }

  async sendOtp(email: string, purpose: OtpPurpose): Promise<{ ok: true; message: string }> {
    if (!this.mailService.isEnabled()) {
      throw new BadRequestException('Email verification is not configured');
    }

    const normalized = email.toLowerCase().trim();
    const cooldownMs = this.resendCooldownMs();
    const recent = await this.otpRepository.findOne({
      where: { email: normalized, purpose },
      order: { createdAt: 'DESC' },
    });
    if (recent && Date.now() - recent.createdAt.getTime() < cooldownMs) {
      throw new HttpException(
        'Please wait before requesting another code',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.otpRepository.delete({ email: normalized, purpose });
    await this.cleanupExpired();

    const code = String(randomInt(100000, 999999));
    const row = this.otpRepository.create({
      email: normalized,
      purpose,
      codeHash: this.hashCode(code),
      expiresAt: new Date(Date.now() + this.otpExpiresMs()),
      attempts: 0,
    });
    await this.otpRepository.save(row);

    try {
      await this.mailService.sendOtpEmail(normalized, code, purpose);
    } catch (err) {
      await this.otpRepository.delete({ id: row.id });
      this.logger.error(`Failed to send OTP to ${this.maskEmail(normalized)}`, err);
      throw new BadRequestException('Failed to send verification email');
    }

    return {
      ok: true,
      message: 'If this email is valid, a verification code has been sent.',
    };
  }

  async verifyOtp(email: string, purpose: OtpPurpose, code: string): Promise<void> {
    if (!this.isRequired()) return;

    const normalized = email.toLowerCase().trim();
    const row = await this.otpRepository.findOne({
      where: { email: normalized, purpose },
      order: { createdAt: 'DESC' },
    });
    if (!row || row.expiresAt <= new Date()) {
      throw new BadRequestException('Invalid or expired verification code');
    }
    if (row.attempts >= this.maxAttempts()) {
      await this.otpRepository.delete({ id: row.id });
      throw new BadRequestException('Too many failed attempts. Request a new code.');
    }

    const ok = row.codeHash === this.hashCode(code.trim());
    if (!ok) {
      row.attempts += 1;
      await this.otpRepository.save(row);
      throw new BadRequestException('Invalid or expired verification code');
    }

    await this.otpRepository.delete({ id: row.id });
  }

  private hashCode(code: string): string {
    return createHash('sha256').update(code, 'utf8').digest('hex');
  }

  private otpExpiresMs(): number {
    const mins = Number(process.env.OTP_EXPIRES_MINUTES ?? '10');
    const safe = Number.isFinite(mins) && mins > 0 && mins <= 60 ? mins : 10;
    return safe * 60 * 1000;
  }

  private resendCooldownMs(): number {
    const secs = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS ?? '60');
    const safe = Number.isFinite(secs) && secs >= 30 && secs <= 300 ? secs : 60;
    return safe * 1000;
  }

  private maxAttempts(): number {
    const n = Number(process.env.OTP_MAX_ATTEMPTS ?? '5');
    return Number.isFinite(n) && n >= 3 && n <= 10 ? n : 5;
  }

  private async cleanupExpired(): Promise<void> {
    await this.otpRepository.delete({ expiresAt: LessThan(new Date()) });
  }

  private maskEmail(email: string): string {
    const [name, domain] = email.split('@');
    if (!name || !domain) return email;
    return `${name.slice(0, 2)}***@${domain}`;
  }
}
