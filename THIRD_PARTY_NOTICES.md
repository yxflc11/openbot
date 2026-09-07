# Third-Party Notices

OpenBot's Server, Worker Hosts and Desktop build reference the following components. Exact resolved
versions are recorded in checked-in lockfiles; release artifacts must also carry generated SBOMs
and notices.

- Microsoft .NET runtime and `Microsoft.Extensions.*` / `System.*` libraries — Copyright .NET
  Foundation and contributors; MIT License.
- `Meziantou.Framework.Win32.Jobs` 4.0.0 — Copyright Gérald Barré; MIT License.
- Electron 44.2.0 — Copyright Electron contributors and GitHub Inc.; MIT License. Electron
  development packages retain the upstream `LICENSE`, and packaged artifacts retain Electron's
  generated `LICENSE` and `LICENSES.chromium.html` files.
- `@electron/fuses` 2.1.3 — Copyright 2020 Electron Maintainers; MIT License. This build tool is not
  included in the Desktop application ASAR.
- `@electron/packager` 20.3.0 — Copyright 2015 Max Ogden and other contributors; BSD 2-Clause
  License. This build tool is not included in the Desktop application ASAR.
- `@electron/asar` 4.3.0 — Copyright 2014 GitHub Inc.; MIT License. This build tool validates the
  final Desktop archive inventory and is not included in the application ASAR.
- `write-file-atomic` 8.0.0 — Copyright 2015 Rebecca Turner; ISC License. This is included in the
  Desktop application ASAR for atomic public-origin configuration writes.
- `signal-exit` 4.1.0 — Copyright 2015–2023 Benjamin Coe, Isaac Z. Schlueter, and Contributors; ISC
  License. This is the sole runtime dependency of `write-file-atomic` in the Desktop application
  ASAR.

- Vercel AI SDK `ai` 7.0.93, `@ai-sdk/openai` 4.0.60, `@ai-sdk/anthropic` 4.0.49,
  `@ai-sdk/provider` 4.0.10, `@ai-sdk/provider-utils` 5.0.36 and the SDK's transitive
  `@ai-sdk/gateway` 4.0.75 — Copyright 2023 Vercel, Inc.; Apache License 2.0.
  The Server uses explicit OpenAI/Anthropic adapters, not the gateway. Package LICENSE files
  remain in the packaged production dependency tree. No upstream implementation was copied.
  See [Agent research](docs/research/native-agent-loop.md) and the
  [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).

No upstream source is copied into OpenBot. The following MIT license text is reproduced for the
MIT-licensed dependencies listed above:

> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
> associated documentation files (the "Software"), to deal in the Software without restriction,
> including without limitation the rights to use, copy, modify, merge, publish, distribute,
> sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or
> substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
> NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
> NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
> DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT
> OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

The following BSD 2-Clause license text is reproduced for `@electron/packager`:

> Copyright (c) 2015 Max Ogden and other contributors
> All rights reserved.
>
> Redistribution and use in source and binary forms, with or without modification, are permitted
> provided that the following conditions are met:
>
> - Redistributions of source code must retain the above copyright notice, this list of
>   conditions and the following disclaimer.
> - Redistributions in binary form must reproduce the above copyright notice, this list of
>   conditions and the following disclaimer in the documentation and/or other materials provided
>   with the distribution.
>
> THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR
> IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
> FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR
> CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
> DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
> DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER
> IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT
> OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

The following ISC license text is reproduced for `write-file-atomic`:

> Copyright (c) 2015, Rebecca Turner
>
> Permission to use, copy, modify, and/or distribute this software for any purpose with or without
> fee is hereby granted, provided that the above copyright notice and this permission notice appear
> in all copies.
>
> THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS
> SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE
> AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
> WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT,
> NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE
> OF THIS SOFTWARE.

The following ISC license text is reproduced for `signal-exit`:

> Copyright (c) 2015-2023 Benjamin Coe, Isaac Z. Schlueter, and Contributors
>
> Permission to use, copy, modify, and/or distribute this software for any purpose with or without
> fee is hereby granted, provided that the above copyright notice and this permission notice appear
> in all copies.
>
> THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS
> SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE
> AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
> WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT,
> NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE
> OF THIS SOFTWARE.

## Native Desktop Server preview

- PostgreSQL 17.10 — PostgreSQL Global Development Group and the Regents of the University
  of California; PostgreSQL License. Native packaging uses
  `@embedded-postgres/darwin-arm64` / `darwin-x64` `17.10.0-beta.17`, MIT packager,
  commit `c23ad8a026c711c8666c3c2596d0fde643cf378a`. The wrapper code is not used.
- Postgres.js 3.4.9 — Rasmus Porsager; Unlicense. Its package notice is retained alongside code.
- The PostgreSQL binary bundle includes OpenSSL, ICU, LZ4, Zstandard, zlib, libxml2, Kerberos,
  libedit, libiconv, gettext and libuuid. These are not relicensed under OpenBot's MIT license.
  Upstream notices and their source/hash inventory are retained in
  `apps/desktop/resources/native-notices` and copied into the native runtime. The packager's MIT
  notice is also retained. No upstream executable implementation is copied into OpenBot source.
- This is an internal unsigned development bundle. Exact per-library binary/source correspondence
  and LGPL distribution obligations remain public-release gates, documented in that inventory.
  Do not represent the preview as an attested or distribution-cleared release.
