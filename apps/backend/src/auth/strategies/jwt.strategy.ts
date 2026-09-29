import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthenticatedUser } from '../types/authenticated-user';

interface AccessTokenPayload {
  sub: string;
  email: string;
  roles?: string[];
}

// Valida el access token (Authorization: Bearer). A propósito NO vuelve a
// consultar la base de datos en cada request — el access token vive poco
// (ver JWT_ACCESS_EXPIRES_IN) y eso acota el riesgo de un usuario
// desactivado que siga usando un token ya emitido. El refresh (que sí es
// de larga duración) se valida contra la base en AuthService.refresh().
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  validate(payload: AccessTokenPayload): AuthenticatedUser {
    return {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles ?? [],
    };
  }
}
