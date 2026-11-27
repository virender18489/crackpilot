import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  KeyRound,
  Lock,
  LogOut,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  X,
  Zap,
} from "lucide-react";
import { apiUrl } from "../lib/api";
import { probeBackendHealth } from "../lib/clientStore";
import type {
  AccountStatus,
  AdminAccountRecord,
  AdminDashboardStats,
  PaymentStatus,
  PlanType,
  UserAccount,
} from "../types";

interface AdminPanelProps {
  currentUser: UserAccount | null;
  onRedirectDashboard: () => void;
  onGoHome: () => void;
}

interface AdminAuthStatusResponse {
  authenticated: boolean;
  subject: string | null;
  envConfigured: boolean;
  claimedConfigured: boolean;
  setupRequired: boolean;
  configuredIdentifierHint: string | null;
  suggestedOwnerEmail?: string;
}

interface GeneratedCredentialBanner {
  label: string;
  email: string;
  password: string;
  token: string;
  planType: PlanType;
  minutes: number;
  captureLimit: number;
  isDemo: boolean;
}

type FilterTab = "all" | "paid" | "pending" | "demo" | "expired";

const OWNER_ADMIN_EMAIL = "virender18489@gmail.com";
const LOCAL_ADMIN_STORE_KEY = "crackpilot_admin_accounts_local_v1";

function isOwnerUserEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === OWNER_ADMIN_EMAIL;
}

function randomHex(len: number): string {
  const chars = "0123456789ABCDEF";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function generateLocalToken(): string {
  return `CP-${randomHex(6)}-${randomHex(6)}-${randomHex(4)}`;
}

function computeLocalStats(records: AdminAccountRecord[]): AdminDashboardStats {
  return {
    totalUsers: records.length,
    activeDemoIds: records.filter(
      (a) => a.accountType === "DEMO" && a.status === "Active"
    ).length,
    totalPaidAccounts: records.filter((a) => a.paymentStatus === "Paid").length,
    totalMinutesAllocated: records.reduce(
      (sum, a) => sum + Math.round(a.remainingSeconds / 60),
      0
    ),
  };
}

function readLocalAdminRecords(): AdminAccountRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_ADMIN_STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AdminAccountRecord[]) : [];
  } catch {
    return [];
  }
}

function writeLocalAdminRecords(records: AdminAccountRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_ADMIN_STORE_KEY, JSON.stringify(records));
  } catch {
    // Ignore storage quota errors
  }
}

export function AdminPanel({
  currentUser,
  onRedirectDashboard,
  onGoHome,
}: AdminPanelProps) {
  // Auth & backend mode state
  const [authLoading, setAuthLoading] = useState(true);
  const [backendAvailable, setBackendAvailable] = useState(true);
  const [authStatus, setAuthStatus] = useState<AdminAuthStatusResponse | null>(
    null
  );
  const [authenticated, setAuthenticated] = useState(false);
  const [adminSubject, setAdminSubject] = useState<string | null>(null);
  const [redirectingNonAdmin, setRedirectingNonAdmin] = useState(false);

  // Login / First-run setup form
  const [identifierInput, setIdentifierInput] = useState(OWNER_ADMIN_EMAIL);
  const [passwordInput, setPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Accounts & filters
  const [accounts, setAccounts] = useState<AdminAccountRecord[]>([]);
  const [stats, setStats] = useState<AdminDashboardStats>({
    totalUsers: 0,
    activeDemoIds: 0,
    totalPaidAccounts: 0,
    totalMinutesAllocated: 0,
  });
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Generated credentials callout (after Create User or Create Demo)
  const [generatedCreds, setGeneratedCreds] =
    useState<GeneratedCredentialBanner | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 1-Click Demo ID Generator controls
  const [demoLabel, setDemoLabel] = useState("");
  const [demoMinutes, setDemoMinutes] = useState<number>(30);
  const [demoCaptures, setDemoCaptures] = useState<number>(15);
  const [demoExpiryHours, setDemoExpiryHours] = useState<number>(24);
  const [creatingDemo, setCreatingDemo] = useState(false);

  // Create New User ID Modal state
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserPlan, setNewUserPlan] = useState<PlanType>("Pro Plan");
  const [newUserMinutes, setNewUserMinutes] = useState<number>(240);
  const [newUserCaptures, setNewUserCaptures] = useState<number>(80);
  const [newUserPayment, setNewUserPayment] = useState<PaymentStatus>("Paid");
  const [creatingUser, setCreatingUser] = useState(false);

  // Inline Edit Quotas modal / row custom adjustments & delete confirm
  const [quotaModalAccount, setQuotaModalAccount] =
    useState<AdminAccountRecord | null>(null);
  const [customMinutesDelta, setCustomMinutesDelta] = useState<string>("60");
  const [customCapturesDelta, setCustomCapturesDelta] = useState<string>("20");
  const [busyToken, setBusyToken] = useState<string | null>(null);
  const [confirmDeleteToken, setConfirmDeleteToken] = useState<string | null>(
    null
  );

  const adminHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      "X-Requested-With": "CrackpilotAdmin",
    }),
    []
  );

  const copyText = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((curr) => (curr === key ? null : curr));
      }, 1600);
    } catch {
      // Ignore clipboard permission errors
    }
  };

  // Load accounts from server (or local fallback if static hosting)
  const fetchAccounts = useCallback(
    async (opts?: { search?: string; filter?: FilterTab }) => {
      const q = opts?.search ?? searchQuery;
      const f = opts?.filter ?? activeFilter;
      setLoadingAccounts(true);
      setErrorNotice(null);

      if (!backendAvailable) {
        const all = readLocalAdminRecords();
        const lower = q.trim().toLowerCase();
        const filtered = all.filter((acc) => {
          if (f === "paid" && acc.paymentStatus !== "Paid") return false;
          if (f === "pending" && acc.paymentStatus !== "Pending") return false;
          if (f === "demo" && acc.accountType !== "DEMO") return false;
          if (
            f === "expired" &&
            acc.status !== "Expired" &&
            acc.status !== "Suspended"
          ) {
            return false;
          }
          if (lower) {
            const hay =
              `${acc.token} ${acc.label} ${acc.email} ${acc.planType} ${acc.paymentStatus} ${acc.status}`.toLowerCase();
            if (!hay.includes(lower)) return false;
          }
          return true;
        });
        setAccounts(filtered);
        setStats(computeLocalStats(all));
        setLoadingAccounts(false);
        return;
      }

      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("search", q.trim());
        params.set("filter", f);

        const resp = await fetch(
          apiUrl(`/api/admin/accounts?${params.toString()}`),
          {
            credentials: "include",
            headers: { "X-Requested-With": "CrackpilotAdmin" },
            cache: "no-store",
          }
        );

        if (resp.status === 401) {
          setAuthenticated(false);
          setAdminSubject(null);
          setAuthError("Admin session expired. Sign in again.");
          return;
        }

        const data = (await resp.json()) as {
          ok?: boolean;
          accounts?: AdminAccountRecord[];
          stats?: AdminDashboardStats;
          error?: string;
        };

        if (!resp.ok || !data.ok) {
          throw new Error(data.error || "Failed to load admin accounts.");
        }

        setAccounts(data.accounts || []);
        if (data.stats) setStats(data.stats);
      } catch (err) {
        setErrorNotice(
          err instanceof Error ? err.message : "Could not load accounts."
        );
      } finally {
        setLoadingAccounts(false);
      }
    },
    [activeFilter, backendAvailable, searchQuery]
  );

  // Initial auth probe & non-admin redirect guard
  useEffect(() => {
    let active = true;
    const init = async () => {
      setAuthLoading(true);
      const healthy = await probeBackendHealth(true);
      if (!active) return;

      if (!healthy) {
        setBackendAvailable(false);
        if (currentUser && !isOwnerUserEmail(currentUser.email)) {
          setRedirectingNonAdmin(true);
          setAuthLoading(false);
          window.setTimeout(() => onRedirectDashboard(), 700);
          return;
        }
        if (currentUser && isOwnerUserEmail(currentUser.email)) {
          setAuthenticated(true);
          setAdminSubject(currentUser.email);
        }
        setAuthLoading(false);
        return;
      }

      setBackendAvailable(true);
      try {
        const resp = await fetch(apiUrl("/api/admin/auth/status"), {
          credentials: "include",
          cache: "no-store",
        });
        const data = (await resp.json()) as AdminAuthStatusResponse;
        if (!active) return;
        setAuthStatus(data);

        if (data.authenticated) {
          setAuthenticated(true);
          setAdminSubject(data.subject);
        } else if (currentUser && !isOwnerUserEmail(currentUser.email)) {
          // Non-admin workspace user attempting to open /admin -> redirect back to /dashboard
          setRedirectingNonAdmin(true);
          window.setTimeout(() => onRedirectDashboard(), 700);
        }
      } catch (err) {
        console.error("[AdminPanel] Auth status probe failed:", err);
      } finally {
        if (active) setAuthLoading(false);
      }
    };

    void init();
    return () => {
      active = false;
    };
  }, [currentUser, onRedirectDashboard]);

  // Fetch accounts whenever authenticated, searchQuery, or filter changes
  useEffect(() => {
    if (!authenticated) return;
    const timer = window.setTimeout(() => {
      void fetchAccounts();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [authenticated, searchQuery, activeFilter, fetchAccounts]);

  // Admin sign-in or first-run setup claim
  const handleAdminAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!backendAvailable) {
      if (!isOwnerUserEmail(identifierInput)) {
        setAuthError(
          `Access denied. Only authorized admin accounts (${OWNER_ADMIN_EMAIL}) can open Admin Control Center.`
        );
        return;
      }
      if (passwordInput.trim().length < 6) {
        setAuthError("Enter your admin password (at least 6 characters).");
        return;
      }
      setAuthenticated(true);
      setAdminSubject(identifierInput.trim());
      return;
    }

    const isSetup = Boolean(authStatus?.setupRequired);
    if (isSetup && passwordInput !== confirmPasswordInput) {
      setAuthError("Passwords do not match.");
      return;
    }

    setAuthSubmitting(true);
    try {
      const endpoint = isSetup
        ? "/api/admin/auth/setup"
        : "/api/admin/auth/login";
      const resp = await fetch(apiUrl(endpoint), {
        method: "POST",
        credentials: "include",
        headers: adminHeaders,
        body: JSON.stringify({
          identifier: identifierInput.trim(),
          password: passwordInput,
        }),
      });

      const data = (await resp.json()) as {
        ok?: boolean;
        subject?: string;
        error?: string;
      };

      if (!resp.ok || !data.ok) {
        throw new Error(data.error || "Invalid Super-Admin credentials.");
      }

      setAuthenticated(true);
      setAdminSubject(data.subject || identifierInput.trim());
      setPasswordInput("");
      setConfirmPasswordInput("");
      setAuthStatus((prev) =>
        prev
          ? { ...prev, authenticated: true, setupRequired: false }
          : prev
      );
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : "Authentication failed."
      );
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleAdminLogout = async () => {
    if (backendAvailable) {
      try {
        await fetch(apiUrl("/api/admin/auth/logout"), {
          method: "POST",
          credentials: "include",
          headers: adminHeaders,
        });
      } catch {
        // Ignore network error during logout
      }
    }
    setAuthenticated(false);
    setAdminSubject(null);
    setAccounts([]);
    setGeneratedCreds(null);
  };

  // 1-Click Dummy / Demo ID creation
  const handleCreateDemoId = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingDemo(true);
    setErrorNotice(null);
    setBannerNotice(null);

    const resolvedLabel =
      demoLabel.trim() || `Live Demo #${randomHex(4)}`;
    const mins = Math.max(1, Number(demoMinutes) || 30);
    const caps = Math.max(1, Number(demoCaptures) || 15);
    const expHrs = Math.max(1, Number(demoExpiryHours) || 24);

    if (!backendAvailable) {
      const token = generateLocalToken();
      const email = `demo-${randomHex(6).toLowerCase()}@crackpilot.demo`;
      const password = `CP#${randomHex(8)}`;
      const record: AdminAccountRecord = {
        id: `acc-${randomHex(8).toLowerCase()}`,
        token,
        label: resolvedLabel,
        email,
        accountType: "DEMO",
        planType: "Demo",
        paymentStatus: "Pending",
        status: "Active",
        remainingSeconds: mins * 60,
        totalMinutesGranted: mins,
        capturesUsed: 0,
        captureLimit: caps,
        promptsUsed: 0,
        promptLimit: caps,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + expHrs * 3600 * 1000).toISOString(),
        lastActiveAt: null,
      };
      const next = [record, ...readLocalAdminRecords()];
      writeLocalAdminRecords(next);
      setGeneratedCreds({
        label: record.label,
        email: record.email,
        password,
        token: record.token,
        planType: "Demo",
        minutes: mins,
        captureLimit: caps,
        isDemo: true,
      });
      setDemoLabel("");
      setCreatingDemo(false);
      void fetchAccounts();
      return;
    }

    try {
      const resp = await fetch(apiUrl("/api/admin/accounts/demo"), {
        method: "POST",
        credentials: "include",
        headers: adminHeaders,
        body: JSON.stringify({
          label: resolvedLabel,
          accountType: "DEMO",
          minutes: mins,
          captureLimit: caps,
          expiryHours: expHrs,
        }),
      });
      const data = (await resp.json()) as {
        ok?: boolean;
        account?: AdminAccountRecord;
        generatedPassword?: string;
        error?: string;
      };
      if (!resp.ok || !data.ok || !data.account) {
        throw new Error(data.error || "Could not create Demo ID.");
      }

      setGeneratedCreds({
        label: data.account.label,
        email: data.account.email,
        password: data.generatedPassword || "(hidden)",
        token: data.account.token,
        planType: data.account.planType,
        minutes: Math.round(data.account.remainingSeconds / 60),
        captureLimit: data.account.captureLimit,
        isDemo: true,
      });
      setDemoLabel("");
      setBannerNotice(
        `Demo ID created for ${data.account.label} (${mins}m · ${caps} captures).`
      );
      await fetchAccounts();
    } catch (err) {
      setErrorNotice(
        err instanceof Error ? err.message : "Failed to create Demo ID."
      );
    } finally {
      setCreatingDemo(false);
    }
  };

  // Create New User ID Modal submit
  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim()) {
      setErrorNotice("Full Name is required.");
      return;
    }

    setCreatingUser(true);
    setErrorNotice(null);
    setBannerNotice(null);

    const mins = Math.max(1, Number(newUserMinutes) || 240);
    const caps = Math.max(1, Number(newUserCaptures) || 80);

    if (!backendAvailable) {
      const token = generateLocalToken();
      const email =
        newUserEmail.trim().toLowerCase() ||
        `user-${randomHex(6).toLowerCase()}@crackpilot.app`;
      const password = newUserPassword.trim() || `CP#${randomHex(8)}`;
      const isDemo = newUserPlan === "Demo";
      const record: AdminAccountRecord = {
        id: `acc-${randomHex(8).toLowerCase()}`,
        token,
        label: newUserName.trim(),
        email,
        accountType: isDemo ? "DEMO" : "REGULAR",
        planType: newUserPlan,
        paymentStatus: newUserPayment,
        status: "Active",
        remainingSeconds: mins * 60,
        totalMinutesGranted: mins,
        capturesUsed: 0,
        captureLimit: caps,
        promptsUsed: 0,
        promptLimit: caps,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
        lastActiveAt: null,
      };
      const next = [record, ...readLocalAdminRecords()];
      writeLocalAdminRecords(next);
      setGeneratedCreds({
        label: record.label,
        email: record.email,
        password,
        token: record.token,
        planType: record.planType,
        minutes: mins,
        captureLimit: caps,
        isDemo,
      });
      setShowCreateUserModal(false);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setCreatingUser(false);
      void fetchAccounts();
      return;
    }

    try {
      const resp = await fetch(apiUrl("/api/admin/accounts"), {
        method: "POST",
        credentials: "include",
        headers: adminHeaders,
        body: JSON.stringify({
          label: newUserName.trim(),
          email: newUserEmail.trim(),
          password: newUserPassword.trim(),
          planType: newUserPlan,
          paymentStatus: newUserPayment,
          minutes: mins,
          captureLimit: caps,
          expiryHours: 48,
        }),
      });

      const data = (await resp.json()) as {
        ok?: boolean;
        account?: AdminAccountRecord;
        generatedPassword?: string;
        error?: string;
      };

      if (!resp.ok || !data.ok || !data.account) {
        throw new Error(data.error || "Could not create user ID.");
      }

      setGeneratedCreds({
        label: data.account.label,
        email: data.account.email,
        password: data.generatedPassword || "(set)",
        token: data.account.token,
        planType: data.account.planType,
        minutes: Math.round(data.account.remainingSeconds / 60),
        captureLimit: data.account.captureLimit,
        isDemo: data.account.accountType === "DEMO",
      });
      setShowCreateUserModal(false);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setBannerNotice(
        `User "${data.account.label}" created with 48h token ${data.account.token}.`
      );
      await fetchAccounts();
    } catch (err) {
      setErrorNotice(
        err instanceof Error ? err.message : "Failed to create user."
      );
    } finally {
      setCreatingUser(false);
    }
  };

  // Inline quota mutation (+time, +captures, resetUsed)
  const handleAdjustQuotas = async (
    token: string,
    patch: {
      deltaMinutes?: number;
      deltaCaptures?: number;
      resetUsed?: boolean;
    },
    successLabel: string
  ) => {
    setBusyToken(token);
    setErrorNotice(null);

    if (!backendAvailable) {
      const all = readLocalAdminRecords().map((acc) => {
        if (acc.token !== token) return acc;
        const nextSec =
          typeof patch.deltaMinutes === "number"
            ? Math.max(0, acc.remainingSeconds + patch.deltaMinutes * 60)
            : acc.remainingSeconds;
        const nextCap =
          typeof patch.deltaCaptures === "number"
            ? Math.max(0, acc.captureLimit + patch.deltaCaptures)
            : acc.captureLimit;
        const nextPrompt =
          typeof patch.deltaCaptures === "number" && patch.deltaCaptures > 0
            ? Math.max(nextCap, acc.promptLimit + patch.deltaCaptures)
            : acc.promptLimit;
        return {
          ...acc,
          remainingSeconds: nextSec,
          captureLimit: nextCap,
          promptLimit: nextPrompt,
          capturesUsed: patch.resetUsed ? 0 : acc.capturesUsed,
          promptsUsed: patch.resetUsed ? 0 : acc.promptsUsed,
        };
      });
      writeLocalAdminRecords(all);
      setBannerNotice(successLabel);
      setBusyToken(null);
      await fetchAccounts();
      return;
    }

    try {
      const resp = await fetch(
        apiUrl(`/api/admin/accounts/${encodeURIComponent(token)}/quotas`),
        {
          method: "POST",
          credentials: "include",
          headers: adminHeaders,
          body: JSON.stringify(patch),
        }
      );
      const data = (await resp.json()) as {
        ok?: boolean;
        account?: AdminAccountRecord;
        error?: string;
      };
      if (!resp.ok || !data.ok) {
        throw new Error(data.error || "Quota update failed.");
      }
      if (quotaModalAccount && data.account && quotaModalAccount.token === token) {
        setQuotaModalAccount(data.account);
      }
      setBannerNotice(successLabel);
      await fetchAccounts();
    } catch (err) {
      setErrorNotice(
        err instanceof Error ? err.message : "Could not update quotas."
      );
    } finally {
      setBusyToken(null);
    }
  };

  // 1-Click Mark Payment Paid / Pending
  const handleTogglePayment = async (
    account: AdminAccountRecord,
    nextPayment: PaymentStatus
  ) => {
    setBusyToken(account.token);
    setErrorNotice(null);

    if (!backendAvailable) {
      const all = readLocalAdminRecords().map((acc) => {
        if (acc.token !== account.token) return acc;
        if (nextPayment === "Paid") {
          return {
            ...acc,
            paymentStatus: "Paid" as PaymentStatus,
            planType:
              acc.planType === "Starter" || acc.planType === "Demo"
                ? ("Pro Plan" as PlanType)
                : acc.planType,
            accountType: "REGULAR" as const,
            status: "Active" as AccountStatus,
            remainingSeconds: Math.max(acc.remainingSeconds, 240 * 60),
            captureLimit: Math.max(acc.captureLimit, 80),
            promptLimit: Math.max(acc.promptLimit, 80),
          };
        }
        return { ...acc, paymentStatus: "Pending" as PaymentStatus };
      });
      writeLocalAdminRecords(all);
      setBannerNotice(
        nextPayment === "Paid"
          ? `${account.label} marked PAID / PRO — credits unlocked.`
          : `${account.label} marked Pending.`
      );
      setBusyToken(null);
      await fetchAccounts();
      return;
    }

    try {
      const resp = await fetch(
        apiUrl(`/api/admin/accounts/${encodeURIComponent(account.token)}/payment`),
        {
          method: "PATCH",
          credentials: "include",
          headers: adminHeaders,
          body: JSON.stringify({ paymentStatus: nextPayment }),
        }
      );
      const data = (await resp.json()) as { ok?: boolean; error?: string };
      if (!resp.ok || !data.ok) {
        throw new Error(data.error || "Could not update payment status.");
      }
      setBannerNotice(
        nextPayment === "Paid"
          ? `${account.label} marked PAID / PRO — full credits unlocked.`
          : `${account.label} payment set to Pending.`
      );
      await fetchAccounts();
    } catch (err) {
      setErrorNotice(
        err instanceof Error ? err.message : "Payment status update failed."
      );
    } finally {
      setBusyToken(null);
    }
  };

  // Activate / Suspend toggle
  const handleUpdateStatus = async (
    account: AdminAccountRecord,
    status: AccountStatus
  ) => {
    setBusyToken(account.token);
    setErrorNotice(null);

    if (!backendAvailable) {
      const all = readLocalAdminRecords().map((acc) =>
        acc.token === account.token ? { ...acc, status } : acc
      );
      writeLocalAdminRecords(all);
      setBannerNotice(`${account.label} set to ${status}.`);
      setBusyToken(null);
      await fetchAccounts();
      return;
    }

    try {
      const resp = await fetch(
        apiUrl(`/api/admin/accounts/${encodeURIComponent(account.token)}/status`),
        {
          method: "PATCH",
          credentials: "include",
          headers: adminHeaders,
          body: JSON.stringify({ status }),
        }
      );
      const data = (await resp.json()) as { ok?: boolean; error?: string };
      if (!resp.ok || !data.ok) {
        throw new Error(data.error || "Status update failed.");
      }
      setBannerNotice(`${account.label} is now ${status}.`);
      await fetchAccounts();
    } catch (err) {
      setErrorNotice(
        err instanceof Error ? err.message : "Could not change status."
      );
    } finally {
      setBusyToken(null);
    }
  };

  // Delete / Revoke account
  const handleDeleteAccount = async (account: AdminAccountRecord) => {
    setBusyToken(account.token);
    setConfirmDeleteToken(null);
    setErrorNotice(null);

    if (!backendAvailable) {
      const all = readLocalAdminRecords().filter(
        (a) => a.token !== account.token
      );
      writeLocalAdminRecords(all);
      setBannerNotice(`Deleted ${account.label} (${account.token}).`);
      setBusyToken(null);
      await fetchAccounts();
      return;
    }

    try {
      const resp = await fetch(
        apiUrl(`/api/admin/accounts/${encodeURIComponent(account.token)}`),
        {
          method: "DELETE",
          credentials: "include",
          headers: adminHeaders,
        }
      );
      const data = (await resp.json()) as { ok?: boolean; error?: string };
      if (!resp.ok || !data.ok) {
        throw new Error(data.error || "Delete failed.");
      }
      setBannerNotice(`Revoked & deleted ${account.label} (${account.token}).`);
      await fetchAccounts();
    } catch (err) {
      setErrorNotice(
        err instanceof Error ? err.message : "Could not delete account."
      );
    } finally {
      setBusyToken(null);
    }
  };

  // Redirect screen for non-admin regular users
  if (redirectingNonAdmin) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-rose-500/30 bg-[#111111] p-7 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-bold text-white">
            Super Admin Access Required
          </h1>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Your signed-in account ({currentUser?.email}) does not have Super
            Admin permissions. Redirecting back to Workspace Dashboard...
          </p>
          <button
            type="button"
            onClick={onRedirectDashboard}
            className="inline-flex items-center justify-center rounded-lg bg-[#b4f416] px-4 py-2 text-xs font-bold text-[#0a0a0a] hover:bg-[#a2df12] cursor-pointer"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Initial loading
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <RefreshCw className="h-4 w-4 animate-spin text-[#b4f416]" />
          <span>Verifying Super Admin clearance...</span>
        </div>
      </div>
    );
  }

  // Super Admin Login / One-time First-Run Owner Setup Gate
  if (!authenticated) {
    const isSetup = Boolean(backendAvailable && authStatus?.setupRequired);

    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-5">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111111] p-7 shadow-2xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#b4f416] text-sm font-black text-[#0a0a0a]">
                C
              </span>
              <div>
                <h1 className="text-base font-bold tracking-tight text-white">
                  Crackpilot Admin Control Center
                </h1>
                <p className="font-mono text-[10px] uppercase tracking-wider text-[#b4f416]">
                  Owner-Only Super Admin Gate
                </p>
              </div>
            </div>
            <Lock className="h-4 w-4 text-zinc-500" />
          </div>

          {isSetup ? (
            <div className="rounded-xl border border-[#b4f416]/30 bg-[#b4f416]/[0.07] p-3.5 text-xs text-zinc-200 space-y-1">
              <p className="font-semibold text-[#b4f416]">
                One-Time Super Admin Setup
              </p>
              <p className="text-zinc-400 leading-relaxed">
                Set your owner password below to claim Super Admin access
                (salted scrypt hash), or configure{" "}
                <code className="font-mono text-zinc-200">ADMIN_EMAIL</code> and{" "}
                <code className="font-mono text-zinc-200">ADMIN_PASSWORD</code>{" "}
                in server secrets.
              </p>
            </div>
          ) : (
            <p className="text-xs text-zinc-400 leading-relaxed">
              Sign in with your Super Admin credentials
              {authStatus?.configuredIdentifierHint
                ? ` (${authStatus.configuredIdentifierHint})`
                : ""}{" "}
              to manage users, payment status, quotas, and live Demo IDs.
            </p>
          )}

          <form onSubmit={handleAdminAuthSubmit} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-zinc-300">
                Super Admin Email / Username
              </span>
              <input
                type="text"
                required
                value={identifierInput}
                onChange={(e) => setIdentifierInput(e.target.value)}
                placeholder={OWNER_ADMIN_EMAIL}
                className="w-full rounded-lg border border-white/10 bg-[#0a0a0a] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#b4f416] focus:outline-none"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-zinc-300">
                {isSetup ? "Create Super Admin Password (min 8 chars)" : "Password"}
              </span>
              <input
                type="password"
                required
                minLength={isSetup ? 8 : 1}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-lg border border-white/10 bg-[#0a0a0a] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#b4f416] focus:outline-none"
              />
            </label>

            {isSetup && (
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-zinc-300">
                  Confirm Password
                </span>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-lg border border-white/10 bg-[#0a0a0a] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#b4f416] focus:outline-none"
                />
              </label>
            )}

            {authError && (
              <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-300">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#b4f416] px-4 py-2.5 text-sm font-bold text-[#0a0a0a] hover:bg-[#a3e012] transition-colors cursor-pointer disabled:opacity-60"
            >
              <Shield className="h-4 w-4" />
              <span>
                {authSubmitting
                  ? "Verifying..."
                  : isSetup
                    ? "Claim Super Admin & Enter"
                    : "Sign In to Admin Control Center"}
              </span>
            </button>
          </form>

          <div className="flex items-center justify-between border-t border-white/[0.08] pt-4 text-xs">
            <button
              type="button"
              onClick={onGoHome}
              className="text-zinc-400 hover:text-white cursor-pointer"
            >
              ← Back to Website
            </button>
            <button
              type="button"
              onClick={onRedirectDashboard}
              className="text-zinc-400 hover:text-[#b4f416] cursor-pointer"
            >
              User Workspace →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // AUTHENTICATED SUPER ADMIN CONTROL CENTER
  // =========================================================================
  const filterTabs: Array<{ id: FilterTab; label: string }> = [
    { id: "all", label: "All Accounts" },
    { id: "paid", label: "Paid" },
    { id: "pending", label: "Pending" },
    { id: "demo", label: "Demo IDs" },
    { id: "expired", label: "Suspended / Expired" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Top Admin Header Bar */}
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#0a0a0a]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#b4f416] text-sm font-black text-[#0a0a0a]">
              C
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight text-white">
                  Crackpilot Admin Control Center
                </h1>
                <span className="rounded bg-[#b4f416]/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-[#b4f416]">
                  SUPER ADMIN
                </span>
              </div>
              <p className="font-mono text-[11px] text-zinc-400">
                Signed in as {adminSubject || OWNER_ADMIN_EMAIL}
                {!backendAvailable ? " · Local Preview Sync" : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCreateUserModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#b4f416] px-3.5 py-2 text-xs font-bold text-[#0a0a0a] hover:bg-[#a3e012] transition-colors cursor-pointer"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Create New User ID</span>
            </button>

            <button
              type="button"
              onClick={() => void fetchAccounts()}
              disabled={loadingAccounts}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-xs font-medium text-zinc-200 hover:border-white/25 cursor-pointer"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-[#b4f416] ${
                  loadingAccounts ? "animate-spin" : ""
                }`}
              />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={onRedirectDashboard}
              className="rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white cursor-pointer"
            >
              User Dashboard
            </button>

            <button
              type="button"
              onClick={() => void handleAdminLogout()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-xs font-semibold text-zinc-200 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300 transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-5 py-7">
        {/* 1. Admin Overview Stats Bar */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/[0.08] bg-[#111111] p-5 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Total Users</span>
              <Users className="h-4 w-4 text-[#b4f416]" />
            </div>
            <p className="text-3xl font-extrabold tabular-nums text-white">
              {stats.totalUsers}
            </p>
            <p className="text-[11px] text-zinc-500">
              Managed regular &amp; demo tokens
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#111111] p-5 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Active Demo IDs</span>
              <Sparkles className="h-4 w-4 text-[#b4f416]" />
            </div>
            <p className="text-3xl font-extrabold tabular-nums text-white">
              {stats.activeDemoIds}
            </p>
            <p className="text-[11px] text-zinc-500">
              Live temporary demo credentials
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#111111] p-5 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Total Paid Accounts</span>
              <CreditCard className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="text-3xl font-extrabold tabular-nums text-emerald-400">
              {stats.totalPaidAccounts}
            </p>
            <p className="text-[11px] text-zinc-500">
              Verified paid / Pro subscriptions
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#111111] p-5 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Session Minutes Allocated</span>
              <Clock className="h-4 w-4 text-[#b4f416]" />
            </div>
            <p className="text-3xl font-extrabold tabular-nums text-[#b4f416]">
              {stats.totalMinutesAllocated.toLocaleString()}m
            </p>
            <p className="text-[11px] text-zinc-500">
              Total remaining balance across users
            </p>
          </div>
        </section>

        {/* Generated Credentials Copy Banner (shown right after Create User / Create Demo ID) */}
        {generatedCreds && (
          <section className="rounded-2xl border border-[#b4f416]/45 bg-[#13190c] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-5 w-5 text-[#b4f416]" />
                <div>
                  <h2 className="text-sm font-bold text-white">
                    {generatedCreds.isDemo
                      ? "Live Demo ID Ready to Share"
                      : "New User Credentials Generated"}
                  </h2>
                  <p className="text-xs text-zinc-400">
                    {generatedCreds.label} · {generatedCreds.planType} ·{" "}
                    {generatedCreds.minutes} mins · {generatedCreds.captureLimit}{" "}
                    captures
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void copyText(
                      `Crackpilot ${generatedCreds.isDemo ? "Demo" : "Account"} Credentials\nName: ${generatedCreds.label}\nEmail/ID: ${generatedCreds.email}\nPassword: ${generatedCreds.password}\nAuth Token: ${generatedCreds.token}\nTime: ${generatedCreds.minutes} mins | Captures: ${generatedCreds.captureLimit}`,
                      "cred-all"
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#b4f416] px-3 py-1.5 text-xs font-bold text-[#0a0a0a] hover:bg-[#a3e012] cursor-pointer"
                >
                  {copiedKey === "cred-all" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {copiedKey === "cred-all"
                      ? "Copied All!"
                      : "Copy All Details"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setGeneratedCreds(null)}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-[#0a0a0a] p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="block font-mono text-[10px] uppercase text-zinc-500">
                    Login Email / ID
                  </span>
                  <span className="block truncate font-mono text-xs text-zinc-100">
                    {generatedCreds.email}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void copyText(generatedCreds.email, "cred-email")}
                  className="rounded-md border border-white/10 bg-[#111111] p-1.5 text-zinc-300 hover:text-[#b4f416] cursor-pointer"
                >
                  {copiedKey === "cred-email" ? (
                    <Check className="h-3.5 w-3.5 text-[#b4f416]" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#0a0a0a] p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="block font-mono text-[10px] uppercase text-zinc-500">
                    Password (shown once)
                  </span>
                  <span className="block truncate font-mono text-xs text-amber-300">
                    {generatedCreds.password}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void copyText(generatedCreds.password, "cred-pass")
                  }
                  className="rounded-md border border-white/10 bg-[#111111] p-1.5 text-zinc-300 hover:text-[#b4f416] cursor-pointer"
                >
                  {copiedKey === "cred-pass" ? (
                    <Check className="h-3.5 w-3.5 text-[#b4f416]" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>

              <div className="rounded-xl border border-[#b4f416]/30 bg-[#0a0a0a] p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="block font-mono text-[10px] uppercase text-zinc-500">
                    48h Auth Token
                  </span>
                  <span className="block truncate font-mono text-xs font-bold text-[#b4f416]">
                    {generatedCreds.token}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void copyText(generatedCreds.token, "cred-tok")}
                  className="rounded-md border border-white/10 bg-[#111111] p-1.5 text-zinc-300 hover:text-[#b4f416] cursor-pointer"
                >
                  {copiedKey === "cred-tok" ? (
                    <Check className="h-3.5 w-3.5 text-[#b4f416]" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Notices */}
        {bannerNotice && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#b4f416]/35 bg-[#b4f416]/10 px-4 py-3 text-xs text-[#d9fb7a]">
            <span>{bannerNotice}</span>
            <button
              type="button"
              onClick={() => setBannerNotice(null)}
              className="text-zinc-400 hover:text-white cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {errorNotice && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
            <span>{errorNotice}</span>
            <button
              type="button"
              onClick={() => setErrorNotice(null)}
              className="text-rose-200 hover:text-white cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* 2. 1-Click Dummy / Demo ID Generator Card */}
        <section className="rounded-2xl border border-white/[0.08] bg-[#111111] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#b4f416]/15 text-[#b4f416]">
                <Zap className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-white">
                  1-Click Dummy / Demo ID Generator
                </h2>
                <p className="text-xs text-zinc-400">
                  Instantly generate temporary demo email, password, and Auth
                  Token with custom session minutes &amp; screenshot limit.
                </p>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleCreateDemoId}
            className="grid gap-3 md:grid-cols-12 items-end"
          >
            <label className="md:col-span-3 space-y-1">
              <span className="text-[11px] font-medium text-zinc-400">
                Label / Prospect Name (optional)
              </span>
              <input
                type="text"
                value={demoLabel}
                onChange={(e) => setDemoLabel(e.target.value)}
                placeholder="e.g. Rahul Live Demo"
                className="w-full rounded-lg border border-white/10 bg-[#0a0a0a] px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-[#b4f416] focus:outline-none"
              />
            </label>

            <div className="md:col-span-3 space-y-1">
              <span className="text-[11px] font-medium text-zinc-400">
                Session Time (mins)
              </span>
              <div className="flex items-center gap-1.5">
                {[15, 30, 60].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDemoMinutes(m)}
                    className={`rounded-lg border px-2 py-2 text-[11px] font-semibold cursor-pointer ${
                      demoMinutes === m
                        ? "border-[#b4f416] bg-[#b4f416]/15 text-[#b4f416]"
                        : "border-white/10 bg-[#0a0a0a] text-zinc-300 hover:border-white/25"
                    }`}
                  >
                    {m}m
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  max={43200}
                  value={demoMinutes}
                  onChange={(e) => setDemoMinutes(Number(e.target.value))}
                  aria-label="Custom demo minutes"
                  className="w-20 rounded-lg border border-white/10 bg-[#0a0a0a] px-2.5 py-2 font-mono text-xs text-white focus:border-[#b4f416] focus:outline-none"
                />
              </div>
            </div>

            <div className="md:col-span-3 space-y-1">
              <span className="text-[11px] font-medium text-zinc-400">
                Screenshot Limit
              </span>
              <div className="flex items-center gap-1.5">
                {[10, 20].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setDemoCaptures(c)}
                    className={`rounded-lg border px-2.5 py-2 text-[11px] font-semibold cursor-pointer ${
                      demoCaptures === c
                        ? "border-[#b4f416] bg-[#b4f416]/15 text-[#b4f416]"
                        : "border-white/10 bg-[#0a0a0a] text-zinc-300 hover:border-white/25"
                    }`}
                  >
                    {c}
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={demoCaptures}
                  onChange={(e) => setDemoCaptures(Number(e.target.value))}
                  aria-label="Custom demo screenshot captures"
                  className="w-20 rounded-lg border border-white/10 bg-[#0a0a0a] px-2.5 py-2 font-mono text-xs text-white focus:border-[#b4f416] focus:outline-none"
                />
              </div>
            </div>

            <div className="md:col-span-3 flex items-center gap-2">
              <select
                value={demoExpiryHours}
                onChange={(e) => setDemoExpiryHours(Number(e.target.value))}
                aria-label="Demo expiry duration"
                className="rounded-lg border border-white/10 bg-[#0a0a0a] px-2.5 py-2 text-xs text-zinc-200 focus:border-[#b4f416] focus:outline-none cursor-pointer"
              >
                <option value={6}>6h</option>
                <option value={24}>24h</option>
                <option value={48}>48h</option>
              </select>
              <button
                type="submit"
                disabled={creatingDemo}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#b4f416] px-4 py-2 text-xs font-bold text-[#0a0a0a] hover:bg-[#a3e012] transition-colors cursor-pointer disabled:opacity-60"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{creatingDemo ? "Creating..." : "Create Demo ID"}</span>
              </button>
            </div>
          </form>
        </section>

        {/* 3. Master User & Demo Management Table */}
        <section className="rounded-2xl border border-white/[0.08] bg-[#111111] overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] p-5">
            <div className="flex flex-wrap items-center gap-1.5">
              {filterTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFilter(tab.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    activeFilter === tab.id
                      ? "bg-[#b4f416] text-[#0a0a0a]"
                      : "bg-[#0a0a0a] text-zinc-400 hover:text-white border border-white/10"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search email, name, token..."
                className="w-full rounded-lg border border-white/10 bg-[#0a0a0a] py-2 pl-9 pr-3 text-xs text-white placeholder-zinc-500 focus:border-[#b4f416] focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] bg-[#0d0d0d] font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                  <th className="px-4 py-3">User Info</th>
                  <th className="px-4 py-3">Auth Token</th>
                  <th className="px-4 py-3">Session Time</th>
                  <th className="px-4 py-3">Screenshot Credits</th>
                  <th className="px-4 py-3">Payment Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {accounts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-12 text-center text-zinc-500"
                    >
                      No accounts match this filter yet. Use{" "}
                      <strong className="text-zinc-300">Create New User ID</strong>{" "}
                      or{" "}
                      <strong className="text-zinc-300">Create Demo ID</strong>{" "}
                      above to provision credentials.
                    </td>
                  </tr>
                ) : (
                  accounts.map((acc) => {
                    const minsLeft = Math.max(
                      0,
                      Math.ceil(acc.remainingSeconds / 60)
                    );
                    const isBusy = busyToken === acc.token;
                    const isPaid = acc.paymentStatus === "Paid";

                    return (
                      <tr
                        key={acc.token}
                        className="hover:bg-white/[0.02] transition-colors align-top"
                      >
                        {/* User Info */}
                        <td className="px-4 py-3.5 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">
                              {acc.label}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase ${
                                acc.accountType === "DEMO"
                                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                  : "bg-[#b4f416]/15 text-[#b4f416] border border-[#b4f416]/30"
                              }`}
                            >
                              {acc.planType}
                            </span>
                          </div>
                          <p className="font-mono text-[11px] text-zinc-400">
                            {acc.email || "—"}
                          </p>
                          <div className="flex items-center gap-2 pt-0.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                acc.status === "Active"
                                  ? "bg-emerald-500/15 text-emerald-400"
                                  : acc.status === "Suspended"
                                    ? "bg-rose-500/15 text-rose-400"
                                    : "bg-zinc-700/40 text-zinc-400"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  acc.status === "Active"
                                    ? "bg-emerald-400"
                                    : acc.status === "Suspended"
                                      ? "bg-rose-400"
                                      : "bg-zinc-400"
                                }`}
                              />
                              {acc.status}
                            </span>
                            {acc.expiresAt && (
                              <span className="font-mono text-[10px] text-zinc-500">
                                Exp{" "}
                                {new Date(acc.expiresAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Auth Token */}
                        <td className="px-4 py-3.5">
                          <div className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0a0a0a] px-2.5 py-1.5">
                            <KeyRound className="h-3 w-3 text-[#b4f416] shrink-0" />
                            <span className="font-mono text-[11px] font-semibold text-zinc-100">
                              {acc.token}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                void copyText(acc.token, `tok-${acc.token}`)
                              }
                              title="Copy Auth Token"
                              className="ml-1 text-zinc-400 hover:text-[#b4f416] cursor-pointer"
                            >
                              {copiedKey === `tok-${acc.token}` ? (
                                <Check className="h-3.5 w-3.5 text-[#b4f416]" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Remaining Time + Quick Add */}
                        <td className="px-4 py-3.5 space-y-1.5">
                          <div className="font-mono text-sm font-bold tabular-nums text-white">
                            {minsLeft}{" "}
                            <span className="text-[11px] font-normal text-zinc-400">
                              mins
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1">
                            {[
                              { label: "+30m", delta: 30 },
                              { label: "+60m", delta: 60 },
                              { label: "+240m", delta: 240 },
                            ].map((btn) => (
                              <button
                                key={btn.label}
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  void handleAdjustQuotas(
                                    acc.token,
                                    { deltaMinutes: btn.delta },
                                    `Added ${btn.label} to ${acc.label}.`
                                  )
                                }
                                className="rounded border border-white/10 bg-[#0a0a0a] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#b4f416] hover:border-[#b4f416]/60 hover:bg-[#b4f416]/10 cursor-pointer disabled:opacity-40"
                              >
                                {btn.label}
                              </button>
                            ))}
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => {
                                setQuotaModalAccount(acc);
                                setCustomMinutesDelta("60");
                                setCustomCapturesDelta("20");
                              }}
                              className="rounded border border-white/10 bg-[#0a0a0a] px-1.5 py-0.5 text-[10px] text-zinc-300 hover:text-white cursor-pointer"
                            >
                              Custom
                            </button>
                          </div>
                        </td>

                        {/* Screenshot Credits + Quick Add + Reset */}
                        <td className="px-4 py-3.5 space-y-1.5">
                          <div className="font-mono text-sm font-bold tabular-nums text-white">
                            {acc.capturesUsed}{" "}
                            <span className="text-zinc-500">/</span>{" "}
                            <span className="text-[#b4f416]">
                              {acc.captureLimit}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1">
                            {[20, 50, 80].map((delta) => (
                              <button
                                key={delta}
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  void handleAdjustQuotas(
                                    acc.token,
                                    { deltaCaptures: delta },
                                    `Added +${delta} screenshot credits to ${acc.label}.`
                                  )
                                }
                                className="rounded border border-white/10 bg-[#0a0a0a] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-200 hover:border-[#b4f416]/60 hover:text-[#b4f416] cursor-pointer disabled:opacity-40"
                              >
                                +{delta}
                              </button>
                            ))}
                            <button
                              type="button"
                              disabled={isBusy}
                              title="Reset used screenshot & prompt count to 0"
                              onClick={() =>
                                void handleAdjustQuotas(
                                  acc.token,
                                  { resetUsed: true },
                                  `Reset used captures to 0 for ${acc.label}.`
                                )
                              }
                              className="inline-flex items-center gap-0.5 rounded border border-white/10 bg-[#0a0a0a] px-1.5 py-0.5 text-[10px] text-zinc-300 hover:text-white cursor-pointer disabled:opacity-40"
                            >
                              <RotateCcw className="h-2.5 w-2.5" />
                              <span>Reset</span>
                            </button>
                          </div>
                        </td>

                        {/* Payment Status + 1-Click Mark Payment Done */}
                        <td className="px-4 py-3.5 space-y-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                              isPaid
                                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/35"
                                : "bg-amber-500/15 text-amber-300 border border-amber-500/35"
                            }`}
                          >
                            {isPaid ? "PAID / PRO" : "PENDING"}
                          </span>
                          <div>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                void handleTogglePayment(
                                  acc,
                                  isPaid ? "Pending" : "Paid"
                                )
                              }
                              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-40 ${
                                isPaid
                                  ? "border border-white/10 bg-[#0a0a0a] text-zinc-300 hover:text-white"
                                  : "bg-[#b4f416] text-[#0a0a0a] hover:bg-[#a3e012]"
                              }`}
                            >
                              <Check className="h-3 w-3" />
                              <span>
                                {isPaid ? "Mark Pending" : "Mark Payment Done"}
                              </span>
                            </button>
                          </div>
                        </td>

                        {/* Row Actions */}
                        <td className="px-4 py-3.5 text-right">
                          <div className="inline-flex flex-col items-end gap-1.5">
                            <div className="flex items-center gap-1.5">
                              {acc.status === "Active" ? (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    void handleUpdateStatus(acc, "Suspended")
                                  }
                                  className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/20 cursor-pointer disabled:opacity-40"
                                >
                                  <Ban className="h-3 w-3" />
                                  <span>Suspend</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    void handleUpdateStatus(acc, "Active")
                                  }
                                  className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 cursor-pointer disabled:opacity-40"
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                  <span>Activate</span>
                                </button>
                              )}

                              {confirmDeleteToken === acc.token ? (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => void handleDeleteAccount(acc)}
                                    className="rounded-md bg-rose-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-rose-500 cursor-pointer"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteToken(null)}
                                    className="rounded-md border border-white/10 bg-[#0a0a0a] px-2 py-1 text-[11px] text-zinc-300 cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => setConfirmDeleteToken(acc.token)}
                                  title="Delete & revoke token immediately"
                                  className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20 cursor-pointer disabled:opacity-40"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  <span>Delete</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* CREATE NEW USER ID MODAL */}
      {showCreateUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#111111] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <UserPlus className="h-5 w-5 text-[#b4f416]" />
                <div>
                  <h2 className="text-base font-bold text-white">
                    Create New User ID
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Auto-generates a unique 48h Crackpilot Auth Token
                    (CP-XXXXXX-XXXXXX-XXXX).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateUserModal(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUserSubmit} className="space-y-4">
              <div className="grid gap-3.5 sm:grid-cols-2">
                <label className="space-y-1 sm:col-span-2">
                  <span className="text-xs font-medium text-zinc-300">
                    Full Name *
                  </span>
                  <input
                    type="text"
                    required
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="e.g. Amit Sharma"
                    className="w-full rounded-lg border border-white/10 bg-[#0a0a0a] px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-[#b4f416] focus:outline-none"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-zinc-300">
                    Email / User ID
                  </span>
                  <input
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="amit@example.com"
                    className="w-full rounded-lg border border-white/10 bg-[#0a0a0a] px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-[#b4f416] focus:outline-none"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-zinc-300">
                    Password (auto if blank)
                  </span>
                  <input
                    type="text"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Leave blank to auto-generate"
                    className="w-full rounded-lg border border-white/10 bg-[#0a0a0a] px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-[#b4f416] focus:outline-none"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-zinc-300">
                    Plan Type
                  </span>
                  <select
                    value={newUserPlan}
                    onChange={(e) => {
                      const plan = e.target.value as PlanType;
                      setNewUserPlan(plan);
                      if (plan === "Demo") {
                        setNewUserMinutes(30);
                        setNewUserCaptures(15);
                        setNewUserPayment("Pending");
                      } else if (plan === "Starter") {
                        setNewUserMinutes(60);
                        setNewUserCaptures(30);
                      } else if (plan === "Pro Plan") {
                        setNewUserMinutes(240);
                        setNewUserCaptures(80);
                      } else if (plan === "Unlimited") {
                        setNewUserMinutes(1440);
                        setNewUserCaptures(500);
                      }
                    }}
                    className="w-full rounded-lg border border-white/10 bg-[#0a0a0a] px-3 py-2 text-sm text-white focus:border-[#b4f416] focus:outline-none cursor-pointer"
                  >
                    <option value="Demo">Demo</option>
                    <option value="Starter">Starter</option>
                    <option value="Pro Plan">Pro Plan</option>
                    <option value="Unlimited">Unlimited</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-zinc-300">
                    Payment Status
                  </span>
                  <select
                    value={newUserPayment}
                    onChange={(e) =>
                      setNewUserPayment(e.target.value as PaymentStatus)
                    }
                    className="w-full rounded-lg border border-white/10 bg-[#0a0a0a] px-3 py-2 text-sm text-white focus:border-[#b4f416] focus:outline-none cursor-pointer"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Paid">Done / Paid</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-zinc-300">
                    Initial Session Time (Minutes)
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={43200}
                    value={newUserMinutes}
                    onChange={(e) => setNewUserMinutes(Number(e.target.value))}
                    className="w-full rounded-lg border border-white/10 bg-[#0a0a0a] px-3 py-2 font-mono text-sm text-white focus:border-[#b4f416] focus:outline-none"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-zinc-300">
                    Screenshot &amp; Prompt Quota
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={50000}
                    value={newUserCaptures}
                    onChange={(e) => setNewUserCaptures(Number(e.target.value))}
                    className="w-full rounded-lg border border-white/10 bg-[#0a0a0a] px-3 py-2 font-mono text-sm text-white focus:border-[#b4f416] focus:outline-none"
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-white/[0.08] pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(false)}
                  className="rounded-lg border border-white/10 bg-[#0a0a0a] px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#b4f416] px-5 py-2 text-xs font-bold text-[#0a0a0a] hover:bg-[#a3e012] cursor-pointer disabled:opacity-60"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>
                    {creatingUser
                      ? "Creating..."
                      : "Create User & Generate Token"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM QUOTA EDIT MODAL */}
      {quotaModalAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#111111] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">
                  Edit Quotas — {quotaModalAccount.label}
                </h2>
                <p className="font-mono text-[11px] text-zinc-400">
                  {quotaModalAccount.token}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuotaModalAccount(null)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-[#0a0a0a] p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 text-zinc-300">
                    <Clock className="h-3.5 w-3.5 text-[#b4f416]" />
                    <span>Adjust Session Time (minutes)</span>
                  </span>
                  <span className="font-mono text-xs font-bold text-white">
                    Current:{" "}
                    {Math.ceil(quotaModalAccount.remainingSeconds / 60)}m
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={customMinutesDelta}
                    onChange={(e) => setCustomMinutesDelta(e.target.value)}
                    placeholder="e.g. 90 or -30"
                    className="flex-1 rounded-lg border border-white/10 bg-[#111111] px-3 py-2 font-mono text-xs text-white focus:border-[#b4f416] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const num = Number(customMinutesDelta);
                      if (!Number.isFinite(num) || num === 0) return;
                      void handleAdjustQuotas(
                        quotaModalAccount.token,
                        { deltaMinutes: num },
                        `${num > 0 ? "Added" : "Adjusted"} ${num} mins for ${quotaModalAccount.label}.`
                      );
                    }}
                    className="rounded-lg bg-[#b4f416] px-3.5 py-2 text-xs font-bold text-[#0a0a0a] hover:bg-[#a3e012] cursor-pointer"
                  >
                    Apply Time
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#0a0a0a] p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 text-zinc-300">
                    <Camera className="h-3.5 w-3.5 text-[#b4f416]" />
                    <span>Adjust Screenshot Credits</span>
                  </span>
                  <span className="font-mono text-xs font-bold text-white">
                    {quotaModalAccount.capturesUsed} /{" "}
                    {quotaModalAccount.captureLimit}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={customCapturesDelta}
                    onChange={(e) => setCustomCapturesDelta(e.target.value)}
                    placeholder="e.g. 50 or -10"
                    className="flex-1 rounded-lg border border-white/10 bg-[#111111] px-3 py-2 font-mono text-xs text-white focus:border-[#b4f416] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const num = Number(customCapturesDelta);
                      if (!Number.isFinite(num) || num === 0) return;
                      void handleAdjustQuotas(
                        quotaModalAccount.token,
                        { deltaCaptures: num },
                        `${num > 0 ? "Added" : "Adjusted"} ${num} screenshot credits for ${quotaModalAccount.label}.`
                      );
                    }}
                    className="rounded-lg bg-[#b4f416] px-3.5 py-2 text-xs font-bold text-[#0a0a0a] hover:bg-[#a3e012] cursor-pointer"
                  >
                    Apply Credits
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setQuotaModalAccount(null)}
                className="rounded-lg border border-white/10 bg-[#0a0a0a] px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
