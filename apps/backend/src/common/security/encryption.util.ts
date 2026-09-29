// Cifrado simétrico (AES-256-GCM) para credenciales de exchange
// (ExchangeAccount.apiKey/apiSecret) — nunca se guardan en texto plano.
// La clave vive solo en EXCHANGE_CREDENTIALS_KEY (.env del backend),
// nunca en el frontend ni en la base de datos.
//
// Generar una clave nueva:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12; // recomendado por Node para GCM

function getKey(): Buffer {
  const raw = process.env.EXCHANGE_CREDENTIALS_KEY;
  if (!raw) {
    throw new Error(
      'Falta EXCHANGE_CREDENTIALS_KEY en el .env del backend — es obligatoria para cifrar/descifrar credenciales de exchange.',
    );
  }
  const key = Buffer.from(raw, 'hex');
  if (key.length !== 32) {
    throw new Error(
      'EXCHANGE_CREDENTIALS_KEY debe ser una cadena hex de 64 caracteres (32 bytes). Generá una con: ' +
        `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
    );
  }
  return key;
}

// Formato guardado: "<iv>:<authTag>:<ciphertext>", todo en hex, para que
// entre en una sola columna String sin tocar el schema.
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

export function decryptSecret(payload: string): string {
  const key = getKey();
  const [ivHex, authTagHex, ciphertextHex] = payload.split(':');
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error('Formato de credencial cifrada inválido.');
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, 'hex')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}
