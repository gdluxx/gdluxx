# Changelog

# [1.10.0](https://github.com/gdluxx/gdluxx/compare/extension-v1.9.0...extension-v1.10.0) (2026-08-18)

# [1.9.0](https://github.com/gdluxx/gdluxx/compare/extension-v1.8.0...extension-v1.9.0) (2026-08-16)


### Bug Fixes

* **extension:** gate compat freshness on the last successful ping ([ee54712](https://github.com/gdluxx/gdluxx/commit/ee5471248d634a9c5cb8e7e3cb64b07066300f78))


### Features

* **extension:** surface suppressed fallbacks and re-ping stale compat ([25bbed9](https://github.com/gdluxx/gdluxx/commit/25bbed933cb922f28056f825d22908a80717140f))

# [1.8.0](https://github.com/gdluxx/gdluxx/compare/extension-v1.7.0...extension-v1.8.0) (2026-08-15)


### Bug Fixes

* **extension:** drop invalid hostnames instead of failing the send ([fa645f4](https://github.com/gdluxx/gdluxx/commit/fa645f4cf688a0ec49d22c34d6639f0cd9a9112d))


### Features

* **extension:** apply folder settings to hotkey and popup sends ([4570344](https://github.com/gdluxx/gdluxx/commit/4570344b20929be0780cb3dc1dcdc35ba2dc9b1c))
* **extension:** send extracted images alongside the hotkey URL ([126bad2](https://github.com/gdluxx/gdluxx/commit/126bad275fb13b429656021e0f6ef634889551e8))

# [1.7.0](https://github.com/gdluxx/gdluxx/compare/extension-v1.6.0...extension-v1.7.0) (2026-08-12)


### Bug Fixes

* **extension:** keep profile writes whole on save and import ([6702788](https://github.com/gdluxx/gdluxx/commit/6702788567465b11cf6f71c4f784e7f5e2ccd975))
* **extension:** stop hosting browser dialogs in the toolbar popup ([c0853f4](https://github.com/gdluxx/gdluxx/commit/c0853f4da6aec6748d063a3e2202ff2065f479be))


### Features

* **extension:** accumulate images while scrolling with per profile opt in ([524923d](https://github.com/gdluxx/gdluxx/commit/524923d109afdac3f955da4eda70984c5165a744))
* **extension:** add Cookies settings tab ([5413d1c](https://github.com/gdluxx/gdluxx/commit/5413d1cacc62587ad6b84c2c220dc2a73dc18cb6))
* **extension:** add gallery select mode and lightbox send ([7ae8a90](https://github.com/gdluxx/gdluxx/commit/7ae8a9008b5803ae8f1760be084fc34392b45591))
* **extension:** add gallery wheel navigation and improve scrolling ([19dbf1e](https://github.com/gdluxx/gdluxx/commit/19dbf1ea0b5b37c509197ec500d7a1dff2415949))
* **extension:** add hotkey for Gallery and hotkey conflict detection ([e921bc5](https://github.com/gdluxx/gdluxx/commit/e921bc511225e5c4bd9e289f8cea8b888a00db39))
* **extension:** add persistent sent URL history with status badges ([5d378c1](https://github.com/gdluxx/gdluxx/commit/5d378c1ccd956d11309833d48aaca79e9d6519b1))
* **extension:** autofill custom directory from profile directory source ([a288a85](https://github.com/gdluxx/gdluxx/commit/a288a85013e4b487475da42c0739036395ba0494))
* **extension:** capture and sync cookies to server ([2d6706d](https://github.com/gdluxx/gdluxx/commit/2d6706dd7bbeb12174609755528012c546414328))
* **extension:** degrade gracefully against older gdluxx servers ([ee6c6e9](https://github.com/gdluxx/gdluxx/commit/ee6c6e9f97a0c2e100fcc897037795db2cb88bda))
* **extension:** notify job completion via background polling ([5b4c99c](https://github.com/gdluxx/gdluxx/commit/5b4c99c8577362885567db0ec2adfdde529207a7))
* **extension:** preview substitutions before anything is selected ([315e50b](https://github.com/gdluxx/gdluxx/commit/315e50bc9b90eda84db59b1fec881dc2472ecc0d))
* **extension:** protect profile data across version skew ([035389a](https://github.com/gdluxx/gdluxx/commit/035389a96feff1feb19ee5da23745c211450b9cf))
* **extension:** remember Gallery thumbnail size ([d8f5584](https://github.com/gdluxx/gdluxx/commit/d8f5584adf9e6ce6bcf2e73fbd58508f2c49ad30))
* **extension:** rerun profile matching on SPA navigation ([1009d71](https://github.com/gdluxx/gdluxx/commit/1009d71f1dd274140cd052412c5dbea0d3d0c5b8))
* **extension:** sync batch limit from server and chunk oversized sends ([d59a542](https://github.com/gdluxx/gdluxx/commit/d59a54297dd3d5afca23e78ab75fff5e42702b67))

# [1.6.0](https://github.com/gdluxx/gdluxx/compare/extension-v1.5.1...extension-v1.6.0) (2026-07-16)


### Bug Fixes

* **ci:** pin Node via .nvmrc in release workflows and fix dead assignment in gallerizedUtils ([244c2c9](https://github.com/gdluxx/gdluxx/commit/244c2c9bce1bd341bb8ed5dc23b38c6ba96cc310))
* **extension:** Substitutions weren't being applied correctly after feature consolidation ([a0e86d2](https://github.com/gdluxx/gdluxx/commit/a0e86d2c9652492bb6b662d26ded1c1e2e66edc0))


### Features

* add "gallerized" feature ([9431a60](https://github.com/gdluxx/gdluxx/commit/9431a609eb59647402fdc2d64cf581ecf0f1d70d))
* consolidating extension features + "gallerized" ([eeefc2e](https://github.com/gdluxx/gdluxx/commit/eeefc2ed48f7be23a354d59eb80c90c73145ca27))
* **extension-profiles:** add backup editing and restore preview ([0163bc3](https://github.com/gdluxx/gdluxx/commit/0163bc3d4b89fedd38a32d78ab08b9e1d8bbca40))
* wire in "gallerized" ui ([6e663b8](https://github.com/gdluxx/gdluxx/commit/6e663b825fca2cbe6b6daa468e46dc253dd2db6c))

## [1.5.1](https://github.com/gdluxx/gdluxx/compare/extension-v1.5.0...extension-v1.5.1) (2026-04-05)


### Bug Fixes

* **release:** another attempt at correcting changelog contamination between root and extension ([18531eb](https://github.com/gdluxx/gdluxx/commit/18531eb45b436103c3540bb0a4da8425543629f0))


### Features

* **extension:** add site directory toggle to overlay ([a5ad218](https://github.com/gdluxx/gdluxx/commit/a5ad218d5f932c11cc8e82c1e4e50e13be2e91cf))

# [1.5.0](https://github.com/gdluxx/gdluxx/compare/extension-v1.4.0...extension-v1.5.0) (2025-12-04)


### Bug Fixes

* **extension:** borders not displaying ([5a0ad7b](https://github.com/gdluxx/gdluxx/commit/5a0ad7bdd4c5579f68396dbca5347678bbc64e9b))
* **extension:** cards and shadow not working correctly on Appearance tab of settings ([6ea1d11](https://github.com/gdluxx/gdluxx/commit/6ea1d119a7b8e61ae8ec662d985e8236920ea01b))
* **extension:** Dropdown component wasn't closing with outside click or upon selection ([10f8a8b](https://github.com/gdluxx/gdluxx/commit/10f8a8b0c981a097f3ead95e107123d1426826bb))
* **extension:** remove unused prop and add empty catch comment ([686c129](https://github.com/gdluxx/gdluxx/commit/686c129ffdbe807c66b49b3993f24d8cd486957a))


### Features

* **extension:** add soft variant and size to Info component ([556c88d](https://github.com/gdluxx/gdluxx/commit/556c88dd32b9f17d284be514966f7960f0446c7a))
* **extension:** updated some styling and button locations to better accommodate lower resolution (HD/1080) screens ([f192de4](https://github.com/gdluxx/gdluxx/commit/f192de43e05b8485490149c3f57819e6b1061b3f))

# [1.4.0](https://github.com/gdluxx/gdluxx/compare/extension-v1.3.0...extension-v1.4.0) (2025-11-04)


### Bug Fixes

* **extension:** data_collection_permissions cannot be empty ([6840d04](https://github.com/gdluxx/gdluxx/commit/6840d04d0d0dc4d472b77347d4d9ef47d3257598))
* **extension:** forgot file. reworded context menu items ([99ae0af](https://github.com/gdluxx/gdluxx/commit/99ae0afd834c4868bdc36d312853f81792cce52a))
* **extension:** linting error preventing action from completing ([4d33883](https://github.com/gdluxx/gdluxx/commit/4d33883490251594e2126440bb5ebd12ff26dd75))

# [1.3.0](https://github.com/gdluxx/gdluxx/compare/extension-v1.2.0...extension-v1.3.0) (2025-11-04)


### Bug Fixes

* **extension:** context menu feature for sending individual images to gdluxx needed reworked for updated external endpoint ([2425bed](https://github.com/gdluxx/gdluxx/commit/2425bed51fdc2ea74273bd0790aa5bbbef227cca))
* **extension:** fix data_collection_permissions property for firefox takes a string not a boolean ([b1c3c8b](https://github.com/gdluxx/gdluxx/commit/b1c3c8be31545148098a7517fbf1217e9742d3d6))
* **extension:** gallery-dl was failing for image urls sent via context menu when they contained a trailing slash ([15b3cc4](https://github.com/gdluxx/gdluxx/commit/15b3cc484259d68580041161343ce965b7cc5bd7))
* **extension:** handle (prettify) raw browser API error messages ([56deaa8](https://github.com/gdluxx/gdluxx/commit/56deaa89dba123912aca233834af4dadc2c457c4))


### Features

* **extension:** add button to extension popup allowing to send active tab URL to gdluxx ([dba6baf](https://github.com/gdluxx/gdluxx/commit/dba6bafc306afaa9862e4d0460f5a011e9958d8d))
* **extension:** add optional hotkey to send active tab URL to gdluxx ([d2e2634](https://github.com/gdluxx/gdluxx/commit/d2e2634e16003232ce0f25c7cc72200c49653570))

# [1.2.0](https://github.com/gdluxx/gdluxx/compare/extension-v1.1.5...extension-v1.2.0) (2025-10-20)


### Bug Fixes

* add data_collection_permissions to wxt.config for firefox ([347d630](https://github.com/gdluxx/gdluxx/commit/347d6303fdf28fb3c70a9d8d1b8a1ab7d26a7b3e))
* **extension/component:** import paths ([e674820](https://github.com/gdluxx/gdluxx/commit/e674820ce6a81fadf3d96407942765e14a49c691))
* **extension:** fix closing bracket for icon ([4003c93](https://github.com/gdluxx/gdluxx/commit/4003c93420cb1e950b42e1f8fb456af7ccc07319))
* **extension:** svelte type error ([146b888](https://github.com/gdluxx/gdluxx/commit/146b888a794fba90d9aa53713643f4483ab999b4))
* typo in iconName ([dc5f655](https://github.com/gdluxx/gdluxx/commit/dc5f6552ffc529f6805ff5c522ea2a5b1254bcea))


### Features

* **component:** add Badge component ([a65cf8e](https://github.com/gdluxx/gdluxx/commit/a65cf8e5b68d33e6ce715de8d7b7573f5b293f8c))
* **extension/component:** add reusable Dropdown component ([6d7082e](https://github.com/gdluxx/gdluxx/commit/6d7082e1c5a08e8025a008c6b2900ce784e0656e))
* **extension/component:** add reusable Toggle component ([d5309c2](https://github.com/gdluxx/gdluxx/commit/d5309c263256a3b6e4339e753462e2b0dc84a94c))
* **extension/component:** adjusted tailwind classes of Badge component for sizing ([4bda8b5](https://github.com/gdluxx/gdluxx/commit/4bda8b5a4fe3d09d1f8288902107517c537fa842))
* **extension/ui:** add -outline variant to Button component ([6b7a912](https://github.com/gdluxx/gdluxx/commit/6b7a9124efb2850c0f85c8b985499d47cf7fd388))
* **extension:** add url substitution feature ([3bf67e1](https://github.com/gdluxx/gdluxx/commit/3bf67e1167efbe5c16b36525484584e031c658c2))

## [1.1.5](https://github.com/gdluxx/gdluxx/compare/extension-v1.1.1...extension-v1.1.5) (2025-10-08)


### Bug Fixes

* disable eslint prefer-const and add svelte/prefer-const. it was breaking ci pipeline ([03db827](https://github.com/gdluxx/gdluxx/commit/03db8278fdaf159386005f1191a316d7202f5afa))
* modify extension/.release-it.json to include only extension/  directory ([1aa0752](https://github.com/gdluxx/gdluxx/commit/1aa075230ee8ecd3f05a49f26c1b35620971fa55))


### Features

* **extension:** add overlay UI ([4bdf244](https://github.com/gdluxx/gdluxx/commit/4bdf2447559a0a1c13d272f462b7583b9ab4f4b0))

## 1.1.1 (2025-08-14)


### Bug Fixes

* automate store uploads ([534006f](https://github.com/gdluxx/gdluxx/commit/534006fa921721773563f2fce12cfebe51e4925f))

# [1.1.0](https://github.com/gdluxx/gdluxx-browser/compare/0.0.0...v1.1.0) (2025-07-20)


### Bug Fixes

* `baseApiUrl` check was duplicated for https ([856ee31](https://github.com/gdluxx/gdluxx-browser/commit/856ee31dec415295becc6210bc71da3b2d452b73))
* adjust baseApiUrl checking ([49606fb](https://github.com/gdluxx/gdluxx-browser/commit/49606fb6c75e7d2e7679554d8aba45d3dad3860c))


### Features

* add context menu to allow sending a single image link to the gdluxx API endpoint ([967194e](https://github.com/gdluxx/gdluxx-browser/commit/967194e43f8826e4a10e2c9bda5329ecaeff7117))



# 0.0.0 (2025-07-09)
