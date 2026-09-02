# Changelog

# [1.0.0](https://github.com/gdluxx/gdluxx/compare/v0.15.0...v1.0.0) (2026-09-02)


### Bug Fixes

* **auth:** derive cookie Secure flag from ORIGIN scheme ([f565036](https://github.com/gdluxx/gdluxx/commit/f565036e44e005ca05b5a3f75957e28d6739aa7b)), closes [#8](https://github.com/gdluxx/gdluxx/issues/8)
* **auth:** derive secure cookies explicitly and cap session lifetime ([7f76b8b](https://github.com/gdluxx/gdluxx/commit/7f76b8b73e46257bb42dd68ea61cb69bf0898cc8))
* **auth:** fail closed on user existence, migration, and secret ([20bce8b](https://github.com/gdluxx/gdluxx/commit/20bce8bc9d70f4f06f490156374223b2b71934ca))
* **auth:** make session listing robust to timestamp representation ([d57511d](https://github.com/gdluxx/gdluxx/commit/d57511df50489ca2a59b1106acf48546e975ba58))
* **config:** surface rejected config saves in the editor ([459921f](https://github.com/gdluxx/gdluxx/commit/459921f2d925adff48be24df5f1881f947d33ca3))
* **csrf:** remove the DISABLE_CSRF_CHECK wildcard escape hatch ([a25016c](https://github.com/gdluxx/gdluxx/commit/a25016cddb81abb422429622062b84564ef2c206))
* **db:** flip boolean option values stored false by the toggle bug ([41ec8e7](https://github.com/gdluxx/gdluxx/commit/41ec8e79c11cd7f809f50892b8c1c290c6c0ff2b))
* **docker:** align dev compose ORIGIN default with its published port ([e18b1d6](https://github.com/gdluxx/gdluxx/commit/e18b1d68b48edf1c720dec84c84c45580c261d03))
* **docker:** pass TRUSTED_PROXY_HEADER through to the container ([60f6f49](https://github.com/gdluxx/gdluxx/commit/60f6f498435196d69e6366756f00bfe089bf948e))
* **lint:** clear application errors blocking release verification ([7dec4e3](https://github.com/gdluxx/gdluxx/commit/7dec4e3244dd2b417c5bdf2c4b73b7bf0f74c6d1))
* **options:** store true for toggled-on booleans so their flags emit ([0cae4d0](https://github.com/gdluxx/gdluxx/commit/0cae4d08c9907b8653eef462b02da696820218cc))
* **release:** scope root and extension versioning by path with soft no-op guards ([84bc843](https://github.com/gdluxx/gdluxx/commit/84bc8435ee4f26fd7768a19f1e4cdeb18634dc88))
* **security:** contain gallery-dl config and argv execution paths ([e543d21](https://github.com/gdluxx/gdluxx/commit/e543d217ba14426859d2e3b11656ecda957ae9a4))
* **server:** allowlist extension CORS origins and PNA grants ([ea54c40](https://github.com/gdluxx/gdluxx/commit/ea54c40e9be9cc97be5587576d598c67cb5107a8))
* **server:** finalize the job record when the pty spawn fails ([d391538](https://github.com/gdluxx/gdluxx/commit/d391538d59ee3353125e2a0c20fe2f7f7fdd5c7f))
* **ui:** hide closed native dialogs from page flow ([9492e38](https://github.com/gdluxx/gdluxx/commit/9492e381c5bc2009fb7c1c628d4be3bb5b55ff26))
* **validation:** reject catalog-invalid option values at write time ([af885dc](https://github.com/gdluxx/gdluxx/commit/af885dc81985a769febcd7d144507433dd063177))


### Features

* **auth:** add api key ownership, permissions, and default expiry ([6592c9b](https://github.com/gdluxx/gdluxx/commit/6592c9bf6e687672b2ff7b2bcf7fc217c1476921))
* **auth:** enforce single admin and per-route authorization ([799ec64](https://github.com/gdluxx/gdluxx/commit/799ec6498e9a02f61b9b75aa8b72f036736cba1d))
* **auth:** stop storing the api key prefix fragment at rest ([0f1dca2](https://github.com/gdluxx/gdluxx/commit/0f1dca25451b7bee6d9a9fde7d512c06de2a26bf))
* **gallery-dl:** add 'unrestricted' mode ([44664dd](https://github.com/gdluxx/gdluxx/commit/44664dde8b4de94b997781479d84aa4a4e33f149))
* **gallery-dl:** add/modify tests with 'unrestricted' mode ([c56ee13](https://github.com/gdluxx/gdluxx/commit/c56ee133b0fe5c5e69fe697a90d3594d35f15c53))
* **gallery-dl:** update docker files for 'unrestricted' mode ([343167b](https://github.com/gdluxx/gdluxx/commit/343167b0b3418954f25f429b664b2f4ffccda56b))
* **jobs:** attribute jobs to their originating schedule ([fd8aa90](https://github.com/gdluxx/gdluxx/commit/fd8aa905d2649df541c9929c99d2823e44ff0c0d))
* **options:** warn on range syntax gallery-dl would silently drop ([d7e3772](https://github.com/gdluxx/gdluxx/commit/d7e3772b4a966e173c228c72ff37cc830d211fa5))
* **schedules:** add schedules page and editor seeded from the command form ([16e5c06](https://github.com/gdluxx/gdluxx/commit/16e5c066124cf2fc8dd40bdc83f3ace61b4ae29d))
* **schedules:** replace table layout with responsive cards ([9e32a62](https://github.com/gdluxx/gdluxx/commit/9e32a62eeab0bd6add742a69e708cf5138ec814f))
* **schedules:** surface run outcome notifications in the ui ([c9769b6](https://github.com/gdluxx/gdluxx/commit/c9769b6246af083332ca38341609581553c80391))
* **server:** add schedule and notification api routes ([61b8c54](https://github.com/gdluxx/gdluxx/commit/61b8c54193fcf6539541665ed1d2e830d0090e2f))
* **server:** add schedule engine for recurring job dispatch ([763fb44](https://github.com/gdluxx/gdluxx/commit/763fb4415173efe3980571644411633a6f0b4a02))
* **theme:** improve theme colors and component states ([d074ed2](https://github.com/gdluxx/gdluxx/commit/d074ed28b9e40a7b2f9140321dd6a685b5bb597c))
* **theme:** overhaul the semantic theme system ([08c7007](https://github.com/gdluxx/gdluxx/commit/08c70077f263b6bd2f43b0c38dfc544563278fc6))
* **ui:** add overflow menu primitive with kebab icon ([a40ba0e](https://github.com/gdluxx/gdluxx/commit/a40ba0e3eaf86aa5bfcf36f621b17d703b912177))
* **utils:** add future-aware time formatting helpers ([0f66ffe](https://github.com/gdluxx/gdluxx/commit/0f66ffefb835fe53815a86a5d912f73991e9d898))


### BREAKING CHANGES

* **auth:** signup closes after the first user; unauthenticated API requests return 401 JSON instead of a redirect.
* **auth:** AUTH_SECRET is now mandatory in production

# [0.15.0](https://github.com/gdluxx/gdluxx/compare/v0.14.0...v0.15.0) (2026-08-18)


### Bug Fixes

* **catalog:** improve text contrast and row layout ([29baa28](https://github.com/gdluxx/gdluxx/commit/29baa2815841f8922377b6e02ba976d57a1a52a0))
* **nav:** navigate on parent click and size submenus to content ([afec513](https://github.com/gdluxx/gdluxx/commit/afec513528402fab0c893a5c467bdad25c1e963a))
* remove comment fragment ([6d8117d](https://github.com/gdluxx/gdluxx/commit/6d8117d03663f0391089f91aa7d77f0c16edba1a))


### Features

* **catalog:** add gallery-dl options catalog generation pipeline ([c5ab8ab](https://github.com/gdluxx/gdluxx/commit/c5ab8aba14863e6f1cd56402501476d1e822f094))
* **catalog:** add generated options artifact and schema ([3fc41bf](https://github.com/gdluxx/gdluxx/commit/3fc41bfed77ff1e9fb6acf3855266c749ef2b489))
* **catalog:** add searchable options catalog page /config/catalog ([f694662](https://github.com/gdluxx/gdluxx/commit/f694662f10b87d6d514cbcf04605cff9d0771503))
* **config:** add one click catalog merge + config history ([e9ca8fc](https://github.com/gdluxx/gdluxx/commit/e9ca8fc5963f33678facd21b7ee5dbd539fe94c3))

# [0.14.0](https://github.com/gdluxx/gdluxx/compare/v0.13.0...v0.14.0) (2026-08-16)


### Bug Fixes

* **server:** apply site-config CLI options to direct media submissions ([fa79ddd](https://github.com/gdluxx/gdluxx/commit/fa79ddd7a89b1389235cde395ed95162ee8234cc))
* **server:** carry site-config CLI options onto the fallback batch ([8c46e50](https://github.com/gdluxx/gdluxx/commit/8c46e50e71e281ed0304520f139ff19da536450c))
* **server:** keep folder settings off the primary gallery run ([fa8e585](https://github.com/gdluxx/gdluxx/commit/fa8e5856bc34cf95099ef8517aaec25718c02eba))
* **server:** resolve fallback batch cookies from the originating page ([ab9f417](https://github.com/gdluxx/gdluxx/commit/ab9f4178d281748c85ea6cb1cd307233a1fe1636))


### Features

* **server:** log why an unsupported exit armed no fallback batch ([4044387](https://github.com/gdluxx/gdluxx/commit/40443874ebf29431e30498fd007e9815c09d82b2))

# [0.13.0](https://github.com/gdluxx/gdluxx/compare/v0.12.0...v0.13.0) (2026-08-15)


### Features

* **server:** start a directlink batch for gallery-dl unsupported URLs ([7a8cc36](https://github.com/gdluxx/gdluxx/commit/7a8cc36573478d0acb9bbd8e021b5f71bf8f684e))

# [0.12.0](https://github.com/gdluxx/gdluxx/compare/v0.11.0...v0.12.0) (2026-08-12)


### Bug Fixes

* **server:** accept every shape the extension exports ([053881d](https://github.com/gdluxx/gdluxx/commit/053881d31356308cdf17fd26011843c374543f2a))
* **ui:** polish settings buttons, save hints, and select chevron ([ee019da](https://github.com/gdluxx/gdluxx/commit/ee019da7526b60c26f37ca7df018797c551aa589))


### Features

* **api:** add bearer cookie sync endpoint and api key cleanup ([3c02fd7](https://github.com/gdluxx/gdluxx/commit/3c02fd7713922dd9d98a88c3b449ff131c70a1b1))
* **api:** add bearer jobs status endpoint for extension polling ([ca1e006](https://github.com/gdluxx/gdluxx/commit/ca1e006a84ad325a19d73dc9668ffb45a4091af8))
* **dev:** add component library showcase ([6abb43e](https://github.com/gdluxx/gdluxx/commit/6abb43e78a80d02f8c4151ec32cadd1471031794))
* **logging:** add log tail viewer and clarify rotation fields ([0ba5248](https://github.com/gdluxx/gdluxx/commit/0ba524898a5a5782023a590d1bf3990e2963d82b))
* **server:** add cookie storage, netscape materialization, and job injection ([5f8580e](https://github.com/gdluxx/gdluxx/commit/5f8580eb1874241ed5c335e56f25381a9aae312c))
* **server:** advertise app version and capabilities in extension ping ([896ca01](https://github.com/gdluxx/gdluxx/commit/896ca013ae0c51c0416f76e9a021cab45c3378b4))
* **server:** preserve unknown fields in extension backup validation ([577b5cf](https://github.com/gdluxx/gdluxx/commit/577b5cf27fdcbee2189c09050e180cd3a7a8e0e0))
* **settings:** accept accumulate flag in extension profile schemas ([a1649b4](https://github.com/gdluxx/gdluxx/commit/a1649b48f8c275cffa50e76495c5aff94ba41afd))
* **settings:** accept extension directory source in profile schemas ([01aea4a](https://github.com/gdluxx/gdluxx/commit/01aea4a3fa85be7779167d20a222d2e3871f0b99))
* **ui:** add cookie management settings page ([b7e6d9c](https://github.com/gdluxx/gdluxx/commit/b7e6d9cf14931fbc19d8725603d20a761d3c4f6a))
* **ui:** add Field form component ([186501b](https://github.com/gdluxx/gdluxx/commit/186501b0292e8b997ac0a90ee5a44fbc43541d2c))
* **ui:** add gdluxx version to sidebar ([efce198](https://github.com/gdluxx/gdluxx/commit/efce198e41b1597718b1a1463b35f5fbc7c1117b))
* **ui:** improve modal behavior and consistency ([875731a](https://github.com/gdluxx/gdluxx/commit/875731a8a2f42133bf7c7fe2dd7224622d57e3a3))
* **ui:** replace user manager with account management page ([bf797c6](https://github.com/gdluxx/gdluxx/commit/bf797c6b316b7e77b21504bb3fe5be699ebcdc2b))
* **ui:** rework api key manager with last-used and default expiry ([8b59ebc](https://github.com/gdluxx/gdluxx/commit/8b59ebc0cfe2b652a9ef71451402382105b77855))
* **ui:** unify modal chrome, footer buttons, and toggle states ([aac08f8](https://github.com/gdluxx/gdluxx/commit/aac08f871142c7f6c9c75dba84ebaf0adfaeb566))

# [0.11.0](https://github.com/gdluxx/gdluxx/compare/v0.10.0...v0.11.0) (2026-07-16)


### Bug Fixes

* after updating deps, vite was tree-shaking away theme CSS imports ([cb87e0d](https://github.com/gdluxx/gdluxx/commit/cb87e0d3490e2cf84df625b3e8001201b8c83aa6))
* API key table migration for Better Auth schema changes ([8e88b1c](https://github.com/gdluxx/gdluxx/commit/8e88b1c8a927c844933642cc52af9b044ba2e936))
* **ci:** pin Node via .nvmrc in release workflows and fix dead assignment in gallerizedUtils ([244c2c9](https://github.com/gdluxx/gdluxx/commit/244c2c9bce1bd341bb8ed5dc23b38c6ba96cc310))
* **deps:** dedupe [@lezer](https://github.com/lezer) packages to restore config editor syntax highlighting ([7b0fcc8](https://github.com/gdluxx/gdluxx/commit/7b0fcc867ba14659b366146b858299500bc370f9))
* Fix modal Escape handling and tooltip focus behavior ([30e7e0d](https://github.com/gdluxx/gdluxx/commit/30e7e0d2b5290213d6e62a269ee8605b8757b0c9))
* theme selector selected-state reactivity ([9c0b6f5](https://github.com/gdluxx/gdluxx/commit/9c0b6f540ad09001879c6e5cfec8a1183c45a92a))
* **ui:** replace old phantom theme classes breaking CopyTooltip visibility ([ab7b42d](https://github.com/gdluxx/gdluxx/commit/ab7b42ddb896181756f6c5a9714511793ab5be8e))


### Features

* add "gallerized" feature ([9431a60](https://github.com/gdluxx/gdluxx/commit/9431a609eb59647402fdc2d64cf581ecf0f1d70d))
* add import/export to extension profile mgr ([7e3e787](https://github.com/gdluxx/gdluxx/commit/7e3e787a5d1d01965c5b8ec5994c8bcd7ec0ce95))
* **config:** add DOWNLOAD_PATH env var for custom download location ([d78cfda](https://github.com/gdluxx/gdluxx/commit/d78cfdaba42b4e5550cf3ac0371939189430f15d)), closes [#4](https://github.com/gdluxx/gdluxx/issues/4)
* consolidating extension features + "gallerized" ([eeefc2e](https://github.com/gdluxx/gdluxx/commit/eeefc2ed48f7be23a354d59eb80c90c73145ca27))
* **extension-profiles:** add backup editing and restore preview ([0163bc3](https://github.com/gdluxx/gdluxx/commit/0163bc3d4b89fedd38a32d78ab08b9e1d8bbca40))
* **options:** make the options panel easier to use ([d06851e](https://github.com/gdluxx/gdluxx/commit/d06851eb4d08e7e1248b7a16efe8b8926848751f))
* **run:** restore options manager and surface job activity on the Run page ([4fc4d23](https://github.com/gdluxx/gdluxx/commit/4fc4d23cccea1954b06a790f828e02161df3791e))
* server side groundwork for feature consolidation ([4f0b059](https://github.com/gdluxx/gdluxx/commit/4f0b0597c36a4757f2457e055ab5407f9596bc4b))
* **ui:** compact left aligned page headers and other minor UI changes ([a9885ea](https://github.com/gdluxx/gdluxx/commit/a9885ea8bc8e0e5b7a86d7eece6c0f133f4de338))
* **ui:** structured keyword output, site rules polish, jobs toolbar tooltips ([3fcede3](https://github.com/gdluxx/gdluxx/commit/3fcede3f9d657c2a8ca8753fd2571d3c565a7ea8))
* wire in "gallerized" ui ([6e663b8](https://github.com/gdluxx/gdluxx/commit/6e663b825fca2cbe6b6daa468e46dc253dd2db6c))


### Performance Improvements

* **jobs:** paginate jobs list and stop holding all job output in memory ([b353099](https://github.com/gdluxx/gdluxx/commit/b353099ffb6f0a9081ae49e271acd110b2bbee13))

# [0.10.0](https://github.com/gdluxx/gdluxx/compare/v0.9.1...v0.10.0) (2026-05-28)


### Bug Fixes

* **docker:** pin pnpm to 10.33.0 to maintain Node 20 compatibility ([c81090e](https://github.com/gdluxx/gdluxx/commit/c81090e40ba2d1a2edc5d6949b72cb005f3dd43f))
* **docker:** pin pnpm/action-setup@v4 to 10.33.0 ([11555cd](https://github.com/gdluxx/gdluxx/commit/11555cd32f01c1c4f7aaa09e6319da1c8ace02f4))
* parenthesis in Site Rules user-agent fails validation ([6e5a2ac](https://github.com/gdluxx/gdluxx/commit/6e5a2ac5a618d2405cd0a4f90ab79967fe997adb)), closes [#6](https://github.com/gdluxx/gdluxx/issues/6)


### Features

* **version:** add Codeberg support ([b8fa07e](https://github.com/gdluxx/gdluxx/commit/b8fa07eae19e6dd537efa6e586418916d8eb89c1)), closes [#5](https://github.com/gdluxx/gdluxx/issues/5)

## [0.9.1](https://github.com/gdluxx/gdluxx/compare/v0.9.0...v0.9.1) (2026-04-05)

# [0.9.0](https://github.com/gdluxx/gdluxx/compare/v0.8.0...v0.9.0) (2026-03-31)


### Bug Fixes

* **release:** another attempt at correcting changelog contamination between root and extension ([18531eb](https://github.com/gdluxx/gdluxx/commit/18531eb45b436103c3540bb0a4da8425543629f0))


### Features

* add binary check and warn user ([c6806fe](https://github.com/gdluxx/gdluxx/commit/c6806fea0a5956fc54a0e446497a53e3b625e20c))

# [0.8.0](https://github.com/gdluxx/gdluxx/compare/v0.7.0...v0.8.0) (2026-01-13)


### Bug Fixes

* **extension:** context menu feature for sending individual images to gdluxx needed reworked for updated external endpoint ([2425bed](https://github.com/gdluxx/gdluxx/commit/2425bed51fdc2ea74273bd0790aa5bbbef227cca))


### Features

* add arm64 support for gallery-dl binary ([#2](https://github.com/gdluxx/gdluxx/issues/2)) ([97d18f2](https://github.com/gdluxx/gdluxx/commit/97d18f2c1a697391ad9e9ed56debd45f3c78815a)), closes [#1](https://github.com/gdluxx/gdluxx/issues/1)
* **extension:** add optional hotkey to send active tab URL to gdluxx ([d2e2634](https://github.com/gdluxx/gdluxx/commit/d2e2634e16003232ce0f25c7cc72200c49653570))

# [0.7.0](https://github.com/gdluxx/gdluxx/compare/v0.6.0...v0.7.0) (2025-10-08)


### Bug Fixes

* remove .js extensions from imports ([6c82589](https://github.com/gdluxx/gdluxx/commit/6c8258912896deafeecf54badb24635a5cb7e87b))


### Features

* accommodate new features of the browser extension ([331ad39](https://github.com/gdluxx/gdluxx/commit/331ad3979362c959e2462c0c6d84472e6321820e))

# [0.6.0](https://github.com/gdluxx/gdluxx/compare/v0.5.0...v0.6.0) (2025-09-09)


### Bug Fixes

* JobOutputModal was using an incorrect class style ([2f65292](https://github.com/gdluxx/gdluxx/commit/2f65292816337d0aee044acf875fe238cc3e9173))


### Features

* add batch URL processing support to external API endpoint ([db2f094](https://github.com/gdluxx/gdluxx/commit/db2f094314c95c290237513794c11e99e467c20a))
* KeywordInfo component now utilizes user config file to accommodate potential custom extractors (`module-sources`) ([2f5ea3a](https://github.com/gdluxx/gdluxx/commit/2f5ea3ac2f223548de663296ac42b55cf1453e66))

# [0.5.0](https://github.com/gdluxx/gdluxx/compare/v0.4.0...v0.5.0) (2025-09-03)


### Bug Fixes

* ConfigEditor line numbers weren't being styled by the theme ([b6602c2](https://github.com/gdluxx/gdluxx/commit/b6602c2d1581d092c1d36298999d2c3bc4975b0d))
* ConfirmModal was still using old Tailwind classes ([80c0386](https://github.com/gdluxx/gdluxx/commit/80c03861c6b2e2b7b3350e928138c1a7e06c80ef))
* edit root .release-it.json to prevent extension/ commits from being added ([7bb90c5](https://github.com/gdluxx/gdluxx/commit/7bb90c58e0ef1ad337badbd1e641e222badc760c))
* enable KeywordInfo Output box to stretch to bottom of screen ([2eb1acc](https://github.com/gdluxx/gdluxx/commit/2eb1acc47e7f84df1673fd2ce6142c38d9952f02))


### Features

* add file management controls to ConfigEditor ([cc5549c](https://github.com/gdluxx/gdluxx/commit/cc5549c00c9dce3a8384eab188a7508a9f8d79ad))
* added ability to full screen the config editor within the browser window ([93b1bef](https://github.com/gdluxx/gdluxx/commit/93b1befe56741ac6c1fc378c49e564c4b01285ff))
* implement theming system with multiple themes ([b3c3886](https://github.com/gdluxx/gdluxx/commit/b3c3886623b19e85d675297f15d5df79410d9db6))

# [0.4.0](https://github.com/gdluxx/gdluxx/compare/v0.3.0...v0.4.0) (2025-08-13)


### Bug Fixes

* `baseApiUrl` check was duplicated for https ([856ee31](https://github.com/gdluxx/gdluxx/commit/856ee31dec415295becc6210bc71da3b2d452b73))
* adjust baseApiUrl checking ([49606fb](https://github.com/gdluxx/gdluxx/commit/49606fb6c75e7d2e7679554d8aba45d3dad3860c))
* Site Rules weren't displaying if marked as disabled. ([fa209ee](https://github.com/gdluxx/gdluxx/commit/fa209eef3a39fff23acf36f19757d6671506124c))
* top positioning was missing from the sm variant of Toggle component ([67eaab4](https://github.com/gdluxx/gdluxx/commit/67eaab4b31aaeb6584ef9d35498bce9a192342e4))
* use plain objects instead of Maps ([101f330](https://github.com/gdluxx/gdluxx/commit/101f33067f21100d9b6135f690b90d848bf85655))


### Features

* add ability to enable/disable site rules from rule list ([daca59f](https://github.com/gdluxx/gdluxx/commit/daca59f3a9a78c6cef502083e41e4b8d4c9af131))
* add optional warning when manual options conflict with site rules ([02295c3](https://github.com/gdluxx/gdluxx/commit/02295c337ffc96ef47d88ea36a68b621ba909a8d))
* expand Docker path rewriting to include log file directory ([9cd9817](https://github.com/gdluxx/gdluxx/commit/9cd9817be836379cf7cce4a07b74b4ab8572092c))

# [0.3.0](https://github.com/gdluxx/gdluxx/compare/v0.2.0...v0.3.0) (2025-08-10)


### Bug Fixes

* ClientLogger was being instantiated during SSR before localStorage was available ([d5a714b](https://github.com/gdluxx/gdluxx/commit/d5a714bbd89ea7af6cd544817af4a612481819f1))
* duplicate key error for supported sites ([732f551](https://github.com/gdluxx/gdluxx/commit/732f551dfc1a9955647383fe50998d0101083ba2))
* schema.sql apiKey table schema conflicting with better-auth schema ([40e387a](https://github.com/gdluxx/gdluxx/commit/40e387a6a92619395afa2488503341e5d884e5da))
* tooltip content overrunning its background ([8a6c178](https://github.com/gdluxx/gdluxx/commit/8a6c178b988638f1420a848f687d4297b16e67d2))
* Updated supported sites parsing, it was missing ~20 sites. also added checks for empty urls due to the way the supportedsites.md file is built ([b019a41](https://github.com/gdluxx/gdluxx/commit/b019a4169917c79d7d257dcf40d60db5bb78cc85))
* using Site Patterns was erroring ([7362bef](https://github.com/gdluxx/gdluxx/commit/7362befc735f28df1e2ce318fb679a9f510c8f98))


### Features

* add KeywordInfo component ([64f9720](https://github.com/gdluxx/gdluxx/commit/64f9720ca7f40d0e3e1c6bd690710a8522561ae1))
* add reusable Toggle (slider) component ([1d584ae](https://github.com/gdluxx/gdluxx/commit/1d584ae005b1cd654e2a626025ac2e7fdc57f48d))

# [0.2.0](https://github.com/gdluxx/gdluxx/compare/v0.1.2...v0.2.0) (2025-07-30)


### Bug Fixes

* adjust reactive breakpoint for statistics grid ([c14a8e8](https://github.com/gdluxx/gdluxx/commit/c14a8e890e351d6f1bdda9d1d2252f0f1bf5f8b4))
* data type return expecting array of arrays ([fa4dc8c](https://github.com/gdluxx/gdluxx/commit/fa4dc8ca50dd70a7cc4e2b572916ffc7900aa374))
* fix JSON serialization/deserialization issue in new CLI options manager ([3980746](https://github.com/gdluxx/gdluxx/commit/3980746883c5a0bce591d3609cb801627ccc00cb))
* sqlite data type error in settingsManager.ts ([fad016e](https://github.com/gdluxx/gdluxx/commit/fad016eea79bbfccb775a159d8874e2dfeb8618b))
* styling syntax ([41aa635](https://github.com/gdluxx/gdluxx/commit/41aa635e809be7cb646e961064ab928df77dac3f))
* update navigation import ([1f500d8](https://github.com/gdluxx/gdluxx/commit/1f500d8ce842ff057aef8b0557477b6829c0463b))


### Features

* add extension config page to allow cli options for the browser extension. combining it with the ConfigForm options ([c158b3d](https://github.com/gdluxx/gdluxx/commit/c158b3d34d978e2b27c6af58c54f2c78be46952d))
* add file upload component ([ef09363](https://github.com/gdluxx/gdluxx/commit/ef09363716775f33b02d6d930623c486b26e0e84))
* add job count tracking and modified jobsList UI with status icons ([e6e9079](https://github.com/gdluxx/gdluxx/commit/e6e9079b69c7bdaee517d883b289178f78338a05))
* enhance config path transformation for docker bind mount compatibility ([cf57a13](https://github.com/gdluxx/gdluxx/commit/cf57a134543a222db3aeafe65c6040dea98775a7))
* users can now upload a configuration file ([960bfda](https://github.com/gdluxx/gdluxx/commit/960bfda2676cb0be3e8f794ce08cc34ff5a4d862))

## [0.1.2](https://github.com/gdluxx/gdluxx/compare/v0.1.1...v0.1.2) (2025-07-09)


### Bug Fixes

* hardcoded path in Icon component was preventing some icons from displaying ([d03f836](https://github.com/gdluxx/gdluxx/commit/d03f836445bbf1cefd0f9ca0d42944e5a905edd1))
* remove unused parameter ([fd45daa](https://github.com/gdluxx/gdluxx/commit/fd45daa66ab091330c183847d79126978de32a24))

## [0.1.1](https://github.com/gdluxx/gdluxx/compare/v0.1.0...v0.1.1) (2025-07-08)


### Bug Fixes

* External endpoint got forgotten during SvelteKit endpoint migration ([a28408a](https://github.com/gdluxx/gdluxx/commit/a28408a857f3452af4d621dafb8afddc3e56338a))

# [0.1.0](https://github.com/gdluxx/gdluxx/compare/v0.0.6...v0.1.0) (2025-07-08)


### Bug Fixes

* better explanations for docker compose and .env files. add helper message to Docker file ([a2a7990](https://github.com/gdluxx/gdluxx/commit/a2a79902efae493a48e35e2b3ee8f9e812fb416c))
* fix ThemeToggle ([f9acbe5](https://github.com/gdluxx/gdluxx/commit/f9acbe553bd61e0904f1c0902291baafeb035dd2))
* gallery-dl output coloring broke, added fix ([8dbc5ec](https://github.com/gdluxx/gdluxx/commit/8dbc5ecddf8929df239399d358be43fc08ddc12f))
* implement SvelteKit endpoint to fix JobsIndicator and JobsList reactivity ([4cea472](https://github.com/gdluxx/gdluxx/commit/4cea472c32b0ecf5111dbedbd6854651c7c98a6c))
* implicit types causing inspection errors. move to explicit types ([37952a4](https://github.com/gdluxx/gdluxx/commit/37952a49a247c190bb9191fe716acdc97a36e5e6))
* job count clipped once over 99 jobs ([ffc0394](https://github.com/gdluxx/gdluxx/commit/ffc0394490b1c80cc66258dee8f36c120b6356b8))
* JobsIndicator not working after migration to SvelteKit endpoints ([26703b8](https://github.com/gdluxx/gdluxx/commit/26703b8bdd46ed873f65fba507d2f06bd7e0b1e7))
* JobsIndicator reactivity for active jobs ([1f767dd](https://github.com/gdluxx/gdluxx/commit/1f767dd903ea5492c997a71f604cd1052ffcf37e))
* JobsIndicator reactivity for active jobs ([90de347](https://github.com/gdluxx/gdluxx/commit/90de34712ca23f36e319cb13b87bc23ad90c7dca))
* reduce options that aren't compatible or duplicate gdluxx functionality. ([1c85757](https://github.com/gdluxx/gdluxx/commit/1c85757f3dc21d21f14dfe56c4de15a72fe27526))
* remove legacy code causing configuration file to be missed ([80f0b61](https://github.com/gdluxx/gdluxx/commit/80f0b61f218a305ece7ba4807ee8e520a459716d))
* type issues ([7e1d454](https://github.com/gdluxx/gdluxx/commit/7e1d45494d3f6615036c0f0bfcef612ad2a2b81d))


### Features

* add ability to use gallery-dl options ([17b28b7](https://github.com/gdluxx/gdluxx/commit/17b28b77e78c4cd447f4a0d150dd3c8a17ba70a1))
* add visual indicator for selected options ([b5bf0ae](https://github.com/gdluxx/gdluxx/commit/b5bf0ae9570eb66fff89f24bd268fab95619ae26))
* implement ConfirmModal for individual job deletion ([7c4080e](https://github.com/gdluxx/gdluxx/commit/7c4080ecf85a9c01182809906df45d217f781213))
* JobsList, add sorting, multi-select for deletion ([c6933b6](https://github.com/gdluxx/gdluxx/commit/c6933b681f7b313e16401fb62a964003cd4a7a14))
* re-add lost conditional input display ([fb654d2](https://github.com/gdluxx/gdluxx/commit/fb654d2d3a5fab7dd46e1deeb421bb5e4bb1f28d))
* re-add lost conditional input display ([cf0f0c7](https://github.com/gdluxx/gdluxx/commit/cf0f0c7e387ccee5ddca21930943e78fbaa070c1))
* update addition of options arguments ([3cda3fd](https://github.com/gdluxx/gdluxx/commit/3cda3fd525339516fb04a2bb6548daf60a5a8a7f))

## [0.0.6](https://github.com/gdluxx/gdluxx/compare/v0.0.5...v0.0.6) (2025-07-01)


### Bug Fixes

* accommodate docker container bind mount path for user config file ([40d5643](https://github.com/gdluxx/gdluxx/commit/40d5643fcc37413799e7de80866e059c90668be2))
* add trustedOrigins ([2587a81](https://github.com/gdluxx/gdluxx/commit/2587a81e745f44b24fdbae084910467996dcc24b))
* focus management added for ConfirmModal ([9398946](https://github.com/gdluxx/gdluxx/commit/9398946887e3cf1d65e019ce0442087442bae734))
* formError now uses the Info component ([265dab9](https://github.com/gdluxx/gdluxx/commit/265dab9cba4cdf3e8d44c5d2bdfd4ebfcd6b0272))
* revert to manual releases ([3e2afb4](https://github.com/gdluxx/gdluxx/commit/3e2afb4e66f35cc4c7c1713c81d07b32fd218fe7))
* trust origin errors, process.env not setting correctly ([4b35f91](https://github.com/gdluxx/gdluxx/commit/4b35f918364cb84e06b726a6dbd0c286fcd8927d))
* type warnings ([2171720](https://github.com/gdluxx/gdluxx/commit/2171720b06e724c0231ecf5737fb37bf2e8d675b))

## [0.0.5](https://github.com/gdluxx/gdluxx/compare/v0.0.4...v0.0.5) (2025-06-30)

## [0.0.4](https://github.com/gdluxx/gdluxx/compare/v0.0.3...v0.0.4) (2025-06-30)

## [0.0.3](https://github.com/gdluxx/gdluxx/compare/v0.0.2...v0.0.3) (2025-06-29)


### Bug Fixes

* binary path ([3fb1a51](https://github.com/gdluxx/gdluxx/commit/3fb1a519a2434831237f6ed17f0d451bf35c950a))
* docker compose files and .env.example [skip ci] ([a1e676b](https://github.com/gdluxx/gdluxx/commit/a1e676b9fbbe2794bd5a493a26a950906000803c))

## 0.0.2 (2025-06-29)


### Bug Fixes

* activeItemId class for light mode was the same as bg, adjusted from 900 to 800 ([ca1429a](https://github.com/gdluxx/gdluxx/commit/ca1429abe5cc12aea789bd94db280268ca013722))
* add check for navigator.clipboard as it's undefined on an insecure connection ([1483914](https://github.com/gdluxx/gdluxx/commit/14839144a495f504a715734c7b868c527a183d84))
* add missing dependencies ([54fc059](https://github.com/gdluxx/gdluxx/commit/54fc059e6c9c7538443d4cd72795868a686605b9))
* alpine didn't have appropriate libraries, switch to Debian ([48ed886](https://github.com/gdluxx/gdluxx/commit/48ed886591c7aa12a4ac5b2e2cf52e40c22c9b43))
* importing server helper function to client ([d5a3449](https://github.com/gdluxx/gdluxx/commit/d5a3449934e28d0feb6fccda123644371691f1a2))
* Move sprite.svg to /static directory ([3fc7380](https://github.com/gdluxx/gdluxx/commit/3fc7380a830a19361a240a1611eeda4bcdbd3670))
* Remove hardcoded localhost used during dev ([84c3c19](https://github.com/gdluxx/gdluxx/commit/84c3c19cfc9fc05c7054aa534d0c88abda3ff50a))
* replace crypto.randomUUID() with uuidv4() ([60ce8e4](https://github.com/gdluxx/gdluxx/commit/60ce8e4e7fde14b9724c7f667e6e79ad07f25cf7))
* resolve ci storm [skip ci] ([f5c7c39](https://github.com/gdluxx/gdluxx/commit/f5c7c39c92a4e42bcf590088fa6ddaad2be2ba4e))
* type errors in VersionManager component ([9986a60](https://github.com/gdluxx/gdluxx/commit/9986a60546fe8f6222b9f90452e9139f5fd649af))
