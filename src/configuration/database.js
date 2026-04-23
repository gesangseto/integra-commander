import Database from '@tauri-apps/plugin-sql';

const connections = {};

const DB_MAIN = 'packmaster';

const database = {
  // =============================
  // 🔌 INIT MAIN DB (WAJIB di awal app)
  // =============================
  async initMain() {
    if (!connections[DB_MAIN]) {
      connections[DB_MAIN] = await Database.load(
        `sqlite:${DB_MAIN.toLowerCase()}.db`,
      );
      console.log('✅ Main DB (packmaster) ready');
    }
    return connections[DB_MAIN];
  },

  // =============================
  // 🔌 GET MAIN DB
  // =============================
  async getMain() {
    if (!connections[DB_MAIN]) {
      throw new Error('Main DB belum di-init. Panggil initMain() dulu.');
    }
    return connections[DB_MAIN];
  },

  // =============================
  // 🔌 GET BATCH DB (AUTO CREATE)
  // =============================
  async getBatch(batchNo) {
    if (!batchNo) {
      throw new Error('batchNo wajib diisi');
    }
    const name = `PO_${batchNo}`;
    if (!connections[name]) {
      connections[name] = await Database.load(`sqlite:${name}.db`);
      console.log(`✅ Batch DB "${name}" ready`);
    }
    return connections[name];
  },
  // =============================
  // 🔁 TRANSACTION (optional)
  // =============================
  async transaction(callback, type = 'main', batchNo = null) {
    let db;
    if (type === 'main') {
      db = await this.getMain();
    } else {
      if (!batchNo) {
        throw new Error('batchNo wajib diisi untuk transaction batch');
      }
      db = await this.getBatch(batchNo);
    }
    try {
      await db.execute('BEGIN');
      const result = await callback(db);
      await db.execute('COMMIT');
      return result;
    } catch (err) {
      await db.execute('ROLLBACK');
      throw err;
    }
  },
};

export default database;
