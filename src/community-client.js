'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_API = 'https://5.rakanki.com';
const ADMIN_TOKEN_PATTERN = /^dlss5_admin_[A-Za-z0-9_-]{43}$/;

function validState(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

class CommunityClient {
  constructor({ file, baseUrl = DEFAULT_API, fetchImpl = global.fetch, getAdminToken = () => null } = {}) {
    if (!file) throw new Error('community state file is required');
    this.file = file;
    this.baseUrl = String(baseUrl).replace(/\/$/, '');
    this.fetch = fetchImpl;
    this.getAdminToken = getAdminToken;
    this.state = null;
  }

  load() {
    if (this.state) return this.state;
    try { this.state = validState(JSON.parse(fs.readFileSync(this.file, 'utf8'))); }
    catch { this.state = {}; }
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(this.state.installId || '')) {
      this.state.installId = crypto.randomBytes(24).toString('base64url');
      this.save();
    }
    this.state.profile = validState(this.state.profile);
    return this.state;
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(this.state, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporary, this.file);
  }

  async request(method, pathname, { body, etag, write = false, adminToken = null } = {}) {
    const headers = { accept: 'application/json' };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (etag) headers['if-none-match'] = etag;
    if (write) headers['x-install'] = this.load().installId;
    if (adminToken) headers.authorization = `Bearer ${adminToken}`;
    let response;
    try {
      response = await this.fetch(this.baseUrl + pathname, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(10_000)
      });
    } catch (error) {
      throw Object.assign(new Error('Community service is unavailable. Check your connection and try again.'), {
        code: 'community_offline', cause: error
      });
    }
    if (response.status === 304) return { notModified: true, etag: response.headers.get('etag') || etag || null };
    let data = {};
    try { data = await response.json(); } catch { /* handled as a status error below */ }
    if (!response.ok) {
      throw Object.assign(new Error(data.message || 'Community request failed.'), {
        code: data.error || 'community_failed', status: response.status
      });
    }
    return { data, etag: response.headers.get('etag') || null };
  }

  profile() {
    const profile = { name: null, icon: 0, ...this.load().profile };
    const admin = this.getAdminToken() ? (this.load().adminProfile || null) : null;
    return admin ? { ...profile, admin } : profile;
  }

  async adminLogin(value) {
    const token = String(value || '').trim();
    if (!ADMIN_TOKEN_PATTERN.test(token)) throw Object.assign(new Error('Invalid administrator access code.'), { code: 'admin_unauthorized' });
    const { data } = await this.request('POST', '/v1/admin/session', { body: {}, adminToken: token });
    this.load().adminProfile = data.admin;
    this.save();
    return data.admin;
  }

  async adminStatus() {
    const token = this.getAdminToken();
    if (!token) return null;
    try {
      const { data } = await this.request('POST', '/v1/admin/session', { body: {}, adminToken: token });
      this.load().adminProfile = data.admin;
      this.save();
      return data.admin;
    } catch (error) {
      if (error.code === 'admin_unauthorized') { delete this.load().adminProfile; this.save(); }
      throw error;
    }
  }

  adminLogout() {
    delete this.load().adminProfile;
    this.save();
    return { ok: true };
  }

  async saveProfile(profile) {
    const { data } = await this.request('PUT', '/v1/me', { body: profile, write: true });
    this.load().profile = { name: data.name || null, icon: Number(data.icon) || 0, tag: data.tag || null };
    this.save();
    return this.profile();
  }

  async deleteMe() {
    const { data } = await this.request('DELETE', '/v1/me', { write: true });
    this.load().profile = {};
    this.save();
    return data;
  }

  async cards(filters = {}) {
    return (await this.cardsPage(filters)).cards;
  }

  async myReports() {
    return (await this.request('GET', '/v1/me/reports', { write: true })).data;
  }

  async cardsPage(filters = {}) {
    const query = new URLSearchParams();
    for (const key of ['q', 'route', 'api', 'status', 'limit', 'offset']) {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '' && filters[key] !== 'all') {
        query.set(key, String(filters[key]));
      }
    }
    let pathname = `/v1/cards${query.size ? `?${query}` : ''}`;
    if (filters.fresh) pathname = this.fresh(pathname);
    const data = (await this.request('GET', pathname)).data;
    this.absolutizeAssets(data);
    return { cards: data.cards || [], total: Number(data.total) || 0 };
  }

  // Reads are cached at the edge for fifteen seconds, which is right for
  // everyone except the person who just wrote: they would be handed the state
  // from before their own change. `fresh` makes it a different URL, so the
  // answer comes from the origin.
  fresh(pathname) {
    return `${pathname}${pathname.includes('?') ? '&' : '?'}fresh=${Date.now().toString(36)}`;
  }

  async card(key, etag, { fresh = false } = {}) {
    let pathname = `/v1/cards/${encodeURIComponent(key)}`;
    if (fresh) pathname = this.fresh(pathname);
    const result = await this.request('GET', pathname, { etag });
    if (result.data) this.absolutizeAssets(result.data);
    return result;
  }

  async updates(key, since, etag) {
    return this.request('GET', `/v1/cards/${encodeURIComponent(key)}/updates?since=${Number(since) || 0}`, { etag });
  }

  async replies(reportId, { fresh = false } = {}) {
    let pathname = `/v1/reports/${encodeURIComponent(reportId)}/replies`;
    if (fresh) pathname = this.fresh(pathname);
    const data = (await this.request('GET', pathname)).data;
    this.absolutizeAssets(data);
    return data;
  }

  absolutizeAssets(value) {
    if (!value || typeof value !== 'object') return value;
    if (value.by && typeof value.by.avatar === 'string' && value.by.avatar.startsWith('/')) {
      value.by.avatar = this.baseUrl + value.by.avatar;
    }
    if (value.art && typeof value.art === 'object') {
      for (const key of ['poster', 'hero']) {
        if (typeof value.art[key] === 'string' && value.art[key].startsWith('/')) value.art[key] = this.baseUrl + value.art[key];
      }
    }
    for (const item of Array.isArray(value) ? value : Object.values(value)) this.absolutizeAssets(item);
    return value;
  }

  async reply(reportId, body, mentions) {
    const token = this.getAdminToken();
    if (token) {
      return (await this.request('POST', '/v1/admin/replies', {
        body: { reportId, body, mentions }, adminToken: token
      })).data;
    }
    return (await this.request('POST', `/v1/reports/${encodeURIComponent(reportId)}/replies`, {
      body: { body, mentions }, write: true
    })).data;
  }

  async editReply(id, body) {
    const token = this.getAdminToken();
    if (token && /^admin-\d+$/.test(String(id))) {
      return (await this.request('PUT', `/v1/admin/replies/${encodeURIComponent(id)}`, {
        body: { body }, adminToken: token
      })).data;
    }
    return (await this.request('PUT', `/v1/replies/${encodeURIComponent(id)}`, { body: { body }, write: true })).data;
  }

  async adminModerate(kind, id, action) {
    const token = this.getAdminToken();
    if (!token) throw Object.assign(new Error('Administrator mode is required.'), { code: 'admin_unauthorized' });
    return (await this.request('POST', '/v1/admin/moderate', {
      body: { kind, id, action }, adminToken: token
    })).data;
  }

  // Following a game, and what has been addressed to this install since the
  // last id it saw. The cursor is kept here so the app can be closed for a week
  // and still be told what it missed - once each.
  async follow(key, on = true) {
    return (await this.request('POST', `/v1/cards/${encodeURIComponent(key)}/watch`, { body: { on }, write: true })).data;
  }

  async notices() {
    const state = this.load();
    const since = Number(state.noticeCursor) || 0;
    const { data } = await this.request('GET', `/v1/me/notices?since=${since}`, { write: true });
    if (data && typeof data.cursor === 'number') { state.noticeCursor = data.cursor; this.save(); }
    if (data && data.me) { state.profile = { ...state.profile, ...data.me }; this.save(); }
    return data;
  }

  async readNotices() {
    const upTo = Number(this.load().noticeCursor) || 0;
    return (await this.request('POST', '/v1/me/notices/read', { body: { upTo }, write: true })).data;
  }

  // Starting fresh on a machine that has been away for months should not open
  // with a hundred pop-ups; the first look only learns where the line is.
  async noticeCatchUp() {
    const state = this.load();
    if (state.noticeCursor !== undefined) return false;
    const { data } = await this.request('GET', '/v1/me/notices?since=0', { write: true });
    state.noticeCursor = (data && Number(data.cursor)) || 0;
    if (data && data.me) state.profile = { ...state.profile, ...data.me };
    this.save();
    return true;
  }

  async withdrawReply(id) {
    const token = this.getAdminToken();
    if (token && /^admin-\d+$/.test(String(id))) {
      return (await this.request('DELETE', `/v1/admin/replies/${encodeURIComponent(id)}`, { adminToken: token })).data;
    }
    return (await this.request('DELETE', `/v1/replies/${encodeURIComponent(id)}`, { write: true })).data;
  }

  async report(payload) {
    return (await this.request('POST', '/v1/reports', { body: payload, write: true })).data;
  }

  async withdraw(id) {
    return (await this.request('DELETE', `/v1/reports/${encodeURIComponent(id)}`, { write: true })).data;
  }

  async react(id, emoji, on = true) {
    return (await this.request('POST', `/v1/comments/${encodeURIComponent(id)}/reactions`, {
      body: { emoji, on: on !== false }, write: true
    })).data;
  }
}

module.exports = { CommunityClient, DEFAULT_API, ADMIN_TOKEN_PATTERN };
