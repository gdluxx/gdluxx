<script lang="ts">
  import type { IconName } from '$lib/types/icons.js';

  interface IconProps {
    iconName: IconName;
    size?: number;
    color?: string;
    ariaLabel?: string;
    class?: string;
  }

  const {
    iconName,
    size = 24,
    color = 'currentColor',
    ariaLabel = `${iconName} icon`,
    class: className = '',
  }: IconProps = $props();

  const spritePath = $state('/sprite.svg');

  // Special handling for loading icon
  // Animation wasn't working otherwise
  const isLoadingIcon = iconName === 'loading';
</script>

{#if isLoadingIcon}
  <!-- Render loading icon directly because it's special -->
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    role="img"
    aria-label={ariaLabel}
    class={`icon icon-${iconName} ${className}`}
  >
    <g fill="none" stroke={color} stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
      <path stroke-dasharray="16" stroke-dashoffset="16" d="M12 3c4.97 0 9 4.03 9 9">
        <animate fill="freeze" attributeName="stroke-dashoffset" dur="0.3s" values="16;0" />
        <animateTransform
          attributeName="transform"
          dur="1.5s"
          repeatCount="indefinite"
          type="rotate"
          values="0 12 12;360 12 12"
        />
      </path>
      <path
        stroke-dasharray="64"
        stroke-dashoffset="64"
        stroke-opacity="0.3"
        d="M12 3c4.97 0 9 4.03 9 9c0 4.97 -4.03 9 -9 9c-4.97 0 -9 -4.03 -9 -9c0 -4.97 4.03 -9 9 -9Z"
      >
        <animate fill="freeze" attributeName="stroke-dashoffset" dur="1.2s" values="64;0" />
      </path>
    </g>
  </svg>
{:else}
  <!-- And sprite for all other icons -->
  <svg
    width={size}
    height={size}
    fill={color}
    viewBox="0 0 24 24"
    role="img"
    aria-label={ariaLabel}
    class={`icon icon-${iconName} ${className}`}
  >
    <use href={`${spritePath}#${iconName}`} />
  </svg>
{/if}

<style>
  .icon {
    display: inline-block;
    vertical-align: middle;
    flex-shrink: 0;
  }
</style>
