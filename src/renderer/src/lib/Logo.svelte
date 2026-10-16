<script lang="ts">
  let { class: className = "" }: { class?: string } = $props()
  const id = $props.id()
</script>

<svg viewBox="64 64 896 896" class={className} aria-hidden="true">
  <defs>
    <linearGradient id="{id}-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f766e" />
      <stop offset="1" stop-color="#16a34a" />
    </linearGradient>
  </defs>
  <rect x="64" y="64" width="896" height="896" rx="200" fill="url(#{id}-bg)" />
  <circle cx="470" cy="470" r="220" stroke="#fff" stroke-width="96" fill="none" />
  <path d="M600 600 L770 770" stroke="#fff" stroke-width="96" stroke-linecap="round" />
  <path
    d="M370 470 L445 545 L585 400"
    stroke="#fde047"
    stroke-width="64"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="none"
  />
</svg>
