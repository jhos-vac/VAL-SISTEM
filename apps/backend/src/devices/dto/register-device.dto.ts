import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

const PLATFORMS = ['ios', 'android', 'web'] as const;

export class RegisterDeviceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  deviceName: string;

  @IsIn(PLATFORMS)
  platform: (typeof PLATFORMS)[number];

  @IsString()
  @MaxLength(60)
  os: string;

  @IsString()
  @MaxLength(30)
  appVersion: string;

  // Token de push (Expo/FCM/APNs) — todavía no se envían notificaciones
  // de verdad (eso es Automation/fase posterior), esto solo deja el
  // dispositivo registrado y listo para cuando exista ese envío.
  @IsString()
  @MinLength(10)
  pushToken: string;
}
