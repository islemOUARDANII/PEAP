import { PageHeader } from "@/components/common/PageHeader";
import { TablePageSkeleton } from "@/components/common/PageSkeletons";
import { StatusPill, statusToTone } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSearchParamState } from "@/hooks/use-search-param-state";
import { useAdvisorUsersQuery, useCreateProviderAccountMutation } from "@/services/api/queries";
import { queryClient } from "@/app/queryClient";
import { queryKeys } from "@/services/api/queryKeys";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const PAGE_SIZE = 25;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);

  return debounced;
}

export default function Users() {
  const [search, setSearch] = useSearchParamState();
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [providerForm, setProviderForm] = useState({
    email: "",
    password: "",
    companyName: "",
    contactName: "",
    phone: "",
    website: "",
    companySize: "",
  });
  const createProviderMutation = useCreateProviderAccountMutation();
  const { toast } = useToast();
  const debouncedSearch = useDebouncedValue(search, 350);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, role, status]);

  const { data, isLoading, isError, error, isFetching } = useAdvisorUsersQuery({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    search: debouncedSearch,
    role: role === "all" ? undefined : role,
    status: status === "all" ? undefined : status,
  });

  const users = data?.items ?? [];
  const total = data?.total ?? data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const updateProviderField = (field: keyof typeof providerForm, value: string) => {
    setProviderForm((current) => ({ ...current, [field]: value }));
  };

  const handleCreateProvider = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await createProviderMutation.mutateAsync(providerForm);
      await queryClient.invalidateQueries({ queryKey: queryKeys.advisor.users() });
      toast({ title: "Provider account created", description: providerForm.email + " can now sign in as a provider." });
      setCreateOpen(false);
      setProviderForm({ email: "", password: "", companyName: "", contactName: "", phone: "", website: "", companySize: "" });
    } catch (caught) {
      toast({
        title: "Creation failed",
        description: caught instanceof Error ? caught.message : "Unable to create provider account.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return <TablePageSkeleton controls={2} columns={5} rows={7} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description={`${total.toLocaleString()} real accounts from audit.user_account`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/advisor/provider-requests">Registration requests</Link>
            </Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  <Plus className="h-4 w-4 mr-1.5" /> Add provider
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[560px]">
                <form onSubmit={handleCreateProvider} className="space-y-4">
                  <DialogHeader>
                    <DialogTitle>Create provider account</DialogTitle>
                    <DialogDescription>
                      This creates an active employer/provider account. The provider can sign in immediately with the password you set.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Email" value={providerForm.email} onChange={(value) => updateProviderField("email", value)} type="email" required />
                    <Field label="Temporary password" value={providerForm.password} onChange={(value) => updateProviderField("password", value)} type="password" required minLength={8} />
                    <Field label="Company name" value={providerForm.companyName} onChange={(value) => updateProviderField("companyName", value)} required />
                    <Field label="Contact name" value={providerForm.contactName} onChange={(value) => updateProviderField("contactName", value)} />
                    <Field label="Phone" value={providerForm.phone} onChange={(value) => updateProviderField("phone", value)} />
                    <Field label="Company size" value={providerForm.companySize} onChange={(value) => updateProviderField("companySize", value)} placeholder="1-10, 11-50..." />
                    <div className="md:col-span-2">
                      <Field label="Website" value={providerForm.website} onChange={(value) => updateProviderField("website", value)} placeholder="https://company.com" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createProviderMutation.isPending}>
                      {createProviderMutation.isPending ? "Creating..." : "Create provider"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="panel p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search id, email, role or status..."
            className="h-9 pl-9 bg-surface-muted"
          />
        </div>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="advisor">Advisor</SelectItem>
            <SelectItem value="employer">Employer</SelectItem>
            <SelectItem value="candidate">Candidate</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="panel overflow-hidden">
        {isError && (
          <div className="px-4 py-4 text-sm text-destructive">
            Failed to load users: {error instanceof Error ? error.message : "unknown error"}
          </div>
        )}
        {!isLoading && !isError && users.length === 0 && (
          <div className="px-4 py-4 text-sm text-muted-foreground">No users match the selected filters.</div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border bg-surface-muted">
                <th className="text-left font-medium px-4 py-3">ID</th>
                <th className="text-left font-medium px-2 py-3">Email</th>
                <th className="text-left font-medium px-2 py-3">Role</th>
                <th className="text-left font-medium px-2 py-3">Status</th>
                <th className="text-left font-medium px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-surface-muted">
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{user.id}</td>
                  <td className="px-2 py-3">
                    <p className="text-sm font-medium text-foreground">{user.email}</p>
                  </td>
                  <td className="px-2 py-3"><StatusPill label={user.role} tone={roleTone(user.role)} dot={false} /></td>
                  <td className="px-2 py-3"><StatusPill label={user.status} tone={statusToTone(user.status)} /></td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{formatDate(user.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-border p-3 flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" disabled={page === 0 || isFetching} onClick={() => setPage((current) => Math.max(0, current - 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground font-mono">
            Page {page + 1} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page + 1 >= totalPages || isFetching} onClick={() => setPage((current) => current + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function roleTone(role: string): "info" | "accent" | "warning" | "neutral" {
  const normalized = role.toLowerCase();
  if (normalized === "candidate") return "info";
  if (normalized === "employer") return "accent";
  if (normalized === "advisor" || normalized === "admin") return "warning";
  return "neutral";
}

function formatDate(value: string | undefined): string {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString().replace("T", " ").replace(".000Z", "Z");
}


function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  minLength,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  minLength?: number;
  placeholder?: string;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        className="h-9 bg-surface-muted"
      />
    </div>
  );
}
