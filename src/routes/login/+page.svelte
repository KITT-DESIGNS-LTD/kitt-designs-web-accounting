<script lang="ts">
	let { form } = $props();
</script>

<svelte:head>
	<title>Sign in</title>
</svelte:head>

<h1 class="page-title">Staff sign in</h1>

<form method="POST" class="login">
	<label>
		Password
		<!-- svelte-ignore a11y_autofocus -->
		<input type="password" name="password" autocomplete="current-password" required autofocus />
	</label>
	{#if form?.wrong}
		<p class="error" role="alert">That password is not right.</p>
	{/if}
	<button type="submit" class="btn">Sign in</button>
</form>

<style>
	.login {
		display: grid;
		gap: 0.9rem;
		max-width: 22rem;
	}

	label {
		display: grid;
		gap: 0.35rem;
		font-weight: 600;
	}

	input {
		font: inherit;
		padding: 0.6rem 0.7rem;
		border: 1px solid var(--border);
		border-radius: 8px;
	}

	.error {
		color: #b42318;
		margin: 0;
	}
</style>
