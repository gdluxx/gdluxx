import { defineConfig } from 'vitepress';

export default defineConfig({
  lang: 'en-US',
  title: 'gdluxx',
  description: 'A self-hosted browser based gui for gallery-dl',

  head: [['link', { rel: 'icon', href: '/favicon.ico' }]],

  themeConfig: {
    search: { provider: 'local' },
    socialLinks: [{ icon: 'github', link: 'https://github.com/gdluxx/gdluxx' }],
    logo: '/gdl-ico.png',

    // nav: [
    //   { text: 'Home', link: '/' },
    //   { text: 'Guide', link: '/getting-started/introduction' },
    // ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Installation', link: '/getting-started/installation' },
          { text: 'First Run Setup', link: '/getting-started/first-run' },
        ],
      },
      {
        text: 'User Guide',
        items: [
          { text: 'The Run Page', link: '/user-guide/run-page' },
          { text: 'The Jobs List', link: '/user-guide/jobs-page' },
          { text: 'The Config Editor', link: '/user-guide/config-page' },
          { text: 'The App Settings', link: '/user-guide/settings-page' },
        ],
      },
      {
        text: 'Advanced Usage',
        items: [
          { text: 'Browser Extension', link: '/advanced/browser-extension' },
          { text: 'Using the API', link: '/advanced/api-usage' },
          { text: 'Reverse Proxy Guide', link: '/advanced/reverse-proxy' },
        ],
      },
      {
        text: 'Troubleshooting',
        items: [
          { text: 'Common Errors', link: '/troubleshooting/common-errors' },
          { text: 'FAQ', link: '/troubleshooting/faq' },
        ],
      },
    ],

    lastUpdated: {
      text: 'Last Updated:',
      formatOptions: {
        dateStyle: 'full',
        timeStyle: 'medium',
      },
    },

    footer: {
      message: 'Released under the GPL-2.0 License.',
      copyright: 'Copyright © 2025 jsouthgb',
    },
  },
});
