import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Envío de email vía la API HTTP de Resend (https://resend.com) — se
// eligió por tener una API REST simple (un solo POST con fetch, sin SDK
// nuevo que instalar: instalar paquetes nuevos en este proyecto puede
// colgarse largo rato, ver el comentario de BinanceTickerSyncService
// sobre @nestjs/schedule) y un plan gratis que alcanza de sobra para el
// volumen de un MVP.
//
// Sin RESEND_API_KEY configurada (caso por defecto en desarrollo, ver
// .env.example), no se manda nada de verdad: se loguea el link para
// poder probar el flujo completo igual, sin depender de una cuenta de
// Resend todavía. Para activar el envío real: crear una cuenta en
// resend.com, generar una API key, y ponerla en RESEND_API_KEY.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from =
      this.config.get<string>('EMAIL_FROM') ??
      'VAL-SISTEM <onboarding@resend.dev>';

    if (!apiKey) {
      this.logger.log(
        `[dev, sin RESEND_API_KEY] Email de recuperación para ${to}: ${resetLink}`,
      );
      return;
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to,
          subject: 'Recuperación de contraseña — VAL-SISTEM',
          html: `<p>Recibimos una solicitud para restablecer tu contraseña en VAL-SISTEM.</p><p><a href="${resetLink}">Hacé clic acá para elegir una nueva contraseña</a></p><p>Si no fuiste vos quien lo pidió, podés ignorar este correo — el enlace expira en 1 hora.</p>`,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.error(
          `Resend respondió ${res.status} al enviar el email de recuperación a ${to}: ${body}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Fallo de red al enviar el email de recuperación a ${to}`,
        err,
      );
    }
  }
}
