import BaseModel from '../BaseModel';

class MstSectionRole extends BaseModel {
  static table = 'mst_section_role';
  static schema = {
    id: 'INTEGER PRIMARY KEY AUTOINCREMENT',
    mst_menu_id: 'INTEGER',
    mst_section_id: 'INTEGER',
    access: 'INTEGER',
    approve: 'INTEGER',
  };
}
export default MstSectionRole;
