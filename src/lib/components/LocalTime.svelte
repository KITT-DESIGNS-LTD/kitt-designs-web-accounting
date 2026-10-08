<script lang="ts">
	import { formatDateTime } from '$lib/invoice';

	let { iso }: { iso: string } = $props();

	// Formatted in the browser only, so the viewer's timezone is used.
	let text = $state('');
	$effect(() => {
		text = formatDateTime(iso);
	});
</script>

<time datetime={iso}>{text}</time>
