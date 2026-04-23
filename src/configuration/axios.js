import axios from 'axios';
import { useConfig } from '../store/configStore';
import { showGlobalAlert } from '../component/AlertProvider';
const $axios = axios.create();
$axios.defaults.timeout = 120000;
$axios.interceptors.request.use(
  async (config) => {
    let appConfig = useConfig.getState().config;
    config.baseURL = `http://${appConfig?.ip_server}:${appConfig?.port_server}/api/`;
    config.headers = {
      'Content-Type': 'application/json',
      'User-Type': 'station',
      lang: 'id',
      'mertrackapi-token': appConfig?.code,
    };
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

$axios.interceptors.response.use(
  async (response) => {
    let res = response.data;
    if (res.hasOwnProperty('status_code') && res.status_code == 401) {
    }
    return Promise.resolve(response);
  },
  function (error) {
    console.log(error);
    showGlobalAlert(`${error.message}`, 'error');
    return Promise.reject(error);
  },
);

export default $axios;
