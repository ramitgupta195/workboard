const ftp = require('basic-ftp');

const REMOTE_BASE = process.env.FTP_BASE_PATH || '/workboard/attachments';

function ftpConfig() {
  return {
    host:     process.env.FTP_HOST,
    user:     process.env.FTP_USER,
    password: process.env.FTP_PASSWORD,
    port:     parseInt(process.env.FTP_PORT || '21'),
    secure:   process.env.FTP_SECURE === 'true' ? 'implicit' : false,
  };
}

function isConfigured() {
  return !!(process.env.FTP_HOST && process.env.FTP_USER && process.env.FTP_PASSWORD);
}

async function getClient() {
  const client = new ftp.Client();
  client.ftp.verbose = false;
  await client.access(ftpConfig());
  return client;
}

// Upload a local file to files.com, return the remote path
async function uploadFile(localPath, filename) {
  const client = await getClient();
  try {
    await client.ensureDir(REMOTE_BASE);
    const remotePath = `${REMOTE_BASE}/${filename}`;
    await client.uploadFrom(localPath, remotePath);
    return remotePath;
  } finally {
    client.close();
  }
}

// Delete a file from files.com by its remote path
async function deleteFile(remotePath) {
  if (!remotePath) return;
  const client = await getClient();
  try {
    await client.remove(remotePath);
  } catch (_) {
    // ignore — file may have already been deleted
  } finally {
    client.close();
  }
}

// Stream a file from files.com into a writable stream (e.g. Express res)
async function downloadFile(remotePath, writableStream) {
  const client = await getClient();
  try {
    await client.downloadTo(writableStream, remotePath);
  } finally {
    client.close();
  }
}

module.exports = { isConfigured, uploadFile, deleteFile, downloadFile };
