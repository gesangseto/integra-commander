import { Command } from '@tauri-apps/plugin-shell';
import { exists, remove, copyFile } from '@tauri-apps/plugin-fs';

const runCommand = async (cmd, args, cwd) => {
  const command = Command.create(cmd, args, {
    cwd,
  });

  const output = await command.execute();

  if (output.code !== 0) {
    throw new Error(output.stderr);
  }

  return output.stdout;
};

const writeEnvFile = async (path, content) => {
  const fs = await import('@tauri-apps/plugin-fs');

  await fs.writeTextFile(path, content);
};

export const deployApp = async ({
  appName,
  gitUrl,
  workingDirectory,
  serviceName,
  envContent,
}) => {
  const tempDir = `${workingDirectory}/temp/${serviceName}`;
  const serviceDir = `${workingDirectory}/service/${serviceName}`;

  try {
    // =========================
    // CLEAN TEMP
    // =========================

    const tempExist = await exists(tempDir);

    if (tempExist) {
      await remove(tempDir, {
        recursive: true,
      });
    }

    // =========================
    // GIT CLONE
    // =========================

    await runCommand(
      'cmd',
      ['/C', 'git', 'clone', gitUrl, tempDir],
      workingDirectory,
    );

    // =========================
    // WRITE ENV
    // =========================

    await writeEnvFile(`${tempDir}/.env`, envContent);

    // =========================
    // NPM INSTALL
    // =========================

    await runCommand('cmd', ['/C', 'npm', 'install'], tempDir);

    // =========================
    // BUILD
    // =========================

    await runCommand('cmd', ['/C', 'npm', 'run', 'build'], tempDir);

    // =========================
    // REMOVE OLD SERVICE
    // =========================

    const serviceExist = await exists(serviceDir);

    if (serviceExist) {
      await remove(serviceDir, {
        recursive: true,
      });
    }

    // =========================
    // COPY BUILD
    // =========================

    await runCommand(
      'cmd',
      ['/C', 'xcopy', tempDir, serviceDir, '/E', '/I', '/Y'],
      workingDirectory,
    );

    // =========================
    // CHECK PM2
    // =========================

    const pm2List = await runCommand(
      'cmd',
      ['/C', 'pm2', 'jlist'],
      workingDirectory,
    );

    if (pm2List.includes(`"name":"${appName}"`)) {
      await runCommand('cmd', ['/C', 'pm2', 'reload', appName], serviceDir);
    } else {
      await runCommand(
        'cmd',
        ['/C', 'pm2', 'start', 'dist/index.js', '--name', appName],
        serviceDir,
      );
    }

    // =========================
    // CLEANUP
    // =========================

    await remove(tempDir, {
      recursive: true,
    });

    return true;
  } catch (err) {
    console.error(err);

    throw err;
  }
};
