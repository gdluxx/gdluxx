# Changelog

## 1.1.1 (2025-08-14)


### Bug Fixes

* `baseApiUrl` check was duplicated for https ([856ee31](https://github.com/gdluxx/gdluxx/commit/856ee31dec415295becc6210bc71da3b2d452b73))
* accommodate docker container bind mount path for user config file ([40d5643](https://github.com/gdluxx/gdluxx/commit/40d5643fcc37413799e7de80866e059c90668be2))
* activeItemId class for light mode was the same as bg, adjusted from 900 to 800 ([ca1429a](https://github.com/gdluxx/gdluxx/commit/ca1429abe5cc12aea789bd94db280268ca013722))
* add check for navigator.clipboard as it's undefined on an insecure connection ([1483914](https://github.com/gdluxx/gdluxx/commit/14839144a495f504a715734c7b868c527a183d84))
* add missing dependencies ([54fc059](https://github.com/gdluxx/gdluxx/commit/54fc059e6c9c7538443d4cd72795868a686605b9))
* add trustedOrigins ([2587a81](https://github.com/gdluxx/gdluxx/commit/2587a81e745f44b24fdbae084910467996dcc24b))
* adjust baseApiUrl checking ([49606fb](https://github.com/gdluxx/gdluxx/commit/49606fb6c75e7d2e7679554d8aba45d3dad3860c))
* adjust reactive breakpoint for statistics grid ([c14a8e8](https://github.com/gdluxx/gdluxx/commit/c14a8e890e351d6f1bdda9d1d2252f0f1bf5f8b4))
* alpine didn't have appropriate libraries, switch to Debian ([48ed886](https://github.com/gdluxx/gdluxx/commit/48ed886591c7aa12a4ac5b2e2cf52e40c22c9b43))
* automate store uploads ([534006f](https://github.com/gdluxx/gdluxx/commit/534006fa921721773563f2fce12cfebe51e4925f))
* better explanations for docker compose and .env files. add helper message to Docker file ([a2a7990](https://github.com/gdluxx/gdluxx/commit/a2a79902efae493a48e35e2b3ee8f9e812fb416c))
* binary path ([3fb1a51](https://github.com/gdluxx/gdluxx/commit/3fb1a519a2434831237f6ed17f0d451bf35c950a))
* ClientLogger was being instantiated during SSR before localStorage was available ([d5a714b](https://github.com/gdluxx/gdluxx/commit/d5a714bbd89ea7af6cd544817af4a612481819f1))
* data type return expecting array of arrays ([fa4dc8c](https://github.com/gdluxx/gdluxx/commit/fa4dc8ca50dd70a7cc4e2b572916ffc7900aa374))
* docker compose files and .env.example [skip ci] ([a1e676b](https://github.com/gdluxx/gdluxx/commit/a1e676b9fbbe2794bd5a493a26a950906000803c))
* duplicate key error for supported sites ([732f551](https://github.com/gdluxx/gdluxx/commit/732f551dfc1a9955647383fe50998d0101083ba2))
* edit root .release-it.json to prevent extension/ commits from being added ([7bb90c5](https://github.com/gdluxx/gdluxx/commit/7bb90c58e0ef1ad337badbd1e641e222badc760c))
* External endpoint got forgotten during SvelteKit endpoint migration ([a28408a](https://github.com/gdluxx/gdluxx/commit/a28408a857f3452af4d621dafb8afddc3e56338a))
* fix JSON serialization/deserialization issue in new CLI options manager ([3980746](https://github.com/gdluxx/gdluxx/commit/3980746883c5a0bce591d3609cb801627ccc00cb))
* fix ThemeToggle ([f9acbe5](https://github.com/gdluxx/gdluxx/commit/f9acbe553bd61e0904f1c0902291baafeb035dd2))
* focus management added for ConfirmModal ([9398946](https://github.com/gdluxx/gdluxx/commit/9398946887e3cf1d65e019ce0442087442bae734))
* formError now uses the Info component ([265dab9](https://github.com/gdluxx/gdluxx/commit/265dab9cba4cdf3e8d44c5d2bdfd4ebfcd6b0272))
* gallery-dl output coloring broke, added fix ([8dbc5ec](https://github.com/gdluxx/gdluxx/commit/8dbc5ecddf8929df239399d358be43fc08ddc12f))
* hardcoded path in Icon component was preventing some icons from displaying ([d03f836](https://github.com/gdluxx/gdluxx/commit/d03f836445bbf1cefd0f9ca0d42944e5a905edd1))
* implement SvelteKit endpoint to fix JobsIndicator and JobsList reactivity ([4cea472](https://github.com/gdluxx/gdluxx/commit/4cea472c32b0ecf5111dbedbd6854651c7c98a6c))
* implicit types causing inspection errors. move to explicit types ([37952a4](https://github.com/gdluxx/gdluxx/commit/37952a49a247c190bb9191fe716acdc97a36e5e6))
* importing server helper function to client ([d5a3449](https://github.com/gdluxx/gdluxx/commit/d5a3449934e28d0feb6fccda123644371691f1a2))
* job count clipped once over 99 jobs ([ffc0394](https://github.com/gdluxx/gdluxx/commit/ffc0394490b1c80cc66258dee8f36c120b6356b8))
* JobsIndicator not working after migration to SvelteKit endpoints ([26703b8](https://github.com/gdluxx/gdluxx/commit/26703b8bdd46ed873f65fba507d2f06bd7e0b1e7))
* JobsIndicator reactivity for active jobs ([1f767dd](https://github.com/gdluxx/gdluxx/commit/1f767dd903ea5492c997a71f604cd1052ffcf37e))
* JobsIndicator reactivity for active jobs ([90de347](https://github.com/gdluxx/gdluxx/commit/90de34712ca23f36e319cb13b87bc23ad90c7dca))
* Move sprite.svg to /static directory ([3fc7380](https://github.com/gdluxx/gdluxx/commit/3fc7380a830a19361a240a1611eeda4bcdbd3670))
* reduce options that aren't compatible or duplicate gdluxx functionality. ([1c85757](https://github.com/gdluxx/gdluxx/commit/1c85757f3dc21d21f14dfe56c4de15a72fe27526))
* Remove hardcoded localhost used during dev ([84c3c19](https://github.com/gdluxx/gdluxx/commit/84c3c19cfc9fc05c7054aa534d0c88abda3ff50a))
* remove legacy code causing configuration file to be missed ([80f0b61](https://github.com/gdluxx/gdluxx/commit/80f0b61f218a305ece7ba4807ee8e520a459716d))
* remove unused parameter ([fd45daa](https://github.com/gdluxx/gdluxx/commit/fd45daa66ab091330c183847d79126978de32a24))
* replace crypto.randomUUID() with uuidv4() ([60ce8e4](https://github.com/gdluxx/gdluxx/commit/60ce8e4e7fde14b9724c7f667e6e79ad07f25cf7))
* resolve ci storm [skip ci] ([f5c7c39](https://github.com/gdluxx/gdluxx/commit/f5c7c39c92a4e42bcf590088fa6ddaad2be2ba4e))
* revert to manual releases ([3e2afb4](https://github.com/gdluxx/gdluxx/commit/3e2afb4e66f35cc4c7c1713c81d07b32fd218fe7))
* schema.sql apiKey table schema conflicting with better-auth schema ([40e387a](https://github.com/gdluxx/gdluxx/commit/40e387a6a92619395afa2488503341e5d884e5da))
* Site Rules weren't displaying if marked as disabled. ([fa209ee](https://github.com/gdluxx/gdluxx/commit/fa209eef3a39fff23acf36f19757d6671506124c))
* sqlite data type error in settingsManager.ts ([fad016e](https://github.com/gdluxx/gdluxx/commit/fad016eea79bbfccb775a159d8874e2dfeb8618b))
* styling syntax ([41aa635](https://github.com/gdluxx/gdluxx/commit/41aa635e809be7cb646e961064ab928df77dac3f))
* tooltip content overrunning its background ([8a6c178](https://github.com/gdluxx/gdluxx/commit/8a6c178b988638f1420a848f687d4297b16e67d2))
* top positioning was missing from the sm variant of Toggle component ([67eaab4](https://github.com/gdluxx/gdluxx/commit/67eaab4b31aaeb6584ef9d35498bce9a192342e4))
* trust origin errors, process.env not setting correctly ([4b35f91](https://github.com/gdluxx/gdluxx/commit/4b35f918364cb84e06b726a6dbd0c286fcd8927d))
* type errors in VersionManager component ([9986a60](https://github.com/gdluxx/gdluxx/commit/9986a60546fe8f6222b9f90452e9139f5fd649af))
* type issues ([7e1d454](https://github.com/gdluxx/gdluxx/commit/7e1d45494d3f6615036c0f0bfcef612ad2a2b81d))
* type warnings ([2171720](https://github.com/gdluxx/gdluxx/commit/2171720b06e724c0231ecf5737fb37bf2e8d675b))
* update navigation import ([1f500d8](https://github.com/gdluxx/gdluxx/commit/1f500d8ce842ff057aef8b0557477b6829c0463b))
* Updated supported sites parsing, it was missing ~20 sites. also added checks for empty urls due to the way the supportedsites.md file is built ([b019a41](https://github.com/gdluxx/gdluxx/commit/b019a4169917c79d7d257dcf40d60db5bb78cc85))
* use plain objects instead of Maps ([101f330](https://github.com/gdluxx/gdluxx/commit/101f33067f21100d9b6135f690b90d848bf85655))
* using Site Patterns was erroring ([7362bef](https://github.com/gdluxx/gdluxx/commit/7362befc735f28df1e2ce318fb679a9f510c8f98))


### Features

* add ability to enable/disable site rules from rule list ([daca59f](https://github.com/gdluxx/gdluxx/commit/daca59f3a9a78c6cef502083e41e4b8d4c9af131))
* add ability to use gallery-dl options ([17b28b7](https://github.com/gdluxx/gdluxx/commit/17b28b77e78c4cd447f4a0d150dd3c8a17ba70a1))
* add context menu to allow sending a single image link to the gdluxx API endpoint ([967194e](https://github.com/gdluxx/gdluxx/commit/967194e43f8826e4a10e2c9bda5329ecaeff7117))
* add extension config page to allow cli options for the browser extension. combining it with the ConfigForm options ([c158b3d](https://github.com/gdluxx/gdluxx/commit/c158b3d34d978e2b27c6af58c54f2c78be46952d))
* add file upload component ([ef09363](https://github.com/gdluxx/gdluxx/commit/ef09363716775f33b02d6d930623c486b26e0e84))
* add job count tracking and modified jobsList UI with status icons ([e6e9079](https://github.com/gdluxx/gdluxx/commit/e6e9079b69c7bdaee517d883b289178f78338a05))
* add KeywordInfo component ([64f9720](https://github.com/gdluxx/gdluxx/commit/64f9720ca7f40d0e3e1c6bd690710a8522561ae1))
* add optional warning when manual options conflict with site rules ([02295c3](https://github.com/gdluxx/gdluxx/commit/02295c337ffc96ef47d88ea36a68b621ba909a8d))
* add reusable Toggle (slider) component ([1d584ae](https://github.com/gdluxx/gdluxx/commit/1d584ae005b1cd654e2a626025ac2e7fdc57f48d))
* add visual indicator for selected options ([b5bf0ae](https://github.com/gdluxx/gdluxx/commit/b5bf0ae9570eb66fff89f24bd268fab95619ae26))
* enhance config path transformation for docker bind mount compatibility ([cf57a13](https://github.com/gdluxx/gdluxx/commit/cf57a134543a222db3aeafe65c6040dea98775a7))
* expand Docker path rewriting to include log file directory ([9cd9817](https://github.com/gdluxx/gdluxx/commit/9cd9817be836379cf7cce4a07b74b4ab8572092c))
* implement ConfirmModal for individual job deletion ([7c4080e](https://github.com/gdluxx/gdluxx/commit/7c4080ecf85a9c01182809906df45d217f781213))
* JobsList, add sorting, multi-select for deletion ([c6933b6](https://github.com/gdluxx/gdluxx/commit/c6933b681f7b313e16401fb62a964003cd4a7a14))
* re-add lost conditional input display ([fb654d2](https://github.com/gdluxx/gdluxx/commit/fb654d2d3a5fab7dd46e1deeb421bb5e4bb1f28d))
* re-add lost conditional input display ([cf0f0c7](https://github.com/gdluxx/gdluxx/commit/cf0f0c7e387ccee5ddca21930943e78fbaa070c1))
* update addition of options arguments ([3cda3fd](https://github.com/gdluxx/gdluxx/commit/3cda3fd525339516fb04a2bb6548daf60a5a8a7f))
* users can now upload a configuration file ([960bfda](https://github.com/gdluxx/gdluxx/commit/960bfda2676cb0be3e8f794ce08cc34ff5a4d862))

# [1.1.0](https://github.com/gdluxx/gdluxx-browser/compare/0.0.0...v1.1.0) (2025-07-20)


### Bug Fixes

* `baseApiUrl` check was duplicated for https ([856ee31](https://github.com/gdluxx/gdluxx-browser/commit/856ee31dec415295becc6210bc71da3b2d452b73))
* adjust baseApiUrl checking ([49606fb](https://github.com/gdluxx/gdluxx-browser/commit/49606fb6c75e7d2e7679554d8aba45d3dad3860c))


### Features

* add context menu to allow sending a single image link to the gdluxx API endpoint ([967194e](https://github.com/gdluxx/gdluxx-browser/commit/967194e43f8826e4a10e2c9bda5329ecaeff7117))



# 0.0.0 (2025-07-09)
