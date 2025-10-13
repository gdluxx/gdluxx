<!--
  - Copyright (C) 2025 jsouthgb
  -
  - This file is part of gdluxx.
  -
  - gdluxx is free software; you can redistribute it and/or modify
  - it under the terms of the GNU General Public License version 2 (GPL-2.0),
  - as published by the Free Software Foundation.
  -->

<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  type BaseButtonVariant =
    | 'primary'
    | 'secondary'
    | 'accent'
    | 'neutral'
    | 'ghost'
    | 'link'
    | 'info'
    | 'success'
    | 'warning'
    | 'error';

  type OutlineButtonVariant = `${BaseButtonVariant}-outline`;

  type ButtonVariant = BaseButtonVariant | OutlineButtonVariant;

  type ButtonSize = 'lg' | 'md' | 'sm' | 'xs';

  interface ButtonProps extends Omit<HTMLButtonAttributes, 'type' | 'class'> {
    children?: Snippet;
    class?: string;
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    wide?: boolean;
    block?: boolean;
    outline?: boolean;
    circle?: boolean;
    square?: boolean;
    glass?: boolean;
  }

  const {
    children,
    class: className = '',
    type = 'button',
    disabled = false,
    variant = 'neutral',
    size = 'md',
    loading = false,
    wide = false,
    block = false,
    outline = false,
    circle = false,
    square = false,
    glass = false,
    ...restProps
  }: ButtonProps = $props();

  const resolvedVariant = $derived(() => {
    if (variant.endsWith('-outline')) {
      return variant.replace('-outline', '') as BaseButtonVariant;
    }
    return variant as BaseButtonVariant;
  });

  const isOutline = $derived(outline || variant.endsWith('-outline'));

  const classes = $derived(
    [
      'btn',
      `btn-${resolvedVariant()}`,
      `btn-${size}`,
      loading && 'loading',
      wide && 'btn-wide',
      block && 'btn-block',
      isOutline && 'btn-outline',
      circle && 'btn-circle',
      square && 'btn-square',
      glass && 'glass',
      className,
    ]
      .filter(Boolean)
      .join(' '),
  );
</script>

<button
  class={classes}
  {type}
  {disabled}
  {...restProps}
>
  {@render children?.()}
</button>
