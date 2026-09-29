// Cliente de los módulos /users de VAL-BACKEND (perfil básico y ajustes,
// ver src/users/*.controller.ts en el backend). Todo requiere sesión.

import { requestWithAuth } from "./auth-client";
import type { User } from "@val-sistem/shared";

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  username?: string;
}

export function updateProfile(input: UpdateProfileInput): Promise<User> {
  return requestWithAuth<User>("/users/me", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export type ThemePreference = "system" | "light" | "dark";

export interface UserSettings {
  language: string;
  currency: string;
  timezone: string;
  theme: ThemePreference;
  notificationsEnabled: boolean;
  biometricEnabled: boolean;
  twoFactorEnabled: boolean;
}

export interface UpdateSettingsInput {
  language?: string;
  currency?: string;
  timezone?: string;
  theme?: ThemePreference;
  notificationsEnabled?: boolean;
  biometricEnabled?: boolean;
  twoFactorEnabled?: boolean;
}

export interface SettingsCatalogs {
  languages: Array<{ code: string; name: string; nativeName: string }>;
  currencies: Array<{ code: string; symbol: string; name: string }>;
  timezones: Array<{ name: string; utcOffset: string }>;
}

export function fetchSettings(): Promise<UserSettings> {
  return requestWithAuth<UserSettings>("/users/me/settings");
}

export function updateSettings(input: UpdateSettingsInput): Promise<UserSettings> {
  return requestWithAuth<UserSettings>("/users/me/settings", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function fetchSettingsCatalogs(): Promise<SettingsCatalogs> {
  return requestWithAuth<SettingsCatalogs>("/users/settings/catalogs");
}
