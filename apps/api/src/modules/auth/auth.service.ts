import { InjectRepository } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { BootstrapFirstOwnerDto } from './dto/bootstrap-first-owner.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterEndUserDto } from './dto/register-end-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { IamService } from '../iam/iam.service';
import { Role } from '../iam/entities/role.entity';
import { User } from '../iam/entities/user.entity';
import { UserRole } from '../iam/entities/user-role.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
    @InjectRepository(UserRole)
    private readonly userRolesRepository: Repository<UserRole>,
    private readonly jwtService: JwtService,
    private readonly iamService: IamService,
  ) {}

  private accessExpiresIn(): string {
    return process.env.JWT_ACCESS_EXPIRES_IN ?? process.env.JWT_EXPIRES_IN ?? '15m';
  }

  private refreshExpiresIn(): string {
    return process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';
  }

  private async signAccessToken(userId: string): Promise<string> {
    return this.jwtService.signAsync(
      { sub: userId },
      { expiresIn: this.accessExpiresIn() as any },
    );
  }

  private async signRefreshToken(userId: string): Promise<string> {
    return this.jwtService.signAsync(
      { sub: userId, typ: 'refresh' },
      { expiresIn: this.refreshExpiresIn() as any },
    );
  }

  async login(dto: LoginDto): Promise<{
    token: string;
    refreshToken: string;
    user: Awaited<ReturnType<IamService['getMe']>>;
  }> {
    const email = dto.email.toLowerCase();
    const safeEmail = this.maskEmail(email);

    const user = await this.usersRepository.findOne({ where: { email } });
    if (!user) {
      this.logger.warn(`Login failed: user not found (${safeEmail})`);
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.isActive) {
      this.logger.warn(`Login failed: user inactive (${safeEmail}, id=${user.id})`);
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.passwordHash) {
      this.logger.warn(
        `Login failed: password missing on user (${safeEmail}, id=${user.id})`,
      );
      throw new UnauthorizedException('Invalid email or password');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      this.logger.warn(
        `Login failed: password mismatch (${safeEmail}, id=${user.id})`,
      );
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = await this.signAccessToken(user.id);
    const refreshToken = await this.signRefreshToken(user.id);
    const profile = await this.iamService.getMe(user.id);
    this.logger.log(`Login success (${safeEmail}, id=${user.id})`);
    return { token, refreshToken, user: profile };
  }

  async refresh(dto: RefreshTokenDto): Promise<{ token: string; refreshToken: string }> {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub?: string;
        typ?: string;
      }>(dto.refreshToken);
      if (payload.typ !== 'refresh' || !payload.sub) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      const user = await this.usersRepository.findOne({
        where: { id: payload.sub },
      });
      if (!user?.isActive) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      const token = await this.signAccessToken(user.id);
      const refreshToken = await this.signRefreshToken(user.id);
      return { token, refreshToken };
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async bootstrapFirstOwner(
    dto: BootstrapFirstOwnerDto,
  ): Promise<{ token: string; refreshToken: string; userId: string; email: string }> {
    const configuredSecret = process.env.AUTH_BOOTSTRAP_SECRET?.trim();
    if (!configuredSecret) {
      throw new ForbiddenException('Bootstrap is not enabled on server');
    }
    if (dto.bootstrapSecret.trim() !== configuredSecret) {
      throw new ForbiddenException('Invalid bootstrap secret');
    }

    const usersCount = await this.usersRepository.count();
    if (usersCount > 0) {
      throw new ForbiddenException(
        'Bootstrap already locked: users already exist in database',
      );
    }

    const email = dto.email.toLowerCase().trim();
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = this.usersRepository.create({
      fullName: dto.fullName.trim(),
      email,
      passwordHash,
      isActive: true,
    });
    const savedUser = await this.usersRepository.save(user);

    let role = await this.rolesRepository.findOne({
      where: { code: 'platform-owner' },
    });
    if (!role) {
      role = this.rolesRepository.create({
        code: 'platform-owner',
        name: 'Platform Owner',
      });
      await this.rolesRepository.save(role);
    }

    const userRole = this.userRolesRepository.create({
      userId: savedUser.id,
      roleCode: 'platform-owner',
    });
    await this.userRolesRepository.save(userRole);

    const token = await this.signAccessToken(savedUser.id);
    const refreshToken = await this.signRefreshToken(savedUser.id);
    this.logger.log(
      `Bootstrap success: first owner created (${this.maskEmail(email)}, id=${savedUser.id})`,
    );

    return {
      token,
      refreshToken,
      userId: savedUser.id,
      email,
    };
  }

  async registerEndUser(
    dto: RegisterEndUserDto,
  ): Promise<{ token: string; refreshToken: string; userId: string; email: string }> {
    const email = dto.email.toLowerCase().trim();
    const safeEmail = this.maskEmail(email);

    const existing = await this.usersRepository.findOne({ where: { email } });
    if (existing) {
      this.logger.warn(`Register failed: email already exists (${safeEmail})`);
      throw new BadRequestException(`User with email ${email} already exists`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.usersRepository.create({
      fullName: dto.fullName.trim(),
      email,
      phone: dto.phone?.trim(),
      passwordHash,
      isActive: true,
    });
    const savedUser = await this.usersRepository.save(user);

    let role = await this.rolesRepository.findOne({
      where: { code: 'customer-end-user' },
    });
    if (!role) {
      role = this.rolesRepository.create({
        code: 'customer-end-user',
        name: 'Customer / End User',
      });
      await this.rolesRepository.save(role);
    }

    const userRole = this.userRolesRepository.create({
      userId: savedUser.id,
      roleCode: 'customer-end-user',
    });
    await this.userRolesRepository.save(userRole);

    const token = await this.signAccessToken(savedUser.id);
    const refreshToken = await this.signRefreshToken(savedUser.id);
    this.logger.log(
      `Register success: end user created (${safeEmail}, id=${savedUser.id})`,
    );

    return {
      token,
      refreshToken,
      userId: savedUser.id,
      email,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{
    ok: true;
    message: string;
    resetToken?: string;
  }> {
    const email = dto.email.toLowerCase().trim();
    const generic = {
      ok: true as const,
      message:
        'If an account exists for this email, you will receive password reset instructions.',
    };

    const user = await this.usersRepository.findOne({ where: { email } });
    if (!user?.isActive || !user.passwordHash) {
      return generic;
    }

    const token = randomBytes(32).toString('hex');
    user.passwordResetTokenHash = this.hashResetToken(token);
    user.passwordResetExpiresAt = new Date(
      Date.now() + this.passwordResetExpiresMs(),
    );
    await this.usersRepository.save(user);

    if (process.env.AUTH_PASSWORD_RESET_RETURN_TOKEN?.trim() === 'true') {
      this.logger.warn(
        `Password reset token returned in response (AUTH_PASSWORD_RESET_RETURN_TOKEN) for ${this.maskEmail(email)}`,
      );
      return { ...generic, resetToken: token };
    }

    this.logger.log(
      `Password reset requested (${this.maskEmail(email)}). Deliver token via email in production.`,
    );
    return generic;
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ ok: true }> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user?.isActive) {
      throw new UnauthorizedException('Invalid session');
    }
    if (!user.passwordHash) {
      throw new BadRequestException('Password login is not set for this account');
    }
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    await this.usersRepository.save(user);
    this.logger.log(`Password changed (${this.maskEmail(user.email)}, id=${user.id})`);
    return { ok: true };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ ok: true }> {
    const passwordResetTokenHash = this.hashResetToken(dto.token.trim());
    const user = await this.usersRepository.findOne({
      where: { passwordResetTokenHash },
    });
    const now = new Date();
    if (
      !user ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt <= now
    ) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    await this.usersRepository.save(user);
    this.logger.log(
      `Password reset completed (${this.maskEmail(user.email)}, id=${user.id})`,
    );
    return { ok: true };
  }

  private hashResetToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  private passwordResetExpiresMs(): number {
    const mins = Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES ?? '60');
    const safe =
      Number.isFinite(mins) && mins > 0 && mins <= 24 * 60 ? mins : 60;
    return safe * 60 * 1000;
  }

  private maskEmail(email: string): string {
    const [name, domain] = email.split('@');
    if (!name || !domain) return email;
    if (name.length <= 2) return `${name[0] ?? '*'}*@${domain}`;
    return `${name.slice(0, 2)}***@${domain}`;
  }
}
