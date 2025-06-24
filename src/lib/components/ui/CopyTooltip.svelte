<script lang="ts">
  export let x: number;
  export let y: number;
  export let visible: boolean;
  export let text: string;
</script>

{#if visible}
  <div class="tooltip" style:top="{y}px" style:left="{x}px">
    {text}
  </div>
{/if}

<style>
  .tooltip {
    position: fixed;
    background-color: #333;
    color: #fff;
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 0.85rem;
    pointer-events: none;
    transform: translate(-50%, -100%);
    white-space: nowrap;
    z-index: 1000;
    opacity: 0.9;
  }
</style>
