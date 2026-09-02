# bygram

bygram is a serverless, local-first PWA fork of Telegram Web A for iPhone. It keeps Telegram Web A's MTProto client, authorization, chats, calls, and media features, and adds an independent IndexedDB message archive, anti-delete, edit history, and optional bounded media archiving.

All user data stays in the browser. Anti-delete can only preserve messages received while the client was running; iOS may suspend installed PWAs in the background.

## Build

```sh
npm install
npm run build
```

Deploy the generated `dist/` directory as a static HTTPS site. The production build includes the PWA manifests, iPhone home-screen icons, and Service Worker. Optional API credentials and deployment URL overrides can be set through `.env` using `.env.example`.

## bygramMusic

Search and playback use bygramMusic from the browser with no accounts, API keys,
or hosted workers. If bygramMusic is temporarily unreachable, bygram falls back to
the optional local `bygram-music` catalog bundled with the static build.

## Upstream

This project won the first prize 🥇 at [Telegram Lightweight Client Contest](https://contest.com/javascript-web-3) and now is an official Telegram client available to anyone at [web.telegram.org/a](https://web.telegram.org/a).

According to the original contest rules, it has nearly zero dependencies and is fully based on its own [Teact](https://github.com/Ajaxy/teact) framework (which re-implements React paradigm). It also uses a custom version of [GramJS](https://github.com/gram-js/gramjs) as an MTProto implementation.

The project incorporates lots of technologically advanced features, modern Web APIs and techniques: WebSockets, Web Workers and WebAssembly, multi-level caching and PWA, voice recording and media streaming, cryptography and raw binary data operations, optimistic and progressive interfaces, complicated CSS/Canvas/SVG animations, reactive data streams, and so much more.

Feel free to explore, provide feedback and contribute.

## Local setup

```sh
mv .env.example .env

npm i
```

You may obtain a dedicated API ID and API hash on [my.telegram.org](https://my.telegram.org) and populate the `.env` file.

## Dev mode

```sh
npm run dev
```

### Invoking API from console

Start your dev server and locate GramJS worker in the console context.

All constructors and functions available in global `GramJs` variable.

Run `npm run gramjs:tl full` to get access to all available Telegram methods.

Example usage:
``` javascript
await invoke(new GramJs.help.GetAppConfig())
```

### Dependencies
* [GramJS](https://github.com/gram-js/gramjs) ([MIT License](https://github.com/gram-js/gramjs/blob/master/LICENSE))
* [fflate](https://github.com/101arrowz/fflate) ([MIT License](https://github.com/101arrowz/fflate/blob/master/LICENSE))
* [cryptography](https://github.com/spalt08/cryptography) ([Apache License 2.0](https://github.com/spalt08/cryptography/blob/master/LICENSE))
* [emoji-data](https://github.com/iamcal/emoji-data) ([MIT License](https://github.com/iamcal/emoji-data/blob/master/LICENSE))
* [twemoji-parser](https://github.com/jdecked/twemoji-parser) ([MIT License](https://github.com/jdecked/twemoji-parser/blob/master/LICENSE.md))
* [tlottie](https://github.com/dkaraush/tlottie) ([MIT License](https://github.com/dkaraush/tlottie/))
* [opus-recorder](https://github.com/chris-rudmin/opus-recorder) ([Various Licenses](https://github.com/chris-rudmin/opus-recorder/blob/master/LICENSE.md))
* [qr-code-styling](https://github.com/kozakdenys/qr-code-styling) ([MIT License](https://github.com/kozakdenys/qr-code-styling/blob/master/LICENSE))
* [music-metadata](https://github.com/Borewit/music-metadata) ([MIT License](https://github.com/Borewit/music-metadata/blob/master/LICENSE.txt))
* [Tiptap](https://github.com/ueberdosis/tiptap) ([MIT License](https://github.com/ueberdosis/tiptap/blob/main/LICENSE.md))
* [marked](https://github.com/markedjs/marked) ([MIT License](https://github.com/markedjs/marked/blob/master/LICENSE.md))
* [lowlight](https://github.com/wooorm/lowlight) ([MIT License](https://github.com/wooorm/lowlight/blob/main/license))
* [idb-keyval](https://github.com/jakearchibald/idb-keyval) ([Apache License 2.0](https://github.com/jakearchibald/idb-keyval/blob/main/LICENCE))
* [fasttextweb](https://github.com/karmdesai/fastTextWeb)
* fastblur

## Bug reports and Suggestions
If you find an issue with this app, let Telegram know using the [Suggestions Platform](https://bugs.telegram.org/c/4002).
