const { connectDb, closeDb } = require("../src/db");
const { hashPassword } = require("../src/utils/password");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key.startsWith("--")) continue;
    args[key.slice(2)] = value;
    i += 1;
  }
  return args;
}

async function main() {
  const { user, password } = parseArgs(process.argv.slice(2));
  if (!user || !password) {
    console.error("Usage: node scripts/set-user-password.js --user <user_id_or_email> --password <new_password>");
    process.exit(1);
  }

  const db = await connectDb();
  const result = await db.collection("Users").updateOne(
    {
      $or: [
        { user_id: user },
        { email: user },
        { email: user.toLowerCase() },
      ],
    },
    {
      $set: {
        password_hash: hashPassword(password),
        updated_at: new Date(),
      },
      $unset: {
        password: "",
      },
    }
  );

  if (result.matchedCount === 0) {
    console.error("Kullanici bulunamadi.");
    process.exit(1);
  }

  console.log("Sifre guncellendi.");
}

main()
  .catch((error) => {
    console.error("Sifre guncelleme hatasi:", error.message);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb();
  });
