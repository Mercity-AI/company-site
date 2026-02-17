# Astro Issue Draft: `allowedHosts: true` not applied correctly

## Suggested Title

`vite.server.allowedHosts: true` in `astro.config.mjs` is resolved as `[true]`, causing host validation failures (ngrok / custom host headers)

## Suggested Issue Body

### Astro version

`5.17.1`

### What package manager are you using?

`pnpm`

### What operating system are you using?

`macOS (arm64), Node v22.16.0`

### Describe the Bug

When I set this in `astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  vite: {
    server: {
      host: '0.0.0.0',
      allowedHosts: true,
    },
  },
});
```

non-localhost Host headers are still blocked by Vite host validation, for example with ngrok:

> Blocked request. This host ("...ngrok-free.app") is not allowed.

I can reproduce this consistently with direct Host header requests.

### Reproduction

1. Create a fresh Astro project.
2. Set in `astro.config.mjs`:
   - `vite.server.host = '0.0.0.0'`
   - `vite.server.allowedHosts = true`
3. Start dev server:

   ```bash
   pnpm astro dev --host
   ```

4. Send a request with a non-localhost Host header:

   ```bash
   curl -i -H "Host: example.ngrok-free.app" http://localhost:4321/
   ```

5. Observe response:
   - `HTTP/1.1 403 Forbidden`
   - `Blocked request. This host (...) is not allowed.`

### Expected behavior

With `allowedHosts: true`, any host should be accepted (as documented), so the same request should return normal app HTML (`200`).

### Actual behavior

Request is still blocked with `403` as if host allow-all is not enabled.

### Additional context / debugging

- Running with debug logging:

  ```bash
  DEBUG=vite:config pnpm astro dev --host
  ```

  shows resolved `server.allowedHosts` becoming `[true]` in the config path used by Astro dev, instead of boolean `true`.

- Explicit host arrays work as a workaround, e.g.:

  ```js
  allowedHosts: ['.ngrok-free.app', 'localhost', '127.0.0.1']
  ```

### What I tried, and what worked

- Tried `allowedHosts: true` directly in `astro.config.mjs`:
  - still blocked with `403` for ngrok host header requests.

- Tried explicit host list:
  - worked immediately, including ngrok requests.

- For debugging, I also tested a small Vite plugin workaround that normalizes `[true]` back to `true` in `configResolved`:
  - with this normalization, ngrok requests were accepted and returned `200`.
  - this further suggests the issue is the `true -> [true]` shape during Astro config resolution.

- Verified with both:
  - direct host-header request:
    ```bash
    curl -i -H "Host: <ngrok-subdomain>.ngrok-free.app" http://localhost:4321/
    ```
  - and loading through the ngrok public URL in browser.

### Why this seems unexpected

Vite docs specify `server.allowedHosts` type is `string[] | true`, and `true` should allow any host:
- https://vite.dev/config/server-options.html#server-allowedhosts

Astro CLI also documents `--allowed-hosts` and references Vite behavior:
- https://docs.astro.build/en/reference/cli-reference/#--allowed-hosts

---

## Notes for Maintainers

- If this belongs in Vite instead, please advise and I can cross-file with a minimal Astro reproduction link.
- Happy to provide a tiny public repro repo if needed.

