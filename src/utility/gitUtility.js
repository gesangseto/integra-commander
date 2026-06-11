import { runCommand } from '.';
import { useSettingStore } from '../store/settingStore';
let url_fe = 'https://gitlab.com/mertrack/mertrack_frontend';
let url_be = 'https://gitlab.com/mertrack/mertrack-core';
let url_bpom = 'https://gitlab.com/gesang/connector-bpom';
let cwd = useSettingStore.getState().form.workingDirectory;

function makeGitUrl(url, { username, password }) {
  return url.replace(
    'https://',
    `https://${encodeURIComponent(username)}:${encodeURIComponent(password)}@`,
  );
}

export async function gitValidation(options) {
  try {
    const url = makeGitUrl(url_be, options);
    const result = await runCommand(['/C', 'git', 'ls-remote', url, 'HEAD']);
    return { error: false, message: 'Git credentials are valid.' };
  } catch (error) {
    return { error: true, message: error.stderr || error.message };
  }
}

export async function gitCloneBe(options) {
  const { username, password, branch, directory } = options;
  try {
    const url = makeGitUrl(url_be, options);
    let command = ['/C', 'git', 'clone', '--depth', '1'];
    if (branch) {
      command.push('-b');
      command.push(branch);
    }
    command.push(url);
    command.push(directory);
    await runCommand(command, cwd);

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
    await runCommand(command, cwd);
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

export async function gitCloneBpom(options) {
  const { username, password, directory } = options;
  try {
    const url = makeGitUrl(url_bpom, options);
    let command = ['/C', 'git', 'clone', '--depth', '1', url, directory];
    await runCommand(command, cwd);
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
