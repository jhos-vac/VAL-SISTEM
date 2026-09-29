import { SetMetadata } from '@nestjs/common';

// Roles requeridos para un endpoint (RolesGuard los valida contra
// req.user.roles). Sin seed de roles/permisos todavía (ver Bitácora), así
// que hoy ningún endpoint lo usa en serio — queda listo para cuando el
// catálogo de roles exista.
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
