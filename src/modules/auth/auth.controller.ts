import {
  BadRequestException,
  Body,
  Controller,
  NotFoundException,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtRefreshGuard } from '@/guards';
import { CookieInterceptor, CookieClearInterceptor } from '@/interceptors';
import { Request } from 'express';
import { AuthDto } from './dto';
import { ConfigService } from '@/app/common';
import { RequestWithTokenPayload } from '@/shared/core/interfaces';
import { DeviceMeta } from '@/decorators';
import { DeviceInfo } from '@/shared/core/types';

@Controller('auth')
export class AuthController {
  private readonly refreshKey: string;
  private readonly deviceKey: string;

  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {
    this.refreshKey = this.config.get('JWT_REFRESH_TOKEN_COOKIE_KEY');
    this.deviceKey = this.config.get('COOKIE_DEVICE_KEY');
  }

  private getCookieValue(req: Request, key: string): string {
    const cookie = req.cookies[key];

    // if (!cookie) {
    //   throw new NotFoundException(`Cookie '${key}' не существует`);
    // }

    return cookie;
  }

  private checkActiveSession(req: Request) {
    const sessionToken = this.getCookieValue(req, this.refreshKey);
    if (sessionToken) {
      throw new BadRequestException('Уже есть активная сессия на этом устройстве!');
    }
  }

  @Post('info')
  async deviceInfo(@DeviceMeta() meta: DeviceInfo) {
    return meta;
  }

  @Post('signin')
  @UseInterceptors(CookieInterceptor)
  async signIn(@Req() req: Request, @Body() data: AuthDto, @DeviceMeta() meta: DeviceInfo) {
    this.checkActiveSession(req);

    return await this.authService.singIn(data, meta);
  }

  @Post('signout')
  @UseInterceptors(CookieClearInterceptor)
  async signOut(@Req() req: Request) {
    const encryptedDeviceId = this.getCookieValue(req, this.deviceKey);

    return await this.authService.signOut(encryptedDeviceId);
  }

  @Post('signout-all')
  @UseGuards(JwtRefreshGuard)
  @UseInterceptors(CookieClearInterceptor)
  async signOutAll(@Req() { user }: RequestWithTokenPayload) {
    return await this.authService.signOutAll(user.sid);
  }

  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  @UseInterceptors(CookieInterceptor)
  async refresh(@Req() req: RequestWithTokenPayload, @DeviceMeta() meta: DeviceInfo) {
    const encryptedDeviceId = this.getCookieValue(req, this.deviceKey);
    const token = this.getCookieValue(req, this.refreshKey);
    const accountId = req.user.sub;

    return await this.authService.refresh(encryptedDeviceId, token, accountId, meta);
  }
}
