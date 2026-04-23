import appConfig from './mertrack/AppConfig';

const mainModels = [appConfig];

export async function syncStructureMain() {
  for (const model of mainModels) {
    await model.sync();
  }
}
