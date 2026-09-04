# Third-Party Notices

OpenBot's Windows Worker Host and Desktop build reference the following components. Exact resolved
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
