# Changelog

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

* ConfigEditor line numbers weren't being styled by the theme ([b6602c2](https://github.com/gdluxx/gdluxx/commit/b6602c2d1581d092c1d36298999d2c3bc4975b0d))
* ConfirmModal was still using old Tailwind classes ([80c0386](https://github.com/gdluxx/gdluxx/commit/80c03861c6b2e2b7b3350e928138c1a7e06c80ef))
* disable eslint prefer-const and add svelte/prefer-const. it was breaking ci pipeline ([03db827](https://github.com/gdluxx/gdluxx/commit/03db8278fdaf159386005f1191a316d7202f5afa))
* enable KeywordInfo Output box to stretch to bottom of screen ([2eb1acc](https://github.com/gdluxx/gdluxx/commit/2eb1acc47e7f84df1673fd2ce6142c38d9952f02))
* JobOutputModal was using an incorrect class style ([2f65292](https://github.com/gdluxx/gdluxx/commit/2f65292816337d0aee044acf875fe238cc3e9173))
* modify extension/.release-it.json to include only extension/  directory ([1aa0752](https://github.com/gdluxx/gdluxx/commit/1aa075230ee8ecd3f05a49f26c1b35620971fa55))
* remove .js extensions from imports ([6c82589](https://github.com/gdluxx/gdluxx/commit/6c8258912896deafeecf54badb24635a5cb7e87b))


### Features

* accommodate new features of the browser extension ([331ad39](https://github.com/gdluxx/gdluxx/commit/331ad3979362c959e2462c0c6d84472e6321820e))
* add batch URL processing support to external API endpoint ([db2f094](https://github.com/gdluxx/gdluxx/commit/db2f094314c95c290237513794c11e99e467c20a))
* add file management controls to ConfigEditor ([cc5549c](https://github.com/gdluxx/gdluxx/commit/cc5549c00c9dce3a8384eab188a7508a9f8d79ad))
* added ability to full screen the config editor within the browser window ([93b1bef](https://github.com/gdluxx/gdluxx/commit/93b1befe56741ac6c1fc378c49e564c4b01285ff))
* **extension:** add overlay UI ([4bdf244](https://github.com/gdluxx/gdluxx/commit/4bdf2447559a0a1c13d272f462b7583b9ab4f4b0))
* implement theming system with multiple themes ([b3c3886](https://github.com/gdluxx/gdluxx/commit/b3c3886623b19e85d675297f15d5df79410d9db6))
* KeywordInfo component now utilizes user config file to accommodate potential custom extractors (`module-sources`) ([2f5ea3a](https://github.com/gdluxx/gdluxx/commit/2f5ea3ac2f223548de663296ac42b55cf1453e66))

## 1.1.1 (2025-08-14)


### Features

* add context menu to allow sending a single image link to the gdluxx API endpoint ([967194e](https://github.com/gdluxx/gdluxx/commit/967194e43f8826e4a10e2c9bda5329ecaeff7117))

# [1.1.0](https://github.com/gdluxx/gdluxx-browser/compare/0.0.0...v1.1.0) (2025-07-20)


### Bug Fixes

* `baseApiUrl` check was duplicated for https ([856ee31](https://github.com/gdluxx/gdluxx-browser/commit/856ee31dec415295becc6210bc71da3b2d452b73))
* adjust baseApiUrl checking ([49606fb](https://github.com/gdluxx/gdluxx-browser/commit/49606fb6c75e7d2e7679554d8aba45d3dad3860c))


### Features

* add context menu to allow sending a single image link to the gdluxx API endpoint ([967194e](https://github.com/gdluxx/gdluxx-browser/commit/967194e43f8826e4a10e2c9bda5329ecaeff7117))



# 0.0.0 (2025-07-09)
