// Loads the non-DOM game modules into a Node VM context for headless testing.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
module.exports = function load(files) {
  const ctx = { console, Math, JSON, Date, setTimeout, clearTimeout };
  ctx.window = ctx;
  vm.createContext(ctx);
  const root = path.join(__dirname, '..', 'js');
  for (const f of files) {
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    vm.runInContext(src, ctx, { filename: f });
  }
  return ctx.PG;
};
