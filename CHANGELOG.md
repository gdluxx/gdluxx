# Changelog

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
