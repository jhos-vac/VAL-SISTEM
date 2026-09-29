"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card } from "@/components/ui/Card";
import { useAuthStore } from "@/store/auth-store";
import {
  fetchSettings,
  fetchSettingsCatalogs,
  updateProfile,
  updateSettings,
  type UserSettings,
} from "@/lib/users-client";

const profileSchema = z.object({
  firstName: z.string().min(2, "Mínimo 2 caracteres").max(80),
  lastName: z.string().min(2, "Mínimo 2 caracteres").max(80),
  username: z.string().min(3, "Mínimo 3 caracteres").max(30),
});
type ProfileValues = z.infer<typeof profileSchema>;

const preferencesSchema = z.object({
  language: z.string(),
  currency: z.string(),
  timezone: z.string(),
  theme: z.enum(["system", "light", "dark"]),
});
type PreferencesValues = z.infer<typeof preferencesSchema>;

// RFW-10: perfil, moneda base, idioma, tema, seguridad. Los toggles de
// seguridad (notificaciones/biometría/2FA) ya se guardan de verdad en
// el backend, pero todavía no tienen nada real detrás — push, biometría
// y 2FA de verdad son fases posteriores (ver
// Estado_Backend_VAL-BACKEND.md).
export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ["user-settings"],
    queryFn: fetchSettings,
  });
  const { data: catalogs, isLoading: loadingCatalogs } = useQuery({
    queryKey: ["settings-catalogs"],
    queryFn: fetchSettingsCatalogs,
  });

  const profileForm = useForm<ProfileValues>({ resolver: zodResolver(profileSchema) });
  useEffect(() => {
    if (user) {
      profileForm.reset({
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const preferencesForm = useForm<PreferencesValues>({ resolver: zodResolver(preferencesSchema) });
  useEffect(() => {
    if (settings) {
      preferencesForm.reset({
        language: settings.language,
        currency: settings.currency,
        timezone: settings.timezone,
        theme: settings.theme,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const profileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (updatedUser) => {
      // Refleja el cambio de nombre/usuario en el resto de la app (p.ej.
      // las iniciales del Topbar) sin forzar un refresh de sesión.
      if (accessToken) useAuthStore.getState().setSession(updatedUser, accessToken);
    },
  });

  const settingsMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: (updated) => {
      queryClient.setQueryData<UserSettings>(["user-settings"], updated);
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Ajustes</h1>

      <Card title="Perfil">
        <form
          onSubmit={profileForm.handleSubmit((values) => profileMutation.mutate(values))}
          className="grid max-w-md gap-3"
        >
          <label className="flex flex-col gap-1 text-sm">
            Nombre
            <input
              {...profileForm.register("firstName")}
              className="rounded-md border border-border-hairline bg-background px-3 py-2"
            />
            {profileForm.formState.errors.firstName ? (
              <span className="text-xs text-status-critical">
                {profileForm.formState.errors.firstName.message}
              </span>
            ) : null}
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Apellido
            <input
              {...profileForm.register("lastName")}
              className="rounded-md border border-border-hairline bg-background px-3 py-2"
            />
            {profileForm.formState.errors.lastName ? (
              <span className="text-xs text-status-critical">
                {profileForm.formState.errors.lastName.message}
              </span>
            ) : null}
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Usuario
            <input
              {...profileForm.register("username")}
              className="rounded-md border border-border-hairline bg-background px-3 py-2"
            />
            {profileForm.formState.errors.username ? (
              <span className="text-xs text-status-critical">
                {profileForm.formState.errors.username.message}
              </span>
            ) : null}
          </label>
          {profileMutation.isError ? (
            <p className="text-sm text-status-critical">No se pudo guardar el perfil.</p>
          ) : null}
          {profileMutation.isSuccess ? (
            <p className="text-sm text-status-good">Perfil actualizado.</p>
          ) : null}
          <button
            type="submit"
            disabled={profileMutation.isPending}
            className="mt-1 self-start rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Guardar perfil
          </button>
        </form>
      </Card>

      <Card title="Preferencias">
        {loadingSettings || loadingCatalogs ? (
          <p className="text-sm text-text-secondary">Cargando…</p>
        ) : (
          <form
            onSubmit={preferencesForm.handleSubmit((values) => settingsMutation.mutate(values))}
            className="grid max-w-md gap-3"
          >
            <label className="flex flex-col gap-1 text-sm">
              Idioma
              <select
                {...preferencesForm.register("language")}
                className="rounded-md border border-border-hairline bg-background px-3 py-2"
              >
                {catalogs?.languages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.nativeName}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Moneda base
              <select
                {...preferencesForm.register("currency")}
                className="rounded-md border border-border-hairline bg-background px-3 py-2"
              >
                {catalogs?.currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Zona horaria
              <select
                {...preferencesForm.register("timezone")}
                className="rounded-md border border-border-hairline bg-background px-3 py-2"
              >
                {catalogs?.timezones.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name} ({t.utcOffset})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Tema
              <select
                {...preferencesForm.register("theme")}
                className="rounded-md border border-border-hairline bg-background px-3 py-2"
              >
                <option value="system">Del sistema</option>
                <option value="light">Claro</option>
                <option value="dark">Oscuro</option>
              </select>
            </label>
            {settingsMutation.isError ? (
              <p className="text-sm text-status-critical">
                No se pudieron guardar las preferencias.
              </p>
            ) : null}
            {settingsMutation.isSuccess ? (
              <p className="text-sm text-status-good">Preferencias actualizadas.</p>
            ) : null}
            <button
              type="submit"
              disabled={settingsMutation.isPending}
              className="mt-1 self-start rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Guardar preferencias
            </button>
          </form>
        )}
      </Card>

      <Card title="Seguridad">
        {loadingSettings ? (
          <p className="text-sm text-text-secondary">Cargando…</p>
        ) : (
          <div className="flex max-w-md flex-col gap-3">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                Notificaciones
                <span className="block text-xs text-text-muted">
                  Alertas de precio y actividad de tu cuenta.
                </span>
              </span>
              <input
                type="checkbox"
                defaultChecked={settings?.notificationsEnabled ?? true}
                onChange={(e) =>
                  settingsMutation.mutate({ notificationsEnabled: e.target.checked })
                }
                className="h-4 w-4"
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                Biometría
                <span className="block text-xs text-text-muted">
                  Solo aplica en la app móvil.
                </span>
              </span>
              <input
                type="checkbox"
                defaultChecked={settings?.biometricEnabled ?? false}
                onChange={(e) =>
                  settingsMutation.mutate({ biometricEnabled: e.target.checked })
                }
                className="h-4 w-4"
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                Verificación en dos pasos
                <span className="block text-xs text-text-muted">Todavía no implementada.</span>
              </span>
              <input
                type="checkbox"
                defaultChecked={settings?.twoFactorEnabled ?? false}
                onChange={(e) =>
                  settingsMutation.mutate({ twoFactorEnabled: e.target.checked })
                }
                className="h-4 w-4"
              />
            </label>
          </div>
        )}
      </Card>
    </div>
  );
}
