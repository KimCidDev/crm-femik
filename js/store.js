// Camada de dados do CRM FEMIK.
// A interface lê tudo de um cache em memória (store.data); as escritas passam
// por um adaptador: LocalAdapter (modo demonstração, localStorage) ou
// SupabaseAdapter (produção: Postgres + Auth + Storage + Realtime).

import { CONFIG, DEMO_MODE } from './config.js';
import { seedData, TABLES } from './data.js';

const LS_DATA = 'femik-crm-v1';
const LS_SESSION = 'femik-crm-session';
const DEMO_FILE_LIMIT = 1.5 * 1024 * 1024; // localStorage tem ~5 MB no total

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      }));
const nowISO = () => new Date().toISOString();

const STORAGE_OK = (() => { try { localStorage.setItem('__crm_t', '1'); localStorage.removeItem('__crm_t'); return true; } catch { return false; } })();
function lsGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function lsSet(key, val) { try { localStorage.setItem(key, val); return true; } catch { return false; } }
function lsDel(key) { try { localStorage.removeItem(key); } catch { /* ignore */ } }

// ---------------------------------------------------------------------------
class LocalAdapter {
  constructor() { this.kind = 'demo'; }
  async init() {}
  async loadAll() {
    const raw = lsGet(LS_DATA);
    if (raw) {
      try {
        const data = JSON.parse(raw);
        for (const t of TABLES) data[t] = data[t] || [];
        return data;
      } catch { /* dados corrompidos: recomeça do seed */ }
    }
    const data = seedData();
    this.save(data);
    return data;
  }
  save(data) {
    if (!STORAGE_OK) return; // navegador sem armazenamento: os dados ficam só na memória desta sessão
    if (!lsSet(LS_DATA, JSON.stringify(data))) {
      throw new Error('O armazenamento deste aparelho está cheio. Exporte um backup e remova anexos grandes.');
    }
  }
  async getSessionUserId() { return lsGet(LS_SESSION); }
  async signInDemo(profileId) { lsSet(LS_SESSION, profileId); }
  async signOut() { lsDel(LS_SESSION); }
  async insert(_t, row) { return row; }
  async update(_t, _id, _patch, merged) { return merged; }
  async remove() {}
  async upload(file) {
    if (file.size > DEMO_FILE_LIMIT) {
      throw new Error('No modo demonstração o limite é 1,5 MB por arquivo. Com o Supabase ligado o limite sobe para 50 MB.');
    }
    const dataUrl = await new Promise((res, rej) => {
      const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file);
    });
    return { data_url: dataUrl, path: '' };
  }
  async fileUrl(rec) { return rec.data_url; }
  async removeFile() {}
  subscribe() {}
  reset() { lsDel(LS_DATA); }
}

// ---------------------------------------------------------------------------
class SupabaseAdapter {
  constructor() { this.kind = 'supabase'; this.sb = null; }
  async init() {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.49.4');
    this.sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  async loadAll() {
    const data = {};
    await Promise.all(TABLES.map(async (t) => {
      let q = this.sb.from(t).select('*');
      if (t === 'audit_log') q = q.order('at', { ascending: false }).limit(1000);
      const { data: rows, error } = await q;
      if (error) throw new Error(`Erro ao carregar ${t}: ${error.message}`);
      data[t] = rows || [];
    }));
    return data;
  }
  async getSessionUserId() {
    const { data } = await this.sb.auth.getSession();
    return data.session ? data.session.user.id : null;
  }
  async signInPassword(email, password) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message);
  }
  async resetPassword(email) {
    const { error } = await this.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error) throw new Error(error.message);
  }
  async updatePassword(password) {
    const { error } = await this.sb.auth.updateUser({ password });
    if (error) throw new Error(error.message);
  }
  async signOut() { await this.sb.auth.signOut(); }
  async insert(t, row) {
    const { data, error } = await this.sb.from(t).insert(row).select().single();
    if (error) throw new Error(error.message);
    return data;
  }
  async update(t, id, patch) {
    const { data, error } = await this.sb.from(t).update(patch).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  }
  async remove(t, id) {
    const { error } = await this.sb.from(t).delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
  async upload(file, leadId) {
    const safe = file.name.normalize('NFD').replace(/[^\w.\-]+/g, '_');
    const path = `${leadId}/${uid()}-${safe}`;
    const { error } = await this.sb.storage.from(CONFIG.STORAGE_BUCKET).upload(path, file, { contentType: file.type || undefined });
    if (error) throw new Error(error.message);
    return { path, data_url: null };
  }
  async fileUrl(rec) {
    const { data, error } = await this.sb.storage.from(CONFIG.STORAGE_BUCKET).createSignedUrl(rec.path, 3600);
    if (error) throw new Error(error.message);
    return data.signedUrl;
  }
  async removeFile(rec) {
    if (rec.path) await this.sb.storage.from(CONFIG.STORAGE_BUCKET).remove([rec.path]);
  }
  subscribe(cb) {
    this.sb.channel('crm-femik')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => cb(payload))
      .subscribe();
  }
}

// ---------------------------------------------------------------------------
class Store {
  constructor() {
    this.adapter = DEMO_MODE ? new LocalAdapter() : new SupabaseAdapter();
    this.data = Object.fromEntries(TABLES.map((t) => [t, []]));
    this.user = null;
    this.listeners = new Set();
  }
  get demo() { return this.adapter.kind === 'demo'; }

  async start() {
    await this.adapter.init();
    const userId = await this.adapter.getSessionUserId();
    if (!userId) {
      if (this.demo) this.data = await this.adapter.loadAll();
      return false;
    }
    return this.loadForUser(userId);
  }
  async loadForUser(userId) {
    this.data = await this.adapter.loadAll();
    this.user = this.data.profiles.find((p) => p.id === userId) || null;
    if (!this.user) {
      if (this.demo) { await this.adapter.signOut(); return false; }
      throw new Error('A sua conta ainda não tem perfil no CRM. Peça ao administrador para ativá-la.');
    }
    if (this.user.active === false) throw new Error('A sua conta está desativada. Fale com o administrador.');
    if (!this.demo) this.adapter.subscribe((p) => this.applyRemote(p));
    return true;
  }
  async signInDemo(profileId) { await this.adapter.signInDemo(profileId); return this.loadForUser(profileId); }
  async signInPassword(email, pw) {
    await this.adapter.signInPassword(email, pw);
    return this.loadForUser(await this.adapter.getSessionUserId());
  }
  async signOut() { await this.adapter.signOut(); this.user = null; }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(info) { this.listeners.forEach((fn) => fn(info)); }

  applyRemote({ table, eventType, new: row, old }) {
    if (!this.data[table]) return;
    const list = this.data[table];
    if (eventType === 'DELETE') {
      this.data[table] = list.filter((r) => r.id !== old.id);
    } else {
      const i = list.findIndex((r) => r.id === row.id);
      if (i >= 0) list[i] = row; else if (table === 'audit_log') list.unshift(row); else list.push(row);
      if (table === 'profiles' && this.user && row.id === this.user.id) this.user = row;
    }
    this.emit({ remote: true, table });
  }

  // --- leitura -------------------------------------------------------------
  all(t) { return this.data[t] || []; }
  get(t, id) { return this.all(t).find((r) => r.id === id) || null; }
  byLead(t, leadId) { return this.all(t).filter((r) => r.lead_id === leadId); }
  profile(id) { return this.get('profiles', id); }
  profileName(id) { const p = this.profile(id); return p ? p.name : '—'; }

  // --- permissões ----------------------------------------------------------
  can(action, record) {
    const role = this.user ? this.user.role : null;
    if (!role) return false;
    if (role === 'admin') return true;
    switch (action) {
      case 'edit': return role === 'comercial';               // leads, histórico, propostas, contratos, documentos
      case 'task': return role === 'comercial' || (record ? record.owner_id === this.user.id : true);
      case 'project': return role === 'comercial' || role === 'tecnico';
      case 'export': return role === 'comercial' || role === 'analista';
      case 'delete': case 'admin': return false;
      default: return false;
    }
  }

  // --- escrita -------------------------------------------------------------
  stamp(row, isNew) {
    const now = nowISO();
    const out = { ...row, updated_at: now, updated_by: this.user?.id || null };
    if (isNew) { out.created_at = row.created_at || now; out.created_by = this.user?.id || null; }
    return out;
  }
  persist() { if (this.demo) this.adapter.save(this.data); }
  audit(table, record, action, fields) {
    if (!this.demo || table === 'audit_log') return; // no Supabase o registro é feito por trigger no banco
    this.data.audit_log.unshift({
      id: uid(), at: nowISO(), user_id: this.user?.id || null, table_name: table, record_id: record.id,
      record_label: record.company || record.title || record.name || record.summary?.slice(0, 60) || '',
      lead_id: table === 'leads' ? record.id : (record.lead_id || null),
      action, fields: fields || [],
    });
    if (this.data.audit_log.length > 2000) this.data.audit_log.length = 2000;
  }

  async insert(t, row) {
    const full = this.stamp({ id: uid(), ...row }, true);
    const saved = await this.adapter.insert(t, full);
    this.data[t].push(saved);
    this.audit(t, saved, 'insert');
    this.persist(); this.emit({ table: t });
    return saved;
  }
  async update(t, id, patch) {
    const cur = this.get(t, id);
    if (!cur) throw new Error('Registro não encontrado.');
    const changed = Object.keys(patch).filter((k) => JSON.stringify(cur[k]) !== JSON.stringify(patch[k]));
    if (!changed.length) return cur;
    const p = this.stamp(patch, false);
    const saved = await this.adapter.update(t, id, p, { ...cur, ...p });
    Object.assign(cur, saved);
    if (t === 'profiles' && this.user && id === this.user.id) this.user = cur;
    this.audit(t, cur, 'update', changed);
    this.persist(); this.emit({ table: t });
    return cur;
  }
  async remove(t, id) {
    const cur = this.get(t, id);
    if (!cur) return;
    if (t === 'files') await this.adapter.removeFile(cur);
    await this.adapter.remove(t, id);
    this.data[t] = this.data[t].filter((r) => r.id !== id);
    if (t === 'leads' && this.demo) {
      for (const child of ['interactions', 'tasks', 'proposals', 'contracts', 'files']) {
        this.data[child] = this.data[child].filter((r) => r.lead_id !== id);
      }
    }
    this.audit(t, cur, 'delete');
    this.persist(); this.emit({ table: t });
  }
  async uploadFile(file, leadId, kind) {
    const meta = await this.adapter.upload(file, leadId);
    return this.insert('files', {
      lead_id: leadId, kind, name: file.name, size: file.size, mime: file.type || '', path: meta.path, data_url: meta.data_url,
    });
  }
  fileUrl(rec) { return this.adapter.fileUrl(rec); }

  // --- operações de negócio --------------------------------------------------
  async moveStage(leadId, stage, extra = {}) {
    const now = nowISO();
    const patch = { stage, stage_changed_at: now, ...extra };
    if (stage === 'ganho') patch.won_at = now;
    if (stage === 'perdido') patch.lost_at = now;
    if (stage !== 'perdido') patch.lost_reason = extra.lost_reason || '';
    return this.update('leads', leadId, patch);
  }
  async logInteraction(leadId, type, summary, at) {
    const when = at || nowISO();
    const rec = await this.insert('interactions', { lead_id: leadId, type, summary, at: when, user_id: this.user.id });
    const lead = this.get('leads', leadId);
    if (lead && (!lead.last_contact_at || lead.last_contact_at < when) && type !== 'nota') {
      await this.update('leads', leadId, { last_contact_at: when });
    }
    return rec;
  }

  // --- backup / dados iniciais ---------------------------------------------
  exportJSON() {
    const out = { app: 'crm-femik', version: CONFIG.VERSION, exported_at: nowISO(), data: {} };
    for (const t of TABLES) {
      out.data[t] = this.all(t).map((r) => (t === 'files' ? { ...r, data_url: r.data_url ? '[anexo omitido]' : null } : r));
    }
    return out;
  }
  async importJSON(obj) {
    if (!this.demo) throw new Error('A restauração por arquivo só existe no modo demonstração.');
    if (!obj || obj.app !== 'crm-femik' || !obj.data) throw new Error('Arquivo de backup inválido.');
    for (const t of TABLES) this.data[t] = obj.data[t] || [];
    this.persist(); this.emit({ table: '*' });
  }
  resetDemo() { this.adapter.reset(); }

  // No Supabase: importa os leads, tarefas, histórico e serviços iniciais,
  // ligando os responsáveis por e-mail aos perfis que já existem.
  async importSeedToSupabase() {
    const seed = seedData();
    const byEmail = Object.fromEntries(this.all('profiles').map((p) => [p.email?.toLowerCase(), p.id]));
    const seedEmail = Object.fromEntries(seed.profiles.map((p) => [p.id, p.email.toLowerCase()]));
    const owner = (seedId) => byEmail[seedEmail[seedId]] || this.user.id;
    const idMap = {};
    if (!this.all('services').length) {
      for (const s of seed.services) {
        const { id, created_at, ...rest } = s;
        await this.insert('services', rest);
      }
    }
    for (const l of seed.leads) {
      const { id, created_at, updated_at, created_by, updated_by, ...rest } = l;
      const saved = await this.insert('leads', { ...rest, owner_id: owner(l.owner_id) });
      idMap[id] = saved.id;
    }
    for (const t of seed.tasks) {
      const { id, created_at, updated_at, created_by, ...rest } = t;
      await this.insert('tasks', { ...rest, lead_id: idMap[t.lead_id], owner_id: owner(t.owner_id) });
    }
    for (const i of seed.interactions) {
      const { id, created_at, ...rest } = i;
      await this.insert('interactions', { ...rest, lead_id: idMap[i.lead_id], user_id: this.user.id });
    }
  }
}

export const store = new Store();
