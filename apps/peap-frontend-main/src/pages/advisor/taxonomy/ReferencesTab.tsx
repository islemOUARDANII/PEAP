import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  BookOpenText,
  Pencil,
  Plus,
  PowerOff,
  Search,
  Tag,
} from "lucide-react";

import { StatusPill } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  useCreateRefGroupMutation,
  useCreateRefValueMutation,
  useDeleteRefGroupMutation,
  useDeleteRefValueMutation,
  useRefGroupsQuery,
  useRefValuesQuery,
  useUpdateRefGroupMutation,
  useUpdateRefValueMutation,
} from "@/services/api/queries";
import type {
  RefGroup,
  RefGroupCreatePayload,
  RefGroupUpdatePayload,
  RefValue,
  RefValueCreatePayload,
  RefValueUpdatePayload,
} from "@/models/references";

// ─── helpers ─────────────────────────────────────────────────────────────────

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium text-muted-foreground mb-1">{children}</p>;
}

function QueryError({ error, label }: { error: unknown; label: string }) {
  return (
    <div className="p-4 text-sm text-destructive">
      {label}: {error instanceof Error ? error.message : "Unknown error"}
    </div>
  );
}

// ─── dialog state types ───────────────────────────────────────────────────────

type GroupDialog = { mode: "create" } | { mode: "edit"; group: RefGroup };
type ValueDialog = { mode: "create" } | { mode: "edit"; value: RefValue };

// ─── GroupDialog ──────────────────────────────────────────────────────────────

interface GroupFormState {
  code: string;
  label: string;
  description: string;
  domain: string;
  active: boolean;
}

function GroupDialogModal({
  dialog,
  isPending,
  onClose,
  onSave,
}: {
  dialog: GroupDialog;
  isPending: boolean;
  onClose: () => void;
  onSave: (data: GroupFormState) => void;
}) {
  const isEdit = dialog.mode === "edit";
  const existing = isEdit ? dialog.group : undefined;

  const [form, setForm] = useState<GroupFormState>({
    code:        existing?.code        ?? "",
    label:       existing?.label       ?? "",
    description: existing?.description ?? "",
    domain:      existing?.domain      ?? "",
    active:      existing?.active      ?? true,
  });

  const valid = form.label.trim().length > 0 && (isEdit || form.code.trim().length > 0);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Reference Group" : "Add Reference Group"}</DialogTitle>
          {isEdit && (
            <DialogDescription>Editing group "{existing?.code}"</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 py-1">
          {!isEdit && (
            <div>
              <FieldLabel>Code *</FieldLabel>
              <Input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="CONTRACT_TYPE"
                className="font-mono"
              />
            </div>
          )}
          <div>
            <FieldLabel>Label *</FieldLabel>
            <Input
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="Contract Type"
            />
          </div>
          <div>
            <FieldLabel>Domain</FieldLabel>
            <Input
              value={form.domain}
              onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}
              placeholder="hr, geo, education…"
            />
          </div>
          <div>
            <FieldLabel>Description</FieldLabel>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Optional description…"
              rows={2}
              className="resize-none"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-sm text-foreground">Active</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button disabled={!valid || isPending} onClick={() => onSave(form)}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── ValueDialog ──────────────────────────────────────────────────────────────

interface ValueFormState {
  code: string;
  label: string;
  label_fr: string;
  label_en: string;
  label_ar: string;
  sort_order: string;
  active: boolean;
  external_code: string;
  source: string;
  metadata_raw: string;
}

function ValueDialogModal({
  dialog,
  isPending,
  onClose,
  onSave,
}: {
  dialog: ValueDialog;
  isPending: boolean;
  onClose: () => void;
  onSave: (data: ValueFormState) => void;
}) {
  const isEdit = dialog.mode === "edit";
  const existing = isEdit ? dialog.value : undefined;

  const [form, setForm] = useState<ValueFormState>({
    code:          existing?.code          ?? "",
    label:         existing?.label         ?? "",
    label_fr:      existing?.label_fr      ?? "",
    label_en:      existing?.label_en      ?? "",
    label_ar:      existing?.label_ar      ?? "",
    sort_order:    existing?.sort_order    != null ? String(existing.sort_order) : "0",
    active:        existing?.active        ?? true,
    external_code: existing?.external_code ?? "",
    source:        existing?.source        ?? "",
    metadata_raw:  existing?.metadata_json
      ? JSON.stringify(existing.metadata_json, null, 2)
      : "",
  });

  const [metaError, setMetaError] = useState("");

  function validateMeta(raw: string): boolean {
    if (!raw.trim()) { setMetaError(""); return true; }
    try { JSON.parse(raw); setMetaError(""); return true; }
    catch { setMetaError("Invalid JSON"); return false; }
  }

  const valid = form.label.trim().length > 0
    && (isEdit || form.code.trim().length > 0)
    && !metaError;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Value" : "Add Value"}</DialogTitle>
          {isEdit && (
            <DialogDescription>Editing "{existing?.code}"</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-3 py-1">
          {!isEdit && (
            <div>
              <FieldLabel>Code *</FieldLabel>
              <Input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="CDI"
                className="font-mono"
              />
            </div>
          )}

          <div>
            <FieldLabel>Label *</FieldLabel>
            <Input
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="Contrat à durée indéterminée"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <FieldLabel>FR</FieldLabel>
              <Input
                value={form.label_fr}
                onChange={(e) => setForm((f) => ({ ...f, label_fr: e.target.value }))}
                placeholder="Label FR"
              />
            </div>
            <div>
              <FieldLabel>EN</FieldLabel>
              <Input
                value={form.label_en}
                onChange={(e) => setForm((f) => ({ ...f, label_en: e.target.value }))}
                placeholder="Label EN"
              />
            </div>
            <div>
              <FieldLabel>AR</FieldLabel>
              <Input
                value={form.label_ar}
                onChange={(e) => setForm((f) => ({ ...f, label_ar: e.target.value }))}
                placeholder="Label AR"
                dir="rtl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Sort order</FieldLabel>
              <Input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div>
              <FieldLabel>External code</FieldLabel>
              <Input
                value={form.external_code}
                onChange={(e) => setForm((f) => ({ ...f, external_code: e.target.value }))}
                placeholder="External code"
                className="font-mono"
              />
            </div>
          </div>

          <div>
            <FieldLabel>Source</FieldLabel>
            <Input
              value={form.source}
              onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
              placeholder="e.g. CNSS, ANETI"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-sm text-foreground">Active</span>
          </label>

          <div>
            <FieldLabel>Metadata JSON (optional)</FieldLabel>
            <Textarea
              value={form.metadata_raw}
              onChange={(e) => {
                setForm((f) => ({ ...f, metadata_raw: e.target.value }));
                validateMeta(e.target.value);
              }}
              placeholder='{"key": "value"}'
              rows={3}
              className={cn("font-mono text-xs resize-none", metaError && "border-destructive")}
            />
            {metaError && <p className="text-xs text-destructive mt-1">{metaError}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button disabled={!valid || isPending} onClick={() => onSave(form)}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── ReferencesTab ────────────────────────────────────────────────────────────

export function ReferencesTab() {
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>();
  const [groupSearch, setGroupSearch]         = useState("");
  const [valueSearch, setValueSearch]         = useState("");
  const [groupDialog, setGroupDialog]         = useState<GroupDialog | null>(null);
  const [valueDialog, setValueDialog]         = useState<ValueDialog | null>(null);

  const debouncedGroupSearch = useDebouncedValue(groupSearch, 350);
  const debouncedValueSearch = useDebouncedValue(valueSearch, 350);

  // ── queries ──────────────────────────────────────────────────────────────────
  const groupsQuery = useRefGroupsQuery({ q: debouncedGroupSearch || undefined, limit: 200 });
  const valuesQuery = useRefValuesQuery({
    group_id: selectedGroupId,
    q: debouncedValueSearch || undefined,
    limit: 500,
  });

  // ── mutations ─────────────────────────────────────────────────────────────────
  const createGroup = useCreateRefGroupMutation();
  const updateGroup = useUpdateRefGroupMutation();
  const deleteGroup = useDeleteRefGroupMutation();
  const createValue = useCreateRefValueMutation();
  const updateValue = useUpdateRefValueMutation();
  const deleteValue = useDeleteRefValueMutation();

  // ── derived ───────────────────────────────────────────────────────────────────
  const groups        = groupsQuery.data?.items ?? [];
  const values        = valuesQuery.data?.items ?? [];
  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  useEffect(() => {
    if (!selectedGroupId && groups.length > 0) setSelectedGroupId(groups[0].id);
  }, [groups, selectedGroupId]);

  useEffect(() => { setValueSearch(""); }, [selectedGroupId]);

  // ── group handlers ────────────────────────────────────────────────────────────
  function handleGroupSave(form: GroupFormState) {
    if (groupDialog?.mode === "create") {
      const payload: RefGroupCreatePayload = {
        code:        form.code.trim(),
        label:       form.label.trim(),
        description: form.description.trim() || undefined,
        domain:      form.domain.trim()      || undefined,
        active:      form.active,
      };
      createGroup.mutate(payload, {
        onSuccess: () => { toast.success("Group created"); setGroupDialog(null); },
        onError:   (err) => toast.error(err instanceof Error ? err.message : "Failed to create group"),
      });
    } else if (groupDialog?.mode === "edit") {
      const payload: RefGroupUpdatePayload = {
        label:       form.label.trim(),
        description: form.description.trim() || undefined,
        domain:      form.domain.trim()      || undefined,
        active:      form.active,
      };
      updateGroup.mutate({ id: groupDialog.group.id, payload }, {
        onSuccess: () => { toast.success("Group updated"); setGroupDialog(null); },
        onError:   (err) => toast.error(err instanceof Error ? err.message : "Failed to update group"),
      });
    }
  }

  function handleDeactivateGroup(group: RefGroup) {
    deleteGroup.mutate(group.id, {
      onSuccess: () => toast.success(`"${group.code}" deactivated`),
      onError:   (err) => toast.error(err instanceof Error ? err.message : "Failed to deactivate group"),
    });
  }

  // ── value handlers ────────────────────────────────────────────────────────────
  function parseValueForm(
    form: ValueFormState,
    groupId: string,
  ): RefValueCreatePayload {
    let meta: Record<string, unknown> | undefined;
    if (form.metadata_raw.trim()) {
      try { meta = JSON.parse(form.metadata_raw); } catch { /* skip */ }
    }
    return {
      group_id:      groupId,
      code:          form.code.trim(),
      label:         form.label.trim(),
      label_fr:      form.label_fr.trim()      || undefined,
      label_en:      form.label_en.trim()      || undefined,
      label_ar:      form.label_ar.trim()      || undefined,
      sort_order:    form.sort_order ? parseInt(form.sort_order, 10) : 0,
      active:        form.active,
      external_code: form.external_code.trim() || undefined,
      source:        form.source.trim()        || undefined,
      metadata_json: meta,
    };
  }

  function handleValueSave(form: ValueFormState) {
    if (!selectedGroupId) return;

    if (valueDialog?.mode === "create") {
      createValue.mutate(parseValueForm(form, selectedGroupId), {
        onSuccess: () => { toast.success("Value added"); setValueDialog(null); },
        onError:   (err) => toast.error(err instanceof Error ? err.message : "Failed to add value"),
      });
    } else if (valueDialog?.mode === "edit") {
      let meta: Record<string, unknown> | undefined;
      if (form.metadata_raw.trim()) {
        try { meta = JSON.parse(form.metadata_raw); } catch { /* skip */ }
      }
      const payload: RefValueUpdatePayload = {
        label:         form.label.trim()         || undefined,
        label_fr:      form.label_fr.trim()      || undefined,
        label_en:      form.label_en.trim()      || undefined,
        label_ar:      form.label_ar.trim()      || undefined,
        sort_order:    form.sort_order ? parseInt(form.sort_order, 10) : 0,
        active:        form.active,
        external_code: form.external_code.trim() || undefined,
        source:        form.source.trim()        || undefined,
        metadata_json: meta,
      };
      updateValue.mutate({ id: valueDialog.value.id, payload }, {
        onSuccess: () => { toast.success("Value updated"); setValueDialog(null); },
        onError:   (err) => toast.error(err instanceof Error ? err.message : "Failed to update value"),
      });
    }
  }

  function handleDeactivateValue(value: RefValue) {
    deleteValue.mutate(value.id, {
      onSuccess: () => toast.success(`"${value.code}" deactivated`),
      onError:   (err) => toast.error(err instanceof Error ? err.message : "Failed to deactivate"),
    });
  }

  // ── render ────────────────────────────────────────────────────────────────────
  const groupMutPending = createGroup.isPending || updateGroup.isPending;
  const valueMutPending = createValue.isPending || updateValue.isPending;

  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">

        {/* ── Groups panel ──────────────────────────────────────────────────── */}
        <div className="xl:col-span-4 panel flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">Reference Groups</h2>
              <Button size="sm" className="h-8 gap-1 text-xs" onClick={() => setGroupDialog({ mode: "create" })}>
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
                placeholder="Search groups…"
                className="h-8 pl-8 bg-surface-muted text-sm"
              />
            </div>
          </div>

          {groupsQuery.isError && (
            <QueryError error={groupsQuery.error} label="Failed to load groups" />
          )}

          {groupsQuery.isLoading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="h-6 w-6 rounded shrink-0" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-5 w-12 rounded-md" />
                </div>
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
              <BookOpenText className="h-7 w-7 opacity-25" />
              <p className="text-sm">No groups yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-y-auto max-h-[600px] scrollbar-thin flex-1">
              {groups.map((group) => (
                <li key={group.id}>
                  <div
                    className={cn(
                      "flex items-center gap-2 p-3 hover:bg-surface-muted transition-colors",
                      selectedGroupId === group.id && "bg-surface-muted",
                    )}
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-muted text-primary shrink-0">
                      <Tag className="h-3.5 w-3.5" />
                    </div>

                    <button className="min-w-0 flex-1 text-left" onClick={() => setSelectedGroupId(group.id)}>
                      <div className="flex items-center gap-1.5">
                        <p className="text-[10px] font-mono text-muted-foreground truncate">{group.code}</p>
                        {group.domain && (
                          <span className="text-[10px] bg-muted text-muted-foreground rounded px-1 shrink-0">
                            {group.domain}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground truncate mt-0.5">{group.label}</p>
                    </button>

                    <StatusPill
                      label={group.active ? "Active" : "Off"}
                      tone={group.active ? "success" : "neutral"}
                      dot={false}
                    />
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={() => setGroupDialog({ mode: "edit", group })}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {group.active && (
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        disabled={deleteGroup.isPending}
                        title="Deactivate group"
                        onClick={() => handleDeactivateGroup(group)}
                      >
                        <PowerOff className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Values panel ──────────────────────────────────────────────────── */}
        <div className="xl:col-span-8 panel flex flex-col overflow-hidden">
          {!selectedGroup ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <Tag className="h-8 w-8 opacity-25" />
              <p className="text-sm">Select a group to view its values.</p>
            </div>
          ) : (
            <>
              <div className="p-3 border-b border-border space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-mono text-muted-foreground">{selectedGroup.code}</p>
                      {selectedGroup.domain && (
                        <span className="text-[10px] bg-muted text-muted-foreground rounded px-1">
                          {selectedGroup.domain}
                        </span>
                      )}
                    </div>
                    <h2 className="text-sm font-semibold text-foreground truncate">{selectedGroup.label}</h2>
                  </div>
                  <Button size="sm" className="h-8 gap-1 text-xs shrink-0" onClick={() => setValueDialog({ mode: "create" })}>
                    <Plus className="h-3.5 w-3.5" /> Add Value
                  </Button>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={valueSearch}
                    onChange={(e) => setValueSearch(e.target.value)}
                    placeholder="Search values…"
                    className="h-8 pl-8 bg-surface-muted text-sm"
                  />
                </div>
              </div>

              {valuesQuery.isError && (
                <QueryError error={valuesQuery.error} label="Failed to load values" />
              )}

              {valuesQuery.isLoading ? (
                <div className="divide-y divide-border">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-4 py-3">
                      <Skeleton className="h-4 w-14" />
                      <Skeleton className="h-4 flex-1" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-5 w-12 rounded-md" />
                      <Skeleton className="h-7 w-14" />
                    </div>
                  ))}
                </div>
              ) : values.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
                  <Tag className="h-7 w-7 opacity-25" />
                  <p className="text-sm">No values for this group yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground border-b border-border bg-surface-muted">
                        <th className="text-left font-medium px-4 py-2.5">Code</th>
                        <th className="text-left font-medium px-2 py-2.5">Label</th>
                        <th className="text-left font-medium px-2 py-2.5">FR</th>
                        <th className="text-left font-medium px-2 py-2.5">EN</th>
                        <th className="text-left font-medium px-2 py-2.5">AR</th>
                        <th className="text-right font-medium px-2 py-2.5">Order</th>
                        <th className="text-left font-medium px-2 py-2.5">Status</th>
                        <th className="text-right font-medium px-4 py-2.5">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {values.map((value) => (
                        <tr key={value.id} className="hover:bg-surface-muted">
                          <td className="px-4 py-2.5">
                            <span className="text-xs font-mono text-foreground">{value.code}</span>
                            {value.external_code && (
                              <span className="block text-[10px] font-mono text-muted-foreground">{value.external_code}</span>
                            )}
                          </td>
                          <td className="px-2 py-2.5 max-w-[160px]">
                            <span className="text-xs text-foreground block truncate" title={value.label}>
                              {value.label}
                            </span>
                            {value.source && (
                              <span className="text-[10px] text-muted-foreground">{value.source}</span>
                            )}
                          </td>
                          <td className="px-2 py-2.5">
                            <span className="text-xs text-muted-foreground">{value.label_fr ?? "—"}</span>
                          </td>
                          <td className="px-2 py-2.5">
                            <span className="text-xs text-muted-foreground">{value.label_en ?? "—"}</span>
                          </td>
                          <td className="px-2 py-2.5">
                            <span className="text-xs text-muted-foreground" dir="rtl">{value.label_ar ?? "—"}</span>
                          </td>
                          <td className="px-2 py-2.5 text-right">
                            <span className="text-xs text-muted-foreground">{value.sort_order}</span>
                          </td>
                          <td className="px-2 py-2.5">
                            <StatusPill
                              label={value.active ? "Active" : "Inactive"}
                              tone={value.active ? "success" : "neutral"}
                              dot={false}
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm" variant="outline"
                                className="h-7 gap-1 px-2 text-xs"
                                onClick={() => setValueDialog({ mode: "edit", value })}
                              >
                                <Pencil className="h-3 w-3" /> Edit
                              </Button>
                              {value.active && (
                                <Button
                                  size="sm" variant="outline"
                                  className="h-7 gap-1 px-2 text-xs text-destructive border-destructive/30 hover:bg-destructive-soft hover:text-destructive"
                                  disabled={deleteValue.isPending}
                                  onClick={() => handleDeactivateValue(value)}
                                >
                                  <PowerOff className="h-3 w-3" /> Deactivate
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {groupDialog && (
        <GroupDialogModal
          dialog={groupDialog}
          isPending={groupMutPending}
          onClose={() => setGroupDialog(null)}
          onSave={handleGroupSave}
        />
      )}
      {valueDialog && selectedGroupId && (
        <ValueDialogModal
          dialog={valueDialog}
          isPending={valueMutPending}
          onClose={() => setValueDialog(null)}
          onSave={handleValueSave}
        />
      )}
    </>
  );
}
