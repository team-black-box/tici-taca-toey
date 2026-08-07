# Deep-link association files

These tell iOS and Android that this domain and the mobile app are the
same product, so a shared game link opens the app instead of the browser.
They are served from `https://ticitacatoey.com/.well-known/`.

They are **not** decoration: sharing a link *is* the invite loop. Before
these existed, both paths returned the SPA's fallback HTML and the
Android manifest had been declaring `autoVerify` against a file that was
not there, so verification failed silently.

## What may be claimed

Only `/play/*` and `/spectate/*`. That is exactly what the app's
`LINK_PATTERN` in `mobile/src/state.ts` can route - claiming a path the
app cannot handle sends people to an app that shrugs at them.

In particular **do not claim `/privacy.html` or `/terms.html`**. The
mobile footer opens those with `Linking.openURL`, and if the app owned
those paths the link would bounce straight back into the app instead of
showing the page - which is also the one thing the app stores check by
hand.

`/replay/*`, `/player/*`, and `/leaderboard` are deliberately left to the
browser for now: the app has screens for them but no URL routing into
them, and the web versions have richer link previews.

## apple-app-site-association

Complete. The `appIDs` entry is `<Team ID>.<bundle id>`. It has no file
extension on purpose - that is what Apple fetches - so `server/src/static.ts`
serves this directory as `application/json` explicitly, since the
extension is what would otherwise imply the type.

## assetlinks.json - still missing, and why

Android's file must carry the SHA-256 fingerprint of the **release**
signing certificate, and no release keystore exists yet (release builds
are still signed with the debug key - see `tasks/mobile-store-launch.md`).

A file with a placeholder fingerprint is worse than no file: it looks
done and fails exactly the same way. So once the keystore exists:

```bash
keytool -list -v -keystore <release.keystore> -alias <alias> \
  | grep "SHA256:"
```

and add, in this directory, as `assetlinks.json`:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.ticitacatoey",
      "sha256_cert_fingerprints": ["<the SHA-256, colon-separated>"]
    }
  }
]
```

If Play App Signing is enabled (it is, by default, for new apps), the
fingerprint that matters is the **app signing key** shown in Play Console
under Setup > App integrity - not the upload key. Getting these two
confused is the usual reason App Links silently do not verify.
