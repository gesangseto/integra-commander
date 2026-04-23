import BaseModel from '../BaseModel';

class MstUser extends BaseModel {
  static table = 'mst_user';
  static schema = {
    id: 'INTEGER PRIMARY KEY AUTOINCREMENT',
    created_date: 'TEXT',
    modified_date: 'TEXT',
    employee_id: 'TEXT',

    created_by: 'TEXT',
    modified_by: 'TEXT',
    delete_flag: 'TEXT',

    email: 'TEXT',
    full_name: 'TEXT',
    last_login: 'TEXT',
    pwd: 'TEXT',
    status: 'TEXT',
    is_sys: 'TEXT',
    tlp: 'TEXT',
    username: 'TEXT',
    mst_avatar_id: 'TEXT',
    mst_position_id: 'TEXT',
    mst_section_id: 'TEXT',
    mst_department_id: 'TEXT',
    login_attempt: 'TEXT',
    conf_app: 'TEXT',
    static_token: 'TEXT',
    static_role: 'TEXT',
    password_must_change: 'TEXT',
  };
}
export default MstUser;
