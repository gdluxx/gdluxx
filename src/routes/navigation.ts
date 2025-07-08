/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

export interface NavigationItem {
  id: string;
  label: string;
  icon: string;
  href?: string;
  children?: NavigationItem[];
}

export const navItems: NavigationItem[] = [
  {
    id: 'home',
    label: 'Home',
    icon: `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M9.5 0a.5.5 0 0 0-.5.5v1.11a4.5 4.5 0 0 0-1.4.579l-.786-.786a.5.5 0 0 0-.707 0L5.4 2.11a.5.5 0 0 0 0 .707l.786.786a4.4 4.4 0 0 0-.579 1.4h-1.11a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1.11c.114.502.312.973.579 1.4l-.786.786a.5.5 0 0 0 0 .707l.707.707a.5.5 0 0 0 .707 0l.786-.786c.423.267.893.465 1.4.579v1.11a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1.11a4.5 4.5 0 0 0 1.4-.579l.786.786a.5.5 0 0 0 .707 0l.707-.707a.5.5 0 0 0 0-.707l-.786-.786c.266-.423.464-.893.578-1.4h1.11a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1.11a4.6 4.6 0 0 0-.578-1.4l.786-.786a.5.5 0 0 0 0-.707l-.707-.707a.5.5 0 0 0-.707 0l-.786.786A4.4 4.4 0 0 0 11 1.61V.5a.5.5 0 0 0-.5-.5zm.5 8a2 2 0 1 0 .001-4.001A2 2 0 0 0 10 8" clip-rule="evenodd" /><path fill="currentColor" fill-rule="evenodd" d="M2.08 9.3a.5.5 0 0 0-.271.653l.168.406a2.6 2.6 0 0 0-.623.623l-.407-.168a.5.5 0 0 0-.653.271l-.064.154a.5.5 0 0 0 .271.653l.407.168c-.049.287-.05.585 0 .881l-.407.168a.5.5 0 0 0-.271.653l.064.154a.5.5 0 0 0 .653.271l.407-.168c.174.245.385.455.623.623l-.168.407a.5.5 0 0 0 .27.653l.155.064a.5.5 0 0 0 .653-.271l.168-.407c.287.049.585.05.88 0l.169.407a.5.5 0 0 0 .653.271l.154-.064a.5.5 0 0 0 .27-.653l-.167-.406c.245-.174.455-.385.623-.623l.407.168a.5.5 0 0 0 .653-.27l.064-.155a.5.5 0 0 0-.271-.653l-.407-.168c.049-.287.05-.585 0-.88l.407-.169a.5.5 0 0 0 .27-.653l-.063-.154a.5.5 0 0 0-.653-.27l-.407.167a2.6 2.6 0 0 0-.623-.623l.168-.407a.5.5 0 0 0-.271-.653l-.154-.064a.5.5 0 0 0-.653.271l-.168.407a2.6 2.6 0 0 0-.881 0l-.168-.407a.5.5 0 0 0-.653-.27zM3.5 14a1.5 1.5 0 1 0-.001-3.001A1.5 1.5 0 0 0 3.5 14" clip-rule="evenodd" /></svg>`,
    href: '/',
  },
  {
    id: 'config',
    label: 'Configuration',
    icon: `<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 16v-1m3 1v-1m3 1v-1M6.835 4q-.747.022-1.297.242a1.86 1.86 0 0 0-.857.66q-.285.438-.285 1.164V9.23q0 1.12-.594 1.802q-.593.66-1.802.88v.131q1.23.22 1.802.901q.594.66.594 1.78v3.231q0 .704.285 1.143q.286.461.835.66q.55.219 1.32.241M17.164 4q.747.022 1.297.242q.55.219.857.66q.285.438.285 1.164V9.23q0 1.12.594 1.802q.593.66 1.802.88v.131q-1.23.22-1.802.901q-.594.66-.594 1.78v3.231q0 .704-.285 1.143q-.286.461-.835.66q-.55.219-1.32.241" /></svg>`,
    href: '/config',
  },
  {
    id: 'jobs',
    label: 'Jobs',
    icon: `<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" color="currentColor"><path d="M11.007 21.5H9.605c-3.585 0-5.377 0-6.491-1.135S2 17.403 2 13.75s0-5.48 1.114-6.615S6.02 6 9.605 6h3.803c3.585 0 5.378 0 6.492 1.135c.857.873 1.054 2.156 1.1 4.365V13" /><path d="M19 18.5h-3m0 3a3 3 0 1 1 0-6m3 6a3 3 0 1 0 0-6M16 6l-.1-.31c-.495-1.54-.742-2.31-1.331-2.75c-.59-.44-1.372-.44-2.938-.44h-.263c-1.565 0-2.348 0-2.937.44c-.59.44-.837 1.21-1.332 2.75L7 6" /></g></svg>`,
    href: '/jobs',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
      </svg>`,
    href: '/settings',
    children: [
      {
        id: 'version',
        label: 'Version Manager',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" fill-rule="evenodd"><path d="m12.593 23.258l-.011.002l-.071.035l-.02.004l-.014-.004l-.071-.035q-.016-.005-.024.005l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427q-.004-.016-.017-.018m.265-.113l-.013.002l-.185.093l-.01.01l-.003.011l.018.43l.005.012l.008.007l.201.093q.019.005.029-.008l.004-.014l-.034-.614q-.005-.018-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014l-.034.614q.001.018.017.024l.015-.002l.201-.093l.01-.008l.004-.011l.017-.43l-.003-.012l-.01-.01z" /><path fill="currentColor" fill-rule="nonzero" d="m12.935 2.878l7.181 3.796c1.066.563 1.066 2.09 0 2.652L18.842 10l1.274.674c1.066.563 1.066 2.09 0 2.652L18.842 14l1.274.674c1.066.563 1.066 2.09 0 2.652l-7.181 3.796a2 2 0 0 1-1.87 0l-7.181-3.796c-1.066-.563-1.066-2.089 0-2.652L5.159 14l-1.275-.674c-1.066-.563-1.066-2.089 0-2.652L5.159 10l-1.275-.674c-1.066-.563-1.066-2.089 0-2.652l7.181-3.796a2 2 0 0 1 1.87 0m3.767 12.253l-3.767 1.991a2 2 0 0 1-1.87 0l-3.767-1.99L5.655 16L12 19.354L18.346 16zm0-4l-3.767 1.992a2 2 0 0 1-1.707.076l-.163-.076l-3.767-1.992l-1.643.87L12 15.353L18.346 12zM12 4.646L5.655 8L12 11.354L18.346 8z" /></g></svg>`,
        href: '/settings/version',
      },
      {
        id: 'users',
        label: 'User Manager',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill="currentColor" d="M11 7c0 1.66-1.34 3-3 3S5 8.66 5 7s1.34-3 3-3s3 1.34 3 3"/><path fill="currentColor" fill-rule="evenodd" d="M16 8c0 4.42-3.58 8-8 8s-8-3.58-8-8s3.58-8 8-8s8 3.58 8 8M4 13.75C4.16 13.484 5.71 11 7.99 11c2.27 0 3.83 2.49 3.99 2.75A6.98 6.98 0 0 0 14.99 8c0-3.87-3.13-7-7-7s-7 3.13-7 7c0 2.38 1.19 4.49 3.01 5.75" clip-rule="evenodd"/></svg>`,
        href: '/settings/users',
      },
      {
        id: 'apikey',
        label: 'Key Manager',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>`,
        href: '/settings/apikey',
      },
      {
        id: 'debug',
        label: 'Debug Manager',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><g fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="4"><path d="M13 10h28v34H13z" /><path stroke-linecap="round" d="M35 10V4H8a1 1 0 0 0-1 1v33h6m8-16h12m-12 8h12" /></g></svg>`,
        href: '/settings/debug',
      },
    ],
  },
];
