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
  import { Modal } from '#components/ui';

  interface HelpModalsProps {
    showSelectorHelp: boolean;
    showScopeHelp: boolean;
    showSubRegexHelp?: boolean;
    oncloseselector?: () => void;
    onclosescope?: () => void;
    onclosesubregex?: () => void;
  }

  const {
    showSelectorHelp,
    showScopeHelp,
    showSubRegexHelp = false,
    oncloseselector,
    onclosescope,
    onclosesubregex,
  }: HelpModalsProps = $props();

  function handleCloseSelector(): void {
    oncloseselector?.();
  }

  function handleCloseScope(): void {
    onclosescope?.();
  }

  function handleCloseRegex(): void {
    onclosesubregex?.();
  }
</script>

<Modal
  show={showSelectorHelp}
  title="CSS Selector Guide"
  size="lg"
  onClose={handleCloseSelector}
>
  <div class="prose-sm prose max-w-none">
    <p class="text-base-content/80 mb-4">
      CSS selectors help you target specific parts of a webpage to extract only the content you
      want.
    </p>

    <div class="space-y-6">
      <div>
        <h3 class="text-base-content mb-2 flex items-center gap-2 text-lg font-semibold">
          ID Selectors
          <div class="badge badge-sm badge-primary">#</div>
        </h3>
        <div class="bg-base-200 mb-2 rounded-lg p-3">
          <p><strong>Format:</strong> <code class="bg-base-300 rounded px-1">#name</code></p>
          <p>
            <strong>Targets:</strong> Elements with
            <code class="bg-base-300 rounded px-1">id="name"</code>
          </p>
          <p>
            <strong>Example:</strong> <code class="bg-base-300 rounded px-1">#content</code> finds
            <code class="bg-base-300 rounded px-1">&lt;div id="content"&gt;</code>
          </p>
          <p><strong>Best for:</strong> Main page sections (header, content, sidebar, footer)</p>
        </div>
      </div>

      <div>
        <h3 class="text-base-content mb-2 flex items-center gap-2 text-lg font-semibold">
          ️ Class Selectors
          <div class="badge badge-sm badge-secondary">.</div>
        </h3>
        <div class="bg-base-200 mb-2 rounded-lg p-3">
          <p><strong>Format:</strong> <code class="bg-base-300 rounded px-1">.name</code></p>
          <p>
            <strong>Targets:</strong> Elements with
            <code class="bg-base-300 rounded px-1">class="name"</code>
          </p>
          <p>
            <strong>Example:</strong> <code class="bg-base-300 rounded px-1">.post</code> finds
            <code class="bg-base-300 rounded px-1">&lt;div class="post"&gt;</code>
          </p>
          <p><strong>Best for:</strong> Repeated content (posts, articles, images, cards)</p>
        </div>
      </div>

      <div>
        <h3 class="text-base-content mb-2 flex items-center gap-2 text-lg font-semibold">
          ️ Tag Selectors
          <div class="badge badge-sm badge-accent">tag</div>
        </h3>
        <div class="bg-base-200 mb-2 rounded-lg p-3">
          <p><strong>Format:</strong> <code class="bg-base-300 rounded px-1">tagname</code></p>
          <p><strong>Targets:</strong> HTML elements by their tag</p>
          <p>
            <strong>Example:</strong> <code class="bg-base-300 rounded px-1">article</code> finds
            <code class="bg-base-300 rounded px-1">&lt;article&gt;</code> tags
          </p>
          <p><strong>Best for:</strong> Semantic HTML elements (main, section, article, nav)</p>
        </div>
      </div>

      <div>
        <h3 class="text-base-content mb-2 text-lg font-semibold">How to Find Selectors:</h3>
        <div class="border-info/20 bg-info/10 rounded-lg border p-3">
          <ol class="list-inside list-decimal space-y-1 text-sm">
            <li><strong>Right-click</strong> on the content you want to extract</li>
            <li>Choose <strong>"Inspect Element"</strong> or <strong>"Inspect"</strong></li>
            <li>Look at the highlighted HTML:</li>
            <ul class="mt-1 ml-4 list-inside list-disc space-y-1">
              <li>
                <code class="bg-base-300 rounded px-1">id="something"</code> → use
                <code class="bg-base-300 rounded px-1">#something</code>
              </li>
              <li>
                <code class="bg-base-300 rounded px-1">class="something"</code> → use
                <code class="bg-base-300 rounded px-1">.something</code>
              </li>
              <li>
                <code class="bg-base-300 rounded px-1">&lt;tagname&gt;</code> → use
                <code class="bg-base-300 rounded px-1">tagname</code>
              </li>
            </ul>
          </ol>
        </div>
      </div>

      <div>
        <h3 class="text-base-content mb-2 text-lg font-semibold">Examples:</h3>
        <div class="space-y-3">
          <div class="border-success/20 bg-success/10 rounded-lg border p-3">
            <p class="font-medium">Extract main content area:</p>
            <p>
              <strong>Start:</strong> <code class="bg-base-300 rounded px-1">#content</code>
              <strong>End:</strong> <code class="bg-base-300 rounded px-1">#footer</code>
            </p>
          </div>
          <div class="border-success/20 bg-success/10 rounded-lg border p-3">
            <p class="font-medium">Extract blog posts only:</p>
            <p>
              <strong>Start:</strong> <code class="bg-base-300 rounded px-1">.post</code>
              <strong>End:</strong> <code class="bg-base-300 rounded px-1">.sidebar</code>
            </p>
          </div>
          <div class="border-success/20 bg-success/10 rounded-lg border p-3">
            <p class="font-medium">Extract article content:</p>
            <p>
              <strong>Start:</strong> <code class="bg-base-300 rounded px-1">article</code>
              <strong>End:</strong> <code class="bg-base-300 rounded px-1">nav</code>
            </p>
          </div>
        </div>
      </div>

      <div>
        <h3 class="text-base-content mb-2 text-lg font-semibold">Tips:</h3>
        <div class="border-warning/20 bg-warning/10 rounded-lg border p-3">
          <ul class="list-inside list-disc space-y-1 text-sm">
            <li><strong>Leave empty</strong> to scan the entire page</li>
            <li><strong>Start only</strong> extracts from that point to the end</li>
            <li><strong>End only</strong> extracts from the beginning to that point</li>
            <li><strong>Both</strong> extracts only content between the two selectors</li>
          </ul>
        </div>
      </div>
    </div>
  </div>

  {#snippet actions()}
    <button
      class="btn btn-primary"
      onclick={handleCloseSelector}
    >
      Got it!
    </button>
  {/snippet}
</Modal>

<Modal
  show={showScopeHelp}
  title="Scope Guide"
  size="lg"
  onClose={handleCloseScope}
>
  <div class="prose-sm prose max-w-none">
    <p class="text-base-content/80 mb-4">
      Scope determines how specific your saved selector ranges are. Choose the level that best
      matches how you want to reuse your selectors.
    </p>

    <div class="space-y-6">
      <div>
        <h3 class="text-base-content mb-2 flex items-center gap-2 text-lg font-semibold">
          Host
          <div class="badge badge-sm badge-primary">example.com</div>
        </h3>
        <div class="bg-base-200 mb-2 rounded-lg p-3">
          <p><strong>Applies to:</strong> Entire website (all pages on the main domain)</p>
          <p>
            <strong>Example:</strong>
            <code class="bg-base-300 rounded px-1">https://example.com/*</code>
          </p>
          <p><strong>URLs matched:</strong></p>
          <ul class="mt-1 ml-4 list-inside list-disc space-y-1 text-sm">
            <li><code class="bg-base-300 rounded px-1">https://example.com/gallery</code> ✅</li>
            <li><code class="bg-base-300 rounded px-1">https://example.com/post/123</code> ✅</li>
            <li><code class="bg-base-300 rounded px-1">https://blog.example.com/</code> ❌</li>
          </ul>
          <p class="mt-2">
            <strong>Best for:</strong> Sites with consistent layout across all pages
          </p>
        </div>
      </div>

      <div>
        <h3 class="text-base-content mb-2 flex items-center gap-2 text-lg font-semibold">
          Origin
          <div class="badge badge-sm badge-secondary">sub.example.com</div>
        </h3>
        <div class="bg-base-200 mb-2 rounded-lg p-3">
          <p><strong>Applies to:</strong> Specific subdomain or protocol variations</p>
          <p>
            <strong>Example:</strong>
            <code class="bg-base-300 rounded px-1">https://images.example.com/*</code>
          </p>
          <p><strong>URLs matched:</strong></p>
          <ul class="mt-1 ml-4 list-inside list-disc space-y-1 text-sm">
            <li>
              <code class="bg-base-300 rounded px-1">https://images.example.com/gallery</code> ✅
            </li>
            <li>
              <code class="bg-base-300 rounded px-1">https://images.example.com/post/123</code> ✅
            </li>
            <li><code class="bg-base-300 rounded px-1">https://example.com/gallery</code> ❌</li>
          </ul>
          <p class="mt-2"><strong>Best for:</strong> Subdomains or protocol-specific layouts</p>
        </div>
      </div>

      <div>
        <h3 class="text-base-content mb-2 flex items-center gap-2 text-lg font-semibold">
          Path
          <div class="badge badge-sm badge-accent">/specific/path</div>
        </h3>
        <div class="bg-base-200 mb-2 rounded-lg p-3">
          <p><strong>Applies to:</strong> Exact URL path only</p>
          <p>
            <strong>Example:</strong>
            <code class="bg-base-300 rounded px-1">https://example.com/blog/posts</code>
          </p>
          <p><strong>URLs matched:</strong></p>
          <ul class="mt-1 ml-4 list-inside list-disc space-y-1 text-sm">
            <li>
              <code class="bg-base-300 rounded px-1">https://example.com/blog/posts</code> ✅
            </li>
            <li>
              <code class="bg-base-300 rounded px-1">https://example.com/blog/categories</code> ❌
            </li>
            <li>
              <code class="bg-base-300 rounded px-1">https://example.com/news/posts</code> ❌
            </li>
          </ul>
          <p class="mt-2">
            <strong>Best for:</strong> Sites where different sections have different layouts
          </p>
        </div>
      </div>

      <div>
        <h3 class="text-base-content mb-2 text-lg font-semibold">Scope Comparison:</h3>
        <div class="overflow-x-auto">
          <table class="table-zebra table-sm table">
            <thead>
              <tr>
                <th>Scope</th>
                <th>Specificity</th>
                <th>Reusability</th>
                <th>Use Case</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span class="badge badge-sm badge-primary">Host</span></td>
                <td>Broad</td>
                <td>High</td>
                <td>Consistent site-wide layout</td>
              </tr>
              <tr>
                <td><span class="badge badge-sm badge-secondary">Origin</span></td>
                <td>Medium</td>
                <td>Medium</td>
                <td>Different subdomains</td>
              </tr>
              <tr>
                <td><span class="badge badge-sm badge-accent">Path</span></td>
                <td>Narrow</td>
                <td>Low</td>
                <td>Section-specific layout</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 class="text-base-content mb-2 text-lg font-semibold">Examples:</h3>
        <div class="space-y-3">
          <div class="border-success/20 bg-success/10 rounded-lg border p-3">
            <p class="font-medium">A website with consistent layout:</p>
            <p>
              <strong>Recommended:</strong> <span class="badge badge-sm badge-primary">Host</span>
              - Works on all and pages
            </p>
          </div>
          <div class="border-info/20 bg-info/10 rounded-lg border p-3">
            <p class="font-medium">Reddit (old.reddit.com vs www.reddit.com):</p>
            <p>
              <strong>Recommended:</strong>
              <span class="badge badge-sm badge-secondary">Origin</span> - Different layouts will require
              different selectors
            </p>
          </div>
          <div class="border-warning/20 bg-warning/10 rounded-lg border p-3">
            <p class="font-medium">Other sites (image pages vs gallery pages):</p>
            <p>
              <strong>Recommended:</strong> <span class="badge badge-sm badge-accent">Path</span> - Each
              section has unique layout
            </p>
          </div>
        </div>
      </div>

      <div>
        <h3 class="text-base-content mb-2 text-lg font-semibold">Tips:</h3>
        <div class="border-info/20 bg-info/10 rounded-lg border p-3">
          <ul class="list-inside list-disc space-y-1 text-sm">
            <li><strong>Start broad:</strong> Try Host scope first, narrow down if needed</li>
            <li>
              <strong>Test different pages:</strong> Check if your selectors work across the site
            </li>
            <li>
              <strong>Multiple scopes:</strong> Save different selectors for different sections
            </li>
            <li><strong>Override when needed:</strong> More specific scopes take priority</li>
          </ul>
        </div>
      </div>
    </div>
  </div>

  {#snippet actions()}
    <button
      class="btn btn-primary"
      onclick={handleCloseScope}
    >
      Got it!
    </button>
  {/snippet}
</Modal>

<Modal
  show={showSubRegexHelp}
  title="Regex Substitution Guide"
  size="lg"
  onClose={handleCloseRegex}
>
  <div class="prose-sm prose max-w-none">
    <p class="text-base-content/80 mb-4">
      Regular expressions let you transform URLs using pattern matching. Rules run from top to
      bottom and support capture groups for substitutions. You're not limited to the examples below.
    </p>

    <div class="space-y-5">
      <section>
        <h3 class="text-base-content mb-2 text-lg font-semibold">Common Patterns</h3>
        <div class="bg-base-200 rounded-lg p-3">
          <ul class="list-inside list-disc space-y-2 text-sm">
            <li>
              <code class="!bg-primary/20 !text-base-content !rounded-sm px-1">https?://</code> →
              matches either
              <code class="!bg-primary/20 !text-base-content !rounded-sm px-1">http://</code>
              or <code class="!bg-primary/20 !text-base-content !rounded-sm px-1">https://</code>
            </li>
            <li>
              <code class="!bg-primary/20 !text-base-content !rounded-sm px-1">(\\d+)</code> →
              capture one or more digits (use
              <code class="!bg-primary/20 !text-base-content !rounded-sm px-1">$1</code> in the substitution)
            </li>
            <li>
              <code class="!bg-primary/20 !text-base-content !rounded-sm px-1">[a-z]+</code> → match
              one or more lowercase letters
            </li>
          </ul>
        </div>
      </section>

      <section>
        <h3 class="text-base-content mb-2 text-lg font-semibold">Example Substitutions</h3>
        <div class="space-y-3">
          <div class="border-success/20 bg-success/10 rounded-lg border p-3">
            <p class="font-medium">Force HTTPS</p>
            <p>
              Pattern: <code class="!bg-primary/20 !text-base-content !rounded-sm px-1"
                >^http://</code
              ><br />
              Replacement:
              <code class="!bg-primary/20 !text-base-content !rounded-sm px-1">https://</code>
            </p>
          </div>
          <div class="border-success/20 bg-success/10 rounded-lg border p-3">
            <p class="font-medium">Swap subdomains</p>
            <p>
              Pattern: <code class="!bg-primary/20 !text-base-content !rounded-sm px-1"
                >https://media\.example\.com/(.*)</code
              ><br />
              Replacement:
              <code class="!bg-primary/20 !text-base-content !rounded-sm px-1"
                >https://cdn.example.com/$1</code
              >
            </p>
          </div>
          <div class="border-success/20 bg-success/10 rounded-lg border p-3">
            <p class="font-medium">Add zero padding</p>
            <p>
              Pattern: <code class="!bg-primary/20 !text-base-content !rounded-sm px-1"
                >episode-(\\d)</code
              ><br />
              Replacement:
              <code class="!bg-primary/20 !text-base-content !rounded-sm px-1">episode-0$1</code>
            </p>
          </div>
        </div>
      </section>

      <section>
        <h3 class="text-base-content mb-2 text-lg font-semibold">Flags</h3>
        <div class="bg-base-200 rounded-lg p-3 text-sm">
          <ul class="list-inside list-disc space-y-1">
            <li>
              <code class="!bg-primary/20 !text-base-content !rounded-sm px-1">g</code> — Replace
              <strong>all</strong> matches (enabled by default)
            </li>
            <li>
              <code class="!bg-primary/20 !text-base-content !rounded-sm px-1">i</code> —
              Case-insensitive matching (treat
              <code class="!bg-primary/20 !text-base-content !rounded-sm px-1">A</code>
              and <code class="!bg-primary/20 !text-base-content !rounded-sm px-1">a</code> equally)
            </li>
          </ul>
        </div>
      </section>

      <section>
        <h3 class="text-base-content mb-2 text-lg font-semibold">Tips</h3>
        <div class="border-info/20 bg-info/10 rounded-lg border p-3 text-sm">
          <ul class="list-inside list-disc space-y-1">
            <li>Test your pattern on a sample URL before applying to all items.</li>
            <li>
              Use parentheses to capture parts you want to reuse in the substitution (<code
                class="!bg-primary/20 !text-base-content !rounded-sm px-1">$1</code
              >, <code class="!bg-primary/20 !text-base-content !rounded-sm px-1">$2</code>, ...).
            </li>
            <li>Combine multiple rules to apply transformations step by step.</li>
          </ul>
        </div>
      </section>
    </div>
  </div>

  {#snippet actions()}
    <a
      class="btn btn-ghost"
      href="https://developer.mozilla.org/docs/Web/JavaScript/Guide/Regular_expressions/Cheatsheet"
      target="_blank"
      rel="noopener noreferrer"
    >
      MDN regex cheatsheet
    </a>
    <button
      class="btn btn-primary"
      onclick={handleCloseRegex}
    >
      Got it!
    </button>
  {/snippet}
</Modal>
