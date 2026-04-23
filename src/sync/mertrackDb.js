import appConfig, { initConfig } from '../models/mertrack/AppConfig';

export const syncAppConfig = async () => {
  let getData = await appConfig.findOne({ where: { id: 1 } });
  if (!getData) {
    await appConfig.create(initConfig());
    getData = await appConfig.findOne({ where: { id: 1 } });
  }
  return getData;
};
