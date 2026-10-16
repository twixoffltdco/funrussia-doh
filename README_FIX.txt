FUN RUSSIA iOS DNS safety patch

This patch stops the current broad DNS redirect from interfering with the
official Black Russia app's connectivity/authentication domains. By default,
it forwards normal DNS queries upstream and does not hijack any hostname.
It also changes any configured redirect to exact-host matching only and
blocks blackrussia.online and br1.fun from being hijacked.

Apply:
1. Back up server.js in twixoffltdco/funrussia-doh.
2. Replace it with server.js from this ZIP.
3. In Layero environment variables, clear HIJACK if it is set.
4. Redeploy.
5. Check https://funrussia-doh.layero.dev/health (expected hijack: []).
6. Check:
   https://funrussia-doh.layero.dev/dns-query?name=blackrussia.online
   https://funrussia-doh.layero.dev/dns-query?name=br1.fun
   Both should return hijacked:false.
7. On Egor's iPhone, remove and reinstall the FUN RUSSIA configuration profile,
   then test the official app again.

Important: this is a safe DNS/network fix, not proof that the official client
supports a custom server. DNS cannot specify port 7785. To connect the client
to 185.207.214.14:7785, we still need the exact hostname or server-selection
mechanism used by that client. Do not add a hostname to HIJACK until verified.
