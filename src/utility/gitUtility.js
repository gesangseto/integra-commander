import { runCommand } from '.';
import { useSettingStore } from '../store/settingStore';
let url_fe = 'https://gitlab.com/mertrack/mertrack_frontend';
let url_be = 'https://gitlab.com/mertrack/mertrack-core';
let url_bpom = 'https://gitlab.com/gesang/connector-bpom';

// Resolve cwd saat dipakai (bukan saat module di-import) supaya selalu
// mengikuti working directory terbaru dari store.
const getWorkingDir = () =>
  useSettingStore.getState().form.workingDirectory || undefined;

function makeGitUrl(url, { username, password }) {
  return url.replace(
    'https://',
    `https://${encodeURIComponent(username)}:${encodeURIComponent(password)}@`,
  );
}

// Branch + commit terakhir yang benar-benar ter-checkout di hasil clone.
// Kalau Settings tidak mengisi branch, `branch` berisi branch default repo.
// Gagal membaca (mis. folder bukan repo) menghasilkan nilai kosong, tanpa
// membatalkan proses yang sedang berjalan.
export async function gitVersionInfo(directory) {
  const empty = { branch: '', commit: '', message: '' };
  try {
    const branch = await runCommand(
      ['/C', 'git', 'rev-parse', '--abbrev-ref', 'HEAD'],
      directory,
    );
    // %x1f = pemisah Unit Separator, aman untuk pesan commit apa pun.
    const last = await runCommand(
      ['/C', 'git', 'log', '-1', '--pretty=format:%H%x1f%s%x1f%B'],
      directory,
    );
    const [commit = '', subject = '', body = ''] = (last.stdout || '')
      .trim()
      .split('\x1f');

    return {
      branch: (branch.stdout || '').trim(),
      commit,
      message: (body || subject).trim(),
    };
  } catch {
    return empty;
  }
}

export async function gitValidation(options) {
  try {
    const url = makeGitUrl(url_be, options);
    await runCommand(['/C', 'git', 'ls-remote', url, 'HEAD']);
    return { error: false, message: 'Git credentials are valid.' };
  } catch (error) {
    return { error: true, message: error.stderr || error.message };
  }
}

export async function gitCloneFe(options) {
  const { username, password, branch, directory } = options;
  try {
    const url = makeGitUrl(url_fe, options);
    let command = ['/C', 'git', 'clone', '--depth', '1'];
    if (branch) {
      command.push('-b');
      command.push(branch);
    }
    command.push(url);
    command.push(directory);
    await runCommand(command, getWorkingDir());
    return {
      error: false,
      message: 'Repository cloned successfully.',
    };
  } catch (error) {
    return {
      error: true,
      message: error.stderr || error.message,
    };
  }
}

export async function gitClone(options) {
  const { username, password, branch, directory, git_url } = options;
  try {
    const url = makeGitUrl(git_url, { username, password });
    let command = ['/C', 'git', 'clone', '--depth', '1'];
    if (branch) {
      command.push('-b');
      command.push(branch);
    }
    command.push(url);
    command.push(directory);
    await runCommand(command, getWorkingDir());

    return {
      error: false,
      message: 'Repository cloned successfully.',
    };
  } catch (error) {
    return {
      error: true,
      message: error.stderr || error.message,
    };
  }
}
