import BaseModel from '../BaseModel';

class MstMenu extends BaseModel {
  static table = 'mst_menu';
  static schema = {
    id: 'INTEGER PRIMARY KEY AUTOINCREMENT',

    icon: 'TEXT',
    label: 'TEXT',
    link: 'TEXT',
    mst_menu_id: 'TEXT',
    status: 'TEXT',
    _name: 'TEXT',
    type: 'TEXT',
    show_create: 'TEXT',
    show_read: 'TEXT',
    show_update: 'TEXT',
    show_delete: 'TEXT',
    show_approve: 'TEXT',
    show_print: 'TEXT',
    remarks_required: 'TEXT',
    sa: 'TEXT',
    order_no: 'TEXT',
    batch_active: 'TEXT',
    batch_inactive: 'TEXT',
    diff_approval: 'TEXT',
  };
}
export default MstMenu;
