"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";
import { Plus, Users, Pencil, Trash2, X, Loader2 } from "lucide-react";
import type { Client } from "@/types";
import { ListPagination, LIST_PAGE_SIZE } from "@/components/list-pagination";

async function fetchClients(): Promise<Client[]> {
  const res = await fetch("/api/clients");
  if (!res.ok) return [];
  return res.json();
}

export default function ClientsPage() {
  const { data: clients = [], isLoading: loading, mutate } = useSWR("dashboard-clients", fetchClients, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(clients.length / LIST_PAGE_SIZE));

  useEffect(() => {
    setPage((p) => Math.min(p, pageCount));
  }, [pageCount, clients.length]);

  const paginatedClients = useMemo(
    () => clients.slice((page - 1) * LIST_PAGE_SIZE, page * LIST_PAGE_SIZE),
    [clients, page]
  );

  function resetForm() {
    setCompanyName("");
    setContactName("");
    setEmail("");
    setPhone("");
    setNotes("");
    setEditing(null);
    setShowForm(false);
  }

  function startEdit(client: Client) {
    setCompanyName(client.company_name);
    setContactName(client.contact_name || "");
    setEmail(client.email || "");
    setPhone(client.phone || "");
    setNotes(client.notes || "");
    setEditing(client.id);
    setShowForm(true);
  }

  async function handleSave() {
    if (!companyName.trim()) return;
    setSaving(true);

    const body = {
      company_name: companyName.trim(),
      contact_name: contactName.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      notes: notes.trim() || null,
    };

    if (editing) {
      const supabase = createClient();
      await supabase.from("clients").update(body).eq("id", editing);
    } else {
      await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    resetForm();
    setSaving(false);
    await mutate();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this client?")) return;
    const supabase = createClient();
    await supabase.from("clients").delete().eq("id", id);
    await mutate();
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-display font-bold text-ink-900">Clients</h1>
          <p className="text-ink-500 mt-1">Manage your client contacts</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Client
        </button>
      </div>

      {showForm && (
        <div className="card p-6 mb-6 animate-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-ink-900">
              {editing ? "Edit Client" : "New Client"}
            </h2>
            <button onClick={resetForm} className="text-ink-400 hover:text-ink-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="input-field" placeholder="Company name *" />
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} className="input-field" placeholder="Contact name" />
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" placeholder="Email" type="email" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field" placeholder="Phone" />
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input-field resize-none mb-4" rows={2} placeholder="Notes (optional)" />
          <button onClick={handleSave} disabled={saving || !companyName.trim()} className="btn-primary text-sm">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : editing ? "Update Client" : "Add Client"}
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="h-4 bg-surface-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-surface-100 rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="w-10 h-10 text-ink-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-ink-700 mb-1">No clients yet</h3>
          <p className="text-sm text-ink-400">Add your first client to start creating proposals</p>
        </div>
      ) : (
        <div className="space-y-2">
          {paginatedClients.map((c) => (
            <div key={c.id} className="card p-5 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-ink-800">{c.company_name}</div>
                <div className="flex items-center gap-3 mt-1 text-xs text-ink-400">
                  {c.contact_name && <span>{c.contact_name}</span>}
                  {c.email && <span>{c.email}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Link
                  href={`/dashboard/proposals/new?client=${c.id}`}
                  className="btn-ghost text-xs text-brand-600"
                >
                  New Proposal
                </Link>
                <button onClick={() => startEdit(c)} className="p-1.5 text-ink-400 hover:text-ink-700 rounded-lg">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(c.id)} className="p-1.5 text-ink-400 hover:text-red-600 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          <ListPagination page={page} totalItems={clients.length} onPageChange={setPage} className="pt-4" />
        </div>
      )}
    </div>
  );
}
