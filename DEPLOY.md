### Updating

```bash
git pull
pnpm install --frozen-lockfile
pnpm build
pm2 restart paddle-roster
```

> **Note:** Always reinstall with `pnpm` (not `npm`) before building. This project uses `pnpm-lock.yaml` and
> patched dependencies (see `patches/`); running `npm install`/`npm run build` ignores the lockfile and patches,
> which can leave stale or mismatched packages (e.g. duplicate `@unhead/vue` versions) in `node_modules` and
> cause build errors like `MISSING_EXPORT "legacyPlugins" is not exported by "@unhead/vue/dist/legacy.mjs"`.
> If you hit that error, remove `node_modules` on the server and reinstall from scratch with
> `pnpm install --frozen-lockfile`.
