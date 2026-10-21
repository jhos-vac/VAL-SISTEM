import { Injectable, Logger } from '@nestjs/common';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH = 100; // Expo acepta hasta 100 mensajes por pedido.

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

// Envío de notificaciones push por el servicio de Expo (los tokens los
// registra la app móvil en /devices). Devuelve los tokens que Expo dice que
// ya no existen, para borrarlos.
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  async send(messages: PushMessage[]): Promise<{ invalidTokens: string[] }> {
    const invalidTokens: string[] = [];
    const valid = messages.filter((m) =>
      /^Expo(nent)?PushToken\[.+\]$/.test(m.to),
    );
    for (let i = 0; i < valid.length; i += BATCH) {
      const batch = valid.slice(i, i + BATCH);
      try {
        const res = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(batch.map((m) => ({ ...m, sound: 'default' }))),
        });
        if (!res.ok) {
          this.logger.warn(`Expo push respondió ${res.status}`);
          continue;
        }
        const body = (await res.json()) as {
          data?: Array<{ status: string; details?: { error?: string } }>;
        };
        (body.data ?? []).forEach((ticket, j) => {
          if (
            ticket.status === 'error' &&
            ticket.details?.error === 'DeviceNotRegistered'
          ) {
            invalidTokens.push(batch[j].to);
          }
        });
      } catch (err) {
        // Un fallo de push nunca rompe la evaluación: el aviso ya quedó en
        // el centro de notificaciones.
        this.logger.warn(
          `No se pudo enviar push: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return { invalidTokens };
  }
}
