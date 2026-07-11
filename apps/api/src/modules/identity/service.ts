import { randomUUID, createHash } from 'node:crypto';
import type { OtpPurpose, UserRole } from '@prisma/client';
import { prisma } from '../../lib/db.js';
import { ApiError } from '../../lib/errors.js';
import { getEnv } from '../../config/env.js';
import { getSmsProvider } from '../../lib/sms/sms-provider.js';
import { getEmailProvider } from '../../lib/email/email-provider.js';
import {
  assertRateLimit,
  buildRateLimitKey,
  normalizeEmail,
  normalizePhoneNumber,
} from '../../lib/security/rate-limit.js';
import { encryptAtRest } from '../../lib/security/encryption.js';
import { AUTH_RATE_LIMITS, PASSWORD_RESET_EXPIRY_MS } from './auth-rate-limits.js';
import {
  generateOtpCode,
  generateRefreshToken,
  generateResetToken,
  hashOtpCode,
  hashPassword,
  hashRefreshToken,
  hashResetToken,
  otpExpiresAt,
  verifyOtpCode,
  verifyPassword,
} from './crypto.js';
import { signAccessToken } from './tokens.js';
import type { AuthUser, AuthTokens } from '@project-braids/shared-types/api';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';

function toAuthUser(user: {
  id: string;
  role: UserRole;
  phoneNumber: string;
  email: string | null;
  phoneVerifiedAt: Date | null;
  emailVerifiedAt: Date | null;
}): AuthUser {
  return {
    id: user.id,
    role: user.role,
    phoneNumber: user.phoneNumber,
    email: user.email,
    phoneVerified: user.phoneVerifiedAt !== null,
    emailVerified: user.emailVerifiedAt !== null,
  };
}

function refreshExpiryDate(): Date {
  const env = getEnv();
  return new Date(Date.now() + env.JWT_REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}

function syntheticOAuthPhone(provider: string, providerAccountId: string): string {
  const digest = createHash('sha256').update(`${provider}:${providerAccountId}`).digest('hex');
  const digits = digest.replace(/\D/g, '').slice(0, 9).padEnd(9, '0');
  return `+447${digits}`;
}

export class IdentityService {
  async registerStylist(input: {
    phoneNumber: string;
    email: string;
    password: string;
  }): Promise<{ userId: string; otpPurpose: OtpPurpose }> {
    const existingPhone = await prisma.user.findUnique({
      where: { phoneNumber: input.phoneNumber },
    });
    if (existingPhone) {
      if (existingPhone.phoneVerifiedAt) {
        throw new ApiError('CONFLICT', 'This phone number is already registered.', 409);
      }
      await this.sendOtp({
        phoneNumber: input.phoneNumber,
        purpose: 'phone_verify',
        userId: existingPhone.id,
      });
      return { userId: existingPhone.id, otpPurpose: 'phone_verify' };
    }

    const existingEmail = await prisma.user.findUnique({ where: { email: input.email } });
    if (existingEmail) {
      throw new ApiError('CONFLICT', 'This email is already registered.', 409);
    }

    const user = await prisma.user.create({
      data: {
        role: 'stylist_owner',
        phoneNumber: input.phoneNumber,
        email: input.email,
        passwordHash: await hashPassword(input.password),
      },
    });

    await this.sendOtp({
      phoneNumber: input.phoneNumber,
      purpose: 'phone_verify',
      userId: user.id,
    });

    return { userId: user.id, otpPurpose: 'phone_verify' };
  }

  async registerClient(input: {
    phoneNumber: string;
  }): Promise<{ otpPurpose: OtpPurpose }> {
    const existing = await prisma.user.findUnique({
      where: { phoneNumber: input.phoneNumber },
    });

    const purpose: OtpPurpose = existing ? 'login' : 'phone_verify';
    await this.sendOtp({
      phoneNumber: input.phoneNumber,
      purpose,
      userId: existing?.id,
    });

    return { otpPurpose: purpose };
  }

  /** Lightweight client record for SMS ingress (Ch.11) — no OTP sent. */
  async findOrCreateClientByPhone(
    phoneNumber: string,
  ): Promise<{ userId: string; created: boolean }> {
    const existing = await prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (existing) {
      if (existing.role !== 'client') {
        throw new ApiError('CONFLICT', 'Phone number belongs to a non-client account', 409);
      }
      return { userId: existing.id, created: false };
    }

    const user = await prisma.user.create({
      data: {
        role: 'client',
        phoneNumber,
      },
    });

    return { userId: user.id, created: true };
  }

  async login(input: {
    email?: string;
    phoneNumber?: string;
    password: string;
    deviceMetadata?: Record<string, unknown>;
  }): Promise<{ user: AuthUser; tokens: AuthTokens; refreshToken: string }> {
    const loginKey = input.email
      ? buildRateLimitKey('login-email', normalizeEmail(input.email))
      : buildRateLimitKey('login-phone', normalizePhoneNumber(input.phoneNumber!));

    await assertRateLimit(
      loginKey,
      AUTH_RATE_LIMITS.LOGIN.limit,
      AUTH_RATE_LIMITS.LOGIN.windowMs,
      'Too many login attempts. Try again later.',
    );

    const user = input.email
      ? await prisma.user.findUnique({ where: { email: normalizeEmail(input.email) } })
      : await prisma.user.findUnique({ where: { phoneNumber: normalizePhoneNumber(input.phoneNumber!) } });

    if (!user || !user.passwordHash || user.deactivatedAt) {
      throw new ApiError('UNAUTHORIZED', 'Invalid credentials', 401);
    }

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      throw new ApiError('UNAUTHORIZED', 'Invalid credentials', 401);
    }

    if (!user.phoneVerifiedAt) {
      throw new ApiError('FORBIDDEN', 'Phone number not verified', 403);
    }

    return this.issueSession(user, input.deviceMetadata);
  }

  async sendOtp(input: {
    phoneNumber: string;
    purpose: OtpPurpose;
    userId?: string;
  }): Promise<{ expiresInSeconds: number }> {
    await assertRateLimit(
      buildRateLimitKey('otp', normalizePhoneNumber(input.phoneNumber)),
      AUTH_RATE_LIMITS.OTP_REQUEST.limit,
      AUTH_RATE_LIMITS.OTP_REQUEST.windowMs,
      'Too many OTP requests. Try again later.',
    );

    const code = generateOtpCode();
    const expiresAt = otpExpiresAt();

    await prisma.otpChallenge.create({
      data: {
        phoneNumber: input.phoneNumber,
        purpose: input.purpose,
        codeHash: hashOtpCode(code),
        expiresAt,
        userId: input.userId,
      },
    });

    const env = getEnv();

    await getSmsProvider().send({
      to: input.phoneNumber,
      body: `Your ${env.PLATFORM_DISPLAY_NAME} verification code is ${code}. It expires in 5 minutes.`,
    });

    return { expiresInSeconds: 300 };
  }

  async verifyOtp(input: {
    phoneNumber: string;
    code: string;
    purpose: OtpPurpose;
    deviceMetadata?: Record<string, unknown>;
  }): Promise<{ user: AuthUser; tokens: AuthTokens; refreshToken: string } | { verified: true }> {
    const challenge = await prisma.otpChallenge.findFirst({
      where: {
        phoneNumber: input.phoneNumber,
        purpose: input.purpose,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) {
      throw new ApiError('UNAUTHORIZED', 'Invalid or expired OTP', 401);
    }

    if (challenge.consumedAt) {
      throw new ApiError('CONFLICT', 'Verification code already used', 409, {
        reason: 'OTP_ALREADY_CONSUMED',
      });
    }

    if (challenge.expiresAt <= new Date()) {
      throw new ApiError('UNAUTHORIZED', 'Verification code expired', 401, { reason: 'OTP_EXPIRED' });
    }

    if (challenge.attempts >= 5) {
      throw new ApiError('RATE_LIMITED', 'Too many invalid OTP attempts', 429);
    }

    if (!verifyOtpCode(input.code, challenge.codeHash)) {
      await prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new ApiError('UNAUTHORIZED', 'Invalid or expired OTP', 401);
    }

    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });

    let user = challenge.userId
      ? await prisma.user.findUnique({ where: { id: challenge.userId } })
      : await prisma.user.findUnique({ where: { phoneNumber: input.phoneNumber } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          role: 'client',
          phoneNumber: input.phoneNumber,
          phoneVerifiedAt: new Date(),
        },
      });
    } else if (!user.phoneVerifiedAt) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { phoneVerifiedAt: new Date() },
      });
    }

    if (input.purpose === 'password_reset') {
      return { verified: true };
    }

    return this.issueSession(user, input.deviceMetadata);
  }

  async refreshSession(input: {
    refreshToken: string;
    deviceMetadata?: Record<string, unknown>;
  }): Promise<{ user: AuthUser; tokens: AuthTokens; refreshToken: string }> {
    const tokenHash = hashRefreshToken(input.refreshToken);
    const session = await prisma.session.findFirst({
      where: {
        refreshTokenHash: tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!session || session.user.deactivatedAt) {
      throw new ApiError('UNAUTHORIZED', 'Invalid refresh token', 401);
    }

    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    return this.issueSession(session.user, input.deviceMetadata, session.familyId);
  }

  async detectRefreshTokenReuse(refreshToken: string): Promise<void> {
    const tokenHash = hashRefreshToken(refreshToken);
    const session = await prisma.session.findFirst({
      where: { refreshTokenHash: tokenHash },
    });

    if (session && session.revokedAt) {
      await prisma.session.updateMany({
        where: { familyId: session.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new ApiError('UNAUTHORIZED', 'Refresh token reuse detected', 401);
    }
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashRefreshToken(refreshToken);
    await prisma.session.updateMany({
      where: { refreshTokenHash: tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getUserById(userId: string): Promise<AuthUser | null> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deactivatedAt) return null;
    return toAuthUser(user);
  }

  async loginWithGoogle(input: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
    deviceMetadata?: Record<string, unknown>;
  }): Promise<{ user: AuthUser; tokens: AuthTokens; refreshToken: string }> {
    const env = getEnv();
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw ApiError.serviceUnavailable('Google OAuth is not configured');
    }

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: input.code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: input.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: input.codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      throw new ApiError('UNAUTHORIZED', 'Google OAuth exchange failed', 401);
    }

    const tokenJson = (await tokenResponse.json()) as {
      id_token?: string;
      access_token?: string;
      refresh_token?: string;
    };
    if (!tokenJson.id_token) {
      throw new ApiError('UNAUTHORIZED', 'Google OAuth exchange failed', 401);
    }

    const googleJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
    const { payload } = await jwtVerify(tokenJson.id_token, googleJwks, {
      audience: env.GOOGLE_CLIENT_ID,
    });

    const providerAccountId = payload.sub;
    const email = typeof payload.email === 'string' ? payload.email : undefined;
    if (!providerAccountId) {
      throw new ApiError('UNAUTHORIZED', 'Invalid Google token', 401);
    }

    return this.linkOAuthAndIssueSession({
      provider: 'google',
      providerAccountId,
      email,
      deviceMetadata: input.deviceMetadata,
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token,
    });
  }

  async loginWithApple(input: {
    idToken: string;
    nonce?: string;
    deviceMetadata?: Record<string, unknown>;
  }): Promise<{ user: AuthUser; tokens: AuthTokens; refreshToken: string }> {
    const env = getEnv();
    if (!env.APPLE_CLIENT_ID) {
      throw ApiError.serviceUnavailable('Apple OAuth is not configured');
    }

    const appleJwks = createRemoteJWKSet(new URL(APPLE_JWKS_URL));
    const { payload } = await jwtVerify(input.idToken, appleJwks, {
      audience: env.APPLE_CLIENT_ID,
    });

    const providerAccountId = payload.sub;
    const email = typeof payload.email === 'string' ? payload.email : undefined;
    if (!providerAccountId) {
      throw new ApiError('UNAUTHORIZED', 'Invalid Apple token', 401);
    }

    return this.linkOAuthAndIssueSession({
      provider: 'apple',
      providerAccountId,
      email,
      deviceMetadata: input.deviceMetadata,
    });
  }

  async requestPasswordReset(email: string): Promise<void> {
    await assertRateLimit(
      buildRateLimitKey('password-reset', normalizeEmail(email)),
      AUTH_RATE_LIMITS.PASSWORD_RESET.limit,
      AUTH_RATE_LIMITS.PASSWORD_RESET.windowMs,
      'Too many password reset requests. Try again later.',
    );

    const user = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
    if (!user || user.deactivatedAt) {
      return;
    }

    const token = generateResetToken();
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS);

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashResetToken(token),
        expiresAt,
      },
    });

    const env = getEnv();
    const resetUrl = `${env.WEB_APP_URL}/reset-password?token=${token}`;

    await getEmailProvider().send({
      to: normalizeEmail(email),
      subject: `${env.PLATFORM_DISPLAY_NAME} password reset`,
      body: `Reset your password: ${resetUrl}`,
    });
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const tokenHash = hashResetToken(token);
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!resetToken) {
      throw new ApiError('UNAUTHORIZED', 'Invalid or expired reset token', 401);
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash: await hashPassword(password) },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { consumedAt: new Date() },
      }),
      prisma.session.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async requestPhoneNumberChange(input: {
    userId: string;
    requestedPhoneNumber: string;
  }): Promise<{ requestId: string }> {
    const phoneTaken = await prisma.user.findUnique({
      where: { phoneNumber: input.requestedPhoneNumber },
    });
    if (phoneTaken) {
      throw new ApiError('CONFLICT', 'That phone number is already in use.', 409);
    }

    const request = await prisma.phoneNumberChangeRequest.create({
      data: {
        userId: input.userId,
        requestedPhoneNumber: input.requestedPhoneNumber,
      },
    });

    return { requestId: request.id };
  }

  /**
   * Admin approval for phone changes — route exposed in Ch.19 Admin Panel.
   * TODO(Ch.19): wire to admin-only HTTP route with requireAdmin guard.
   */
  async approvePhoneChangeRequest(requestId: string, adminUserId: string): Promise<void> {
    const changeRequest = await prisma.phoneNumberChangeRequest.findUnique({
      where: { id: requestId },
    });

    if (!changeRequest || changeRequest.status !== 'pending') {
      throw ApiError.notFound('Phone change request not found or already resolved');
    }

    const phoneTaken = await prisma.user.findUnique({
      where: { phoneNumber: changeRequest.requestedPhoneNumber },
    });
    if (phoneTaken && phoneTaken.id !== changeRequest.userId) {
      throw new ApiError('CONFLICT', 'Requested phone number is no longer available.', 409);
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: changeRequest.userId },
        data: {
          phoneNumber: changeRequest.requestedPhoneNumber,
          phoneVerifiedAt: new Date(),
        },
      }),
      prisma.phoneNumberChangeRequest.update({
        where: { id: requestId },
        data: {
          status: 'approved',
          resolvedAt: new Date(),
          resolvedById: adminUserId,
        },
      }),
    ]);
  }

  async requestAccountRecovery(input: {
    email: string;
    phoneNumber?: string;
    reason: string;
  }): Promise<{ requestId: string }> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });

    const request = await prisma.accountRecoveryRequest.create({
      data: {
        userId: user?.id,
        email: input.email,
        phoneNumber: input.phoneNumber,
        reason: input.reason,
      },
    });

    return { requestId: request.id };
  }

  private async linkOAuthAndIssueSession(input: {
    provider: string;
    providerAccountId: string;
    email?: string;
    deviceMetadata?: Record<string, unknown>;
    accessToken?: string;
    refreshToken?: string;
  }): Promise<{ user: AuthUser; tokens: AuthTokens; refreshToken: string }> {
    const env = getEnv();
    const encryptToken = (value: string | undefined) =>
      value ? encryptAtRest(value, env.JWT_SECRET) : undefined;

    const oauthAccount = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: input.provider,
          providerAccountId: input.providerAccountId,
        },
      },
      include: { user: true },
    });

    if (oauthAccount) {
      if (input.accessToken || input.refreshToken) {
        await prisma.oAuthAccount.update({
          where: { id: oauthAccount.id },
          data: {
            accessTokenEnc: encryptToken(input.accessToken) ?? oauthAccount.accessTokenEnc,
            refreshTokenEnc: encryptToken(input.refreshToken) ?? oauthAccount.refreshTokenEnc,
          },
        });
      }
      return this.issueSession(oauthAccount.user, input.deviceMetadata);
    }

    if (input.email) {
      const existingByEmail = await prisma.user.findUnique({
        where: { email: normalizeEmail(input.email) },
      });
      if (existingByEmail) {
        await prisma.oAuthAccount.create({
          data: {
            userId: existingByEmail.id,
            provider: input.provider,
            providerAccountId: input.providerAccountId,
            accessTokenEnc: encryptToken(input.accessToken),
            refreshTokenEnc: encryptToken(input.refreshToken),
          },
        });
        return this.issueSession(existingByEmail, input.deviceMetadata);
      }
    }

    const newUser = await prisma.user.create({
      data: {
        role: 'stylist_owner',
        phoneNumber: syntheticOAuthPhone(input.provider, input.providerAccountId),
        email: input.email ? normalizeEmail(input.email) : null,
        emailVerifiedAt: input.email ? new Date() : null,
        oauthAccounts: {
          create: {
            provider: input.provider,
            providerAccountId: input.providerAccountId,
            accessTokenEnc: encryptToken(input.accessToken),
            refreshTokenEnc: encryptToken(input.refreshToken),
          },
        },
      },
    });

    return this.issueSession(newUser, input.deviceMetadata);
  }

  private async issueSession(
    user: {
      id: string;
      role: UserRole;
      phoneNumber: string;
      email: string | null;
      phoneVerifiedAt: Date | null;
      emailVerifiedAt: Date | null;
      deactivatedAt: Date | null;
    },
    deviceMetadata?: Record<string, unknown>,
    existingFamilyId?: string,
  ): Promise<{ user: AuthUser; tokens: AuthTokens; refreshToken: string }> {
    if (user.deactivatedAt) {
      throw new ApiError('UNAUTHORIZED', 'Account deactivated', 401);
    }

    const refreshToken = generateRefreshToken();
    const familyId = existingFamilyId ?? randomUUID();

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        familyId,
        refreshTokenHash: hashRefreshToken(refreshToken),
        expiresAt: refreshExpiryDate(),
        deviceMetadata: deviceMetadata as object | undefined,
      },
    });

    const access = await signAccessToken({
      userId: user.id,
      role: user.role,
      sessionId: session.id,
    });

    return {
      user: toAuthUser(user),
      tokens: {
        accessToken: access.token,
        expiresIn: access.expiresIn,
      },
      refreshToken,
    };
  }
}

export const identityService = new IdentityService();
