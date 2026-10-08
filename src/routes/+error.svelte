<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
</script>

<div class="card error-page">
	<h1 class="page-title">
		{page.status === 410 ? 'Link expired' : page.status === 404 ? 'Not found' : 'Something went wrong'}
	</h1>
	<p class="muted">{page.error?.message}</p>
	<p><a class="btn" href={resolve('/')}>Back to start</a></p>
</div>

<style>
	.error-page {
		max-width: 520px;
		margin: 8vh auto 0;
		text-align: center;
		display: grid;
		gap: 0.75rem;
		justify-items: center;
	}
</style>
