FUN RUSSIA — DNS diagnostics patch for iPhone Black Russia test

Purpose
- Log DNS hostnames queried through this DoH server so the real game connection flow can be investigated.
- Does NOT add any new redirects. By default HIJACK remains empty and normal DNS is forwarded to Cloudflare.
- Explicitly refuses to hijack blackrussia.online and br1.fun, including if they appear in HIJACK.

Install
1. Back up the currently deployed server.js.
2. Replace funrussia-doh/server.js with the server.js from this archive.
3. In Layero, make sure HIJACK is empty/unset. Set DNS_DIAGNOSTICS=1 (default is enabled).
4. Redeploy and open /health. Expected: {"ok":true,...,"hijack":[],"dnsDiagnostics":true}.
5. On Egor's iPhone, install/enable the FUN RUSSIA profile. Fully close Black Russia, launch it, and reproduce the exact point where it says there is no internet / fails to connect. Wait 30–60 seconds.
6. Open Layero deployment logs. Look for lines like: [DNS] api.example.com type=A action=UPSTREAM.
7. Copy the DNS lines from the test window and share them for analysis. Do not share cookies, passwords, tokens, or account details.

Important
- This is a diagnostic patch, not a finished server redirect fix.
- Do not redirect blackrussia.online, br1.fun, or all subdomains: those can be official API/auth/CDN services and may break the client.
- DNS cannot specify TCP/UDP port 7785. Even after finding a hostname, it must be confirmed that the game client uses that hostname for the game socket and expects the custom server there.
- If no DNS lines appear during launch, the app may be using cached DNS, a literal IP, or another resolver/path. Repeat after toggling the profile off/on and fully closing the app; do not guess domains.
- You can disable logs by setting DNS_DIAGNOSTICS=0.
