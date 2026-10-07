const bcrypt = require("bcryptjs");

const password = process.argv[2];

if (!password) {
  console.error('Usage: npm run hash-password -- "your-password"');
  process.exit(1);
}

process.stdout.write(`${bcrypt.hashSync(password, 12)}\n`);
