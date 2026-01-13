# Changelog

# [0.8.0](https://github.com/gdluxx/gdluxx/compare/v0.7.0...v0.8.0) (2026-01-13)


### Bug Fixes

* add data_collection_permissions to wxt.config for firefox ([347d630](https://github.com/gdluxx/gdluxx/commit/347d6303fdf28fb3c70a9d8d1b8a1ab7d26a7b3e))
* disable eslint prefer-const and add svelte/prefer-const. it was breaking ci pipeline ([03db827](https://github.com/gdluxx/gdluxx/commit/03db8278fdaf159386005f1191a316d7202f5afa))
* **extension/component:** import paths ([e674820](https://github.com/gdluxx/gdluxx/commit/e674820ce6a81fadf3d96407942765e14a49c691))
* **extension:** borders not displaying ([5a0ad7b](https://github.com/gdluxx/gdluxx/commit/5a0ad7bdd4c5579f68396dbca5347678bbc64e9b))
* **extension:** cards and shadow not working correctly on Appearance tab of settings ([6ea1d11](https://github.com/gdluxx/gdluxx/commit/6ea1d119a7b8e61ae8ec662d985e8236920ea01b))
* **extension:** context menu feature for sending individual images to gdluxx needed reworked for updated external endpoint ([2425bed](https://github.com/gdluxx/gdluxx/commit/2425bed51fdc2ea74273bd0790aa5bbbef227cca))
* **extension:** data_collection_permissions cannot be empty ([6840d04](https://github.com/gdluxx/gdluxx/commit/6840d04d0d0dc4d472b77347d4d9ef47d3257598))
* **extension:** Dropdown component wasn't closing with outside click or upon selection ([10f8a8b](https://github.com/gdluxx/gdluxx/commit/10f8a8b0c981a097f3ead95e107123d1426826bb))
* **extension:** fix closing bracket for icon ([4003c93](https://github.com/gdluxx/gdluxx/commit/4003c93420cb1e950b42e1f8fb456af7ccc07319))
* **extension:** fix data_collection_permissions property for firefox takes a string not a boolean ([b1c3c8b](https://github.com/gdluxx/gdluxx/commit/b1c3c8be31545148098a7517fbf1217e9742d3d6))
* **extension:** forgot file. reworded context menu items ([99ae0af](https://github.com/gdluxx/gdluxx/commit/99ae0afd834c4868bdc36d312853f81792cce52a))
* **extension:** gallery-dl was failing for image urls sent via context menu when they contained a trailing slash ([15b3cc4](https://github.com/gdluxx/gdluxx/commit/15b3cc484259d68580041161343ce965b7cc5bd7))
* **extension:** handle (prettify) raw browser API error messages ([56deaa8](https://github.com/gdluxx/gdluxx/commit/56deaa89dba123912aca233834af4dadc2c457c4))
* **extension:** linting error preventing action from completing ([4d33883](https://github.com/gdluxx/gdluxx/commit/4d33883490251594e2126440bb5ebd12ff26dd75))
* **extension:** remove circular workflow trigger ([6a1869f](https://github.com/gdluxx/gdluxx/commit/6a1869f596e38fa8406f0ca703b5e51dee5a8592))
* **extension:** remove unused prop and add empty catch comment ([686c129](https://github.com/gdluxx/gdluxx/commit/686c129ffdbe807c66b49b3993f24d8cd486957a))
* **extension:** svelte type error ([146b888](https://github.com/gdluxx/gdluxx/commit/146b888a794fba90d9aa53713643f4483ab999b4))
* typo in iconName ([dc5f655](https://github.com/gdluxx/gdluxx/commit/dc5f6552ffc529f6805ff5c522ea2a5b1254bcea))


### Features

* add arm64 support for gallery-dl binary ([#2](https://github.com/gdluxx/gdluxx/issues/2)) ([97d18f2](https://github.com/gdluxx/gdluxx/commit/97d18f2c1a697391ad9e9ed56debd45f3c78815a)), closes [#1](https://github.com/gdluxx/gdluxx/issues/1)
* **component:** add Badge component ([a65cf8e](https://github.com/gdluxx/gdluxx/commit/a65cf8e5b68d33e6ce715de8d7b7573f5b293f8c))
* **extension/component:** add reusable Dropdown component ([6d7082e](https://github.com/gdluxx/gdluxx/commit/6d7082e1c5a08e8025a008c6b2900ce784e0656e))
* **extension/component:** add reusable Toggle component ([d5309c2](https://github.com/gdluxx/gdluxx/commit/d5309c263256a3b6e4339e753462e2b0dc84a94c))
* **extension/component:** adjusted tailwind classes of Badge component for sizing ([4bda8b5](https://github.com/gdluxx/gdluxx/commit/4bda8b5a4fe3d09d1f8288902107517c537fa842))
* **extension/ui:** add -outline variant to Button component ([6b7a912](https://github.com/gdluxx/gdluxx/commit/6b7a9124efb2850c0f85c8b985499d47cf7fd388))
* **extension:** add button to extension popup allowing to send active tab URL to gdluxx ([dba6baf](https://github.com/gdluxx/gdluxx/commit/dba6bafc306afaa9862e4d0460f5a011e9958d8d))
* **extension:** add optional hotkey to send active tab URL to gdluxx ([d2e2634](https://github.com/gdluxx/gdluxx/commit/d2e2634e16003232ce0f25c7cc72200c49653570))
* **extension:** add soft variant and size to Info component ([556c88d](https://github.com/gdluxx/gdluxx/commit/556c88dd32b9f17d284be514966f7960f0446c7a))
* **extension:** add url substitution feature ([3bf67e1](https://github.com/gdluxx/gdluxx/commit/3bf67e1167efbe5c16b36525484584e031c658c2))
* **extension:** updated some styling and button locations to better accommodate lower resolution (HD/1080) screens ([f192de4](https://github.com/gdluxx/gdluxx/commit/f192de43e05b8485490149c3f57819e6b1061b3f))

# [0.7.0](https://github.com/gdluxx/gdluxx/compare/v0.6.0...v0.7.0) (2025-10-08)


### Bug Fixes

* remove .js extensions from imports ([6c82589](https://github.com/gdluxx/gdluxx/commit/6c8258912896deafeecf54badb24635a5cb7e87b))


### Features

* accommodate new features of the browser extension ([331ad39](https://github.com/gdluxx/gdluxx/commit/331ad3979362c959e2462c0c6d84472e6321820e))
* **extension:** add overlay UI ([4bdf244](https://github.com/gdluxx/gdluxx/commit/4bdf2447559a0a1c13d272f462b7583b9ab4f4b0))

# [0.6.0](https://github.com/gdluxx/gdluxx/compare/v0.5.0...v0.6.0) (2025-09-09)


### Bug Fixes

* JobOutputModal was using an incorrect class style ([2f65292](https://github.com/gdluxx/gdluxx/commit/2f65292816337d0aee044acf875fe238cc3e9173))


### Features

* add batch URL processing support to external API endpoint ([db2f094](https://github.com/gdluxx/gdluxx/commit/db2f094314c95c290237513794c11e99e467c20a))
* KeywordInfo component now utilizes user config file to accommodate potential custom extractors (`module-sources`) ([2f5ea3a](https://github.com/gdluxx/gdluxx/commit/2f5ea3ac2f223548de663296ac42b55cf1453e66))

# [0.5.0](https://github.com/gdluxx/gdluxx/compare/v0.4.0...v0.5.0) (2025-09-03)


### Bug Fixes

* automate store uploads ([534006f](https://github.com/gdluxx/gdluxx/commit/534006fa921721773563f2fce12cfebe51e4925f))
* ConfigEditor line numbers weren't being styled by the theme ([b6602c2](https://github.com/gdluxx/gdluxx/commit/b6602c2d1581d092c1d36298999d2c3bc4975b0d))
* ConfirmModal was still using old Tailwind classes ([80c0386](https://github.com/gdluxx/gdluxx/commit/80c03861c6b2e2b7b3350e928138c1a7e06c80ef))
* edit root .release-it.json to prevent extension/ commits from being added ([7bb90c5](https://github.com/gdluxx/gdluxx/commit/7bb90c58e0ef1ad337badbd1e641e222badc760c))
* enable KeywordInfo Output box to stretch to bottom of screen ([2eb1acc](https://github.com/gdluxx/gdluxx/commit/2eb1acc47e7f84df1673fd2ce6142c38d9952f02))
* modify extension/.release-it.json to include only extension/  directory ([1aa0752](https://github.com/gdluxx/gdluxx/commit/1aa075230ee8ecd3f05a49f26c1b35620971fa55))


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
