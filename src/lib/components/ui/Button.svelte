<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  type ButtonType = 'button' | 'submit' | 'reset';
  type ButtonSize = 'sm' | 'default' | 'lg';
  type ButtonVariant =
    | 'default'
    | 'primary'
    | 'secondary'
    | 'success'
    | 'warning'
    | 'danger'
    | 'info'
    | 'light'
    | 'dark'
    | 'outline-primary'
    | 'outline-secondary'
    | 'outline-success'
    | 'outline-warning'
    | 'outline-danger'
    | 'outline-info';

  interface ButtonProps extends Omit<HTMLButtonAttributes, 'type' | 'class'> {
    children?: Snippet;
    class?: string;
    type?: ButtonType;
    disabled?: boolean;
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    block?: boolean;
    pill?: boolean;
    square?: boolean;
    icon?: boolean;
    ariaLabel?: string;
  }

  const {
    children,
    class: className = '',
    type = 'button',
    disabled = false,
    variant = 'default',
    size = 'default',
    loading = false,
    block = false,
    pill = false,
    square = false,
    icon = false,
    ariaLabel = undefined,
    ...restProps
  }: ButtonProps = $props();

  const baseClasses = [
    'inline-flex',
    'items-center',
    'justify-center',
    'font-medium',
    'transition-all',
    'duration-150',
    'ease-in-out',
    'border',
    'focus:outline-hidden',
    'focus:ring-3',
    'whitespace-nowrap',
    'select-none',
    'cursor-pointer',
    'disabled:opacity-60',
    'disabled:cursor-not-allowed',
    'hover:enabled:-translate-y-0.5',
    'hover:enabled:shadow-sm',
    'active:enabled:translate-y-0',
    'active:enabled:shadow-xs',
  ];

  const sizeClasses: Record<ButtonSize, string[]> = {
    sm: [
      icon ? 'p-1' : 'px-3 py-1',
      'text-sm',
      square ? 'rounded-none' : pill ? 'rounded-full' : 'rounded-xs',
    ],
    default: [
      icon ? 'p-2' : 'px-4 py-2',
      'text-base',
      square ? 'rounded-none' : pill ? 'rounded-full' : 'rounded-sm',
    ],
    lg: [
      icon ? 'p-3' : 'px-6 py-3',
      'text-lg',
      square ? 'rounded-none' : pill ? 'rounded-full' : 'rounded-sm',
    ],
  };

  const variantClasses: Record<ButtonVariant, string[]> = {
    default: [
      'bg-secondary-200',
      'text-secondary-900',
      'border-transparent',
      'hover:enabled:bg-secondary-300',
      'focus:ring-secondary-300',
      'dark:bg-secondary-700',
      'dark:text-secondary-100',
      'dark:hover:enabled:bg-secondary-600',
      'dark:focus:ring-secondary-400',
    ],
    primary: [
      'bg-primary-600',
      'text-white',
      'border-primary-600',
      'hover:enabled:bg-primary-700',
      'hover:enabled:border-primary-700',
      'focus:ring-primary-300',
      'dark:bg-primary-500',
      'dark:hover:enabled:bg-primary-400',
      'dark:focus:ring-primary-600',
    ],
    secondary: [
      'bg-secondary-600',
      'text-white',
      'border-secondary-600',
      'hover:enabled:bg-secondary-700',
      'hover:enabled:border-secondary-700',
      'focus:ring-secondary-300',
      'dark:bg-secondary-500',
      'dark:hover:enabled:bg-secondary-400',
      'dark:focus:ring-secondary-600',
    ],
    success: [
      'bg-success-500',
      'text-white',
      'border-success-500',
      'hover:enabled:bg-success-750',
      'hover:enabled:border-success-750',
      'focus:ring-success-250',
    ],
    warning: [
      'bg-warning-500',
      'text-white',
      'border-warning-500',
      'hover:enabled:bg-warning-750',
      'hover:enabled:border-warning-750',
      'focus:ring-warning-250',
    ],
    danger: [
      'bg-error-500',
      'text-white',
      'border-error-500',
      'hover:enabled:bg-error-750',
      'hover:enabled:border-error-750',
      'focus:ring-error-250',
    ],
    info: [
      'bg-info-500',
      'text-white',
      'border-info-500',
      'hover:enabled:bg-info-750',
      'hover:enabled:border-info-750',
      'focus:ring-info-250',
    ],
    light: [
      'bg-secondary-50',
      'text-secondary-900',
      'border-secondary-200',
      'hover:enabled:bg-secondary-100',
      'hover:enabled:border-secondary-300',
      'focus:ring-secondary-300',
      'dark:bg-secondary-800',
      'dark:text-secondary-100',
      'dark:border-secondary-700',
      'dark:hover:enabled:bg-secondary-700',
      'dark:focus:ring-secondary-400',
    ],
    dark: [
      'bg-secondary-900',
      'text-white',
      'border-secondary-900',
      'hover:enabled:bg-black',
      'hover:enabled:border-black',
      'focus:ring-secondary-400',
      'dark:bg-secondary-200',
      'dark:text-secondary-900',
      'dark:hover:enabled:bg-secondary-100',
      'dark:focus:ring-secondary-600',
    ],
    'outline-primary': [
      'bg-transparent',
      'text-primary-700',
      'border-primary-600',
      'hover:enabled:bg-primary-600',
      'hover:enabled:text-white',
      'focus:ring-primary-300',
      'dark:text-primary-300',
      'dark:border-primary-400',
      'dark:hover:enabled:bg-primary-400',
      'dark:hover:enabled:text-secondary-900',
    ],
    'outline-secondary': [
      'bg-transparent',
      'text-secondary-700',
      'border-secondary-600',
      'hover:enabled:bg-secondary-600',
      'hover:enabled:text-white',
      'focus:ring-secondary-300',
      'dark:text-secondary-300',
      'dark:border-secondary-400',
      'dark:hover:enabled:bg-secondary-400',
      'dark:hover:enabled:text-secondary-900',
    ],
    'outline-success': [
      'bg-transparent',
      'text-success-750',
      'border-success-500',
      'hover:enabled:bg-success-500',
      'hover:enabled:text-white',
      'focus:ring-success-250',
    ],
    'outline-warning': [
      'bg-transparent',
      'text-warning-750',
      'border-warning-500',
      'hover:enabled:bg-warning-500',
      'hover:enabled:text-white',
      'focus:ring-warning-250',
    ],
    'outline-danger': [
      'bg-transparent',
      'text-error-750',
      'border-error-500',
      'hover:enabled:bg-error-500',
      'hover:enabled:text-white',
      'focus:ring-error-250',
    ],
    'outline-info': [
      'bg-transparent',
      'text-info-750',
      'border-info-500',
      'hover:enabled:bg-info-500',
      'hover:enabled:text-white',
      'focus:ring-info-250',
    ],
  };

  const computedClasses = $derived(
    [
      ...baseClasses,
      ...sizeClasses[size],
      ...variantClasses[variant],
      block && 'flex w-full',
      loading && 'relative text-transparent pointer-events-none',
      className,
    ]
      .filter(Boolean)
      .join(' ')
  );

  const ariaAttributes = $derived<Record<string, string | undefined>>({
    'aria-label': ariaLabel,
    'aria-disabled': disabled || loading ? 'true' : undefined,
    'aria-busy': loading ? 'true' : undefined,
    role: type === 'button' ? undefined : 'button',
  });

  // Screen reader text for loading state
  const loadingText = $derived(loading ? 'Loading' : '');
</script>

<button
  class={computedClasses}
  {type}
  disabled={disabled || loading}
  {...ariaAttributes}
  {...restProps}
>
  {@render children?.()}

  <!-- Screen reader loading announcement -->
  {#if loading}
    <span class="sr-only">{loadingText}</span>
  {/if}

  <!-- Loading spinner -->
  {#if loading}
    <div class="absolute inset-0 flex items-center justify-center" aria-hidden="true">
      <div
        class="w-4 h-4 border-2 border-secondary-300 border-t-primary-600 rounded-full animate-spin dark:border-secondary-600 dark:border-t-primary-400"
        role="status"
        aria-label="Loading"
      ></div>
    </div>
  {/if}
</button>
