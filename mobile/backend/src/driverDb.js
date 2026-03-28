const mysql = require("mysql2/promise");
const config = require("./config");

let pool;

function hasDriverDbConfig() {
  return Boolean(
    config.driverDbHost &&
      config.driverDbPort &&
      config.driverDbUser &&
      config.driverDbPassword &&
      config.driverDbName
  );
}

function getDriverDbPool() {
  if (!hasDriverDbConfig()) {
    throw new Error("Driver veritabani ayarlari eksik. DB_HOST, DB_PORT, DB_USER, DB_PASSWORD ve DB_NAME tanimlanmali.");
  }

  if (!pool) {
    pool = mysql.createPool({
      host: config.driverDbHost,
      port: config.driverDbPort,
      user: config.driverDbUser,
      password: config.driverDbPassword,
      database: config.driverDbName,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
    });
  }

  return pool;
}

async function findDriverUserByUserName(userName) {
  const normalizedUserName = String(userName || "").trim();
  if (!normalizedUserName) return null;

  const db = getDriverDbPool();
  const [rows] = await db.execute(
    `
      SELECT
        user_id,
        name,
        last_name,
        user_name,
        password,
        role_authority_level,
        email,
        phone_number,
        address,
        created_at,
        updated_at
      FROM users
      WHERE LOWER(user_name) = LOWER(?)
      LIMIT 1
    `,
    [normalizedUserName]
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const user = rows[0];
  const roleAuthority = String(user.role_authority_level || "").trim().toLowerCase();
  if (roleAuthority !== "driver") {
    return null;
  }

  return user;
}

async function closeDriverDb() {
  if (pool) {
    await pool.end();
  }
  pool = null;
}

module.exports = {
  findDriverUserByUserName,
  closeDriverDb,
};
