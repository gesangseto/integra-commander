import BaseModel from '../BaseModel';

class appConfig extends BaseModel {
  static table = 'app_config';
  static schema = {
    id: 'INTEGER PRIMARY KEY AUTOINCREMENT',

    name: 'TEXT',
    code: 'TEXT',
    type: 'TEXT',

    ip_server: 'TEXT',
    port_server: 'INTEGER',
    timeout_server: 'INTEGER',

    username: 'TEXT',
    password: 'TEXT',
    is_superadmin: 'INTEGER',

    scanner1_name: 'TEXT',
    scanner1_model: 'TEXT',
    scanner1_comport: 'TEXT',
    scanner1_baudrate: 'INTEGER',

    scanner2_name: 'TEXT',
    scanner2_model: 'TEXT',
    scanner2_comport: 'TEXT',
    scanner2_baudrate: 'INTEGER',

    weighing_name: 'TEXT',
    weighing_model: 'TEXT',
    weighing_comport: 'TEXT',
    weighing_baudrate: 'INTEGER',
    weighing_databit: 'INTEGER',
    weighing_mode: 'TEXT',

    printer_name: 'TEXT',
    printer_model: 'TEXT',
    printer_devicename: 'TEXT',
    printer_connection: 'TEXT',
  };
}

export const initConfig = () => {
  return {
    name: 'Pack Master',
    code: 'AG-5A0DC3AA-3385-6C4B-A7AE-2D07C880C436',
    type: 'offline',

    ip_server: '127.0.0.1',
    port_server: '81',
    timeout_server: '5000',

    username: 'super_admin',
    password: 'superadmin1234',
    is_superadmin: 1,

    scanner1_name: 'SCN1',
    scanner1_model: 'Zebra-10029',
    scanner1_comport: 'COM24',
    scanner1_baudrate: '9600',

    scanner2_name: 'SCN2',
    scanner2_model: 'Zebra-10029',
    scanner2_comport: 'COM26',
    scanner2_baudrate: '9600',

    weighing_name: 'WGH1',
    weighing_model: 'AND_FG',
    weighing_comport: 'COM22',
    weighing_baudrate: '2400',
    weighing_databit: '7',
    weighing_mode: 'once',

    printer_name: 'LPRN1',
    printer_model: 'ZEBRA_ZD230',
    printer_devicename: 'ZD230_203dpi_ZPL_USB_1',
    printer_connection: 'usb',
  };
};
export default appConfig;
