<script lang="ts">
  interface Props {
    user?;
  }

  const { user }: Props = $props();
</script>

<div class="space-y-6">
  <div class="cursor-default">
    <div class="px-4 py-2 sm:p-2">
      <div
        class="overflow-y-auto shadow ring-1 ring-primary-600 dark:ring-primary-400 ring-opacity-5 rounded-sm"
      >
        <table class="min-w-full divide-y divide-secondary-300 dark:divide-secondary-600">
          <thead class="bg-primary-50 dark:bg-primary-700">
            <tr>
              <th
                scope="col"
                class="px-6 py-3 text-left text-xs font-medium text-secondary-700 dark:text-secondary-300 uppercase tracking-wider"
              >
                Username
              </th>
              <th
                scope="col"
                class="px-6 py-3 text-left text-xs font-medium text-secondary-700 dark:text-secondary-300 uppercase tracking-wider"
              >
                Email
              </th>
              <th
                scope="col"
                class="px-6 py-3 text-left text-xs font-medium text-secondary-700 dark:text-secondary-300 uppercase tracking-wider"
              >
                Created
              </th>
              <th
                scope="col"
                class="px-6 py-3 text-left text-xs font-medium text-secondary-700 dark:text-secondary-300 uppercase tracking-wider"
              >
                Status
              </th>
              <th scope="col" class="relative px-6 py-3">
                <span class="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody
            class="bg-primary-100 dark:bg-primary-900 divide-y divide-secondary-200 dark:divide-secondary-700"
          >
            <tr>
              <td
                class="px-6 py-4 whitespace-nowrap text-sm font-medium text-secondary-900 dark:text-secondary-100"
              >
                {user.name}
              </td>
              <td
                class="px-6 py-4 whitespace-nowrap text-sm text-secondary-900 dark:text-secondary-100"
              >
                {user.email}
              </td>
              <td
                class="px-6 py-4 whitespace-nowrap text-sm text-secondary-900 dark:text-secondary-100"
              >
                {new Date(user.createdAt).toLocaleDateString()}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span
                  class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100"
                >
                  Active
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"> </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>
