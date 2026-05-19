const BASE = () => `https://${process.env.FILES_SUBDOMAIN}.files.com/api/rest/v1`;

function ah() {
  const key = process.env.FILES_API_KEY;
  if (!key) throw new Error('FILES_API_KEY env var is not set');
  return { 'X-FilesAPI-Key': key };
}

function encodePath(p) {
  return p.replace(/^\//, '').split('/').map(s => encodeURIComponent(s)).join('/');
}

async function ensureParentFolder(filePath) {
  const segments = filePath.replace(/^\//, '').split('/');
  segments.pop();
  for (let i = 1; i <= segments.length; i++) {
    const dir = segments.slice(0, i).join('/');
    const res = await fetch(`${BASE()}/folders/${dir}`, { method: 'POST', headers: ah() });
    if (!res.ok && res.status !== 422) {
      console.warn(`[files.com] ensureFolder ${dir} → ${res.status}`);
    }
  }
}

async function beginUpload(filePath) {
  await ensureParentFolder(filePath);
  const res = await fetch(`${BASE()}/file_actions/begin_upload/${encodePath(filePath)}`, {
    method: 'POST',
    headers: { ...ah(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ parts: 1 }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Files.com begin_upload ${res.status}: ${txt}`);
  }
  return res.json(); // array of parts
}

async function completeUpload(filePath, ref, etag) {
  const res = await fetch(`${BASE()}/files/${encodePath(filePath)}`, {
    method: 'POST',
    headers: { ...ah(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'end', ref, ...(etag ? { etags: [{ part: 1, etag }] } : {}) }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Files.com complete_upload ${res.status}: ${txt}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

async function getDownloadUrl(filePath) {
  const res = await fetch(`${BASE()}/files/${encodePath(filePath)}?action=download`, {
    headers: ah(),
    redirect: 'manual',
  });
  if (res.status === 302 || res.status === 301) return res.headers.get('location');
  if (res.ok) {
    const data = await res.json().catch(() => ({}));
    return data.download_uri || data.link || null;
  }
  throw new Error(`Files.com download ${res.status}`);
}

async function deleteFile(filePath) {
  if (!filePath) return;
  const res = await fetch(`${BASE()}/files/${encodePath(filePath)}`, {
    method: 'DELETE',
    headers: ah(),
  });
  if (!res.ok && res.status !== 404) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Files.com delete ${res.status}: ${txt}`);
  }
}

function isConfigured() {
  return !!(process.env.FILES_SUBDOMAIN && process.env.FILES_API_KEY);
}

module.exports = { isConfigured, beginUpload, completeUpload, getDownloadUrl, deleteFile };
