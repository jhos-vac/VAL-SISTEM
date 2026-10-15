// Cliente del panel de administración (/admin/*, solo rol admin).
import type {
  AdminHealth,
  AdminOverview,
  AdminPublicPortfolio,
  AdminUser,
  AdminUserPage,
  AdminUserStatus,
} from "@val-sistem/shared";
import { useAuthStore } from "@/store/auth-store";
import { requestWithAuth } from "./auth-client";

// Roles del access token (JWT). Solo decide qué se muestra: el backend
// vuelve a exigir el rol en cada endpoint.
export function rolesFromToken(token: string | null): string[] {
  if (!token) return [];
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const data = JSON.parse(atob(payload)) as { roles?: unknown };
    return Array.isArray(data.roles) ? data.roles.filter((r): r is string => typeof r === "string") : [];
  } catch {
    return [];
  }
}

export function useIsAdmin(): boolean {
  const token = useAuthStore((s) => s.accessToken);
  return rolesFromToken(token).includes("admin");
}

export const fetchAdminOverview = () => requestWithAuth<AdminOverview>("/admin/overview");

export function fetchAdminUsers(filters: {
  search?: string;
  status?: AdminUserStatus | "";
  page?: number;
}): Promise<AdminUserPage> {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.page) params.set("page", String(filters.page));
  return requestWithAuth<AdminUserPage>(`/admin/users?${params.toString()}`);
}

export const setAdminUserStatus = (id: string, status: AdminUserStatus) =>
  requestWithAuth<AdminUser>(`/admin/users/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

export const fetchAdminHealth = () => requestWithAuth<AdminHealth>("/admin/health");

export const fetchAdminPublicPortfolios = () =>
  requestWithAuth<AdminPublicPortfolio[]>("/admin/public-portfolios");

export const unpublishPortfolio = (id: string) =>
  requestWithAuth(`/admin/public-portfolios/${id}/unpublish`, { method: "POST" });
