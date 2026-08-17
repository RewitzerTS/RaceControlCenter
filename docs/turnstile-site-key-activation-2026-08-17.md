# RaceVora Turnstile Site Key · 17.08.2026

Der öffentliche Cloudflare-Turnstile-Site-Key für `racevora.com` ist im Frontend konfiguriert.

- Site Key: `0x4AAAAAAETIVWWbQKe_2CaL`
- Der Secret Key gehört ausschließlich in Supabase Authentication → Bot and Abuse Protection.
- CAPTCHA darf in Supabase erst aktiviert werden, wenn der Secret Key dort gespeichert ist.
- Danach müssen Signup, Passwort-Login, Passwort-Reset und Signup-Resend produktiv getestet werden.

Der Site Key ist absichtlich öffentlich; der Secret Key darf niemals in dieses Repository gelangen.
