<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<nav class="home" aria-label="Accounting tools">
	<a class="tile" href={resolve('/receipt')}>
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
			<path d="M9 8h6M9 12h6" />
		</svg>
		<span class="name">Receipt</span>
		<span class="hint">Upload receipt photos</span>
	</a>
	<a class="tile" href={resolve('/invoice')}>
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<path d="M7 3h7l5 5v13H7z" />
			<path d="M14 3v5h5M10 13h6M10 17h6" />
		</svg>
		<span class="name">Invoice</span>
		<span class="hint">Create and sign an invoice</span>
	</a>
</nav>

<style>
	.home {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 1rem;
		max-width: 720px;
		margin: 8vh auto 0;
	}

	.tile {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
		padding: 2.25rem 1.5rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 14px;
		color: var(--ink);
		text-decoration: none;
		text-align: center;
		transition:
			border-color 0.15s,
			box-shadow 0.15s;
	}

	.tile:hover,
	.tile:focus-visible {
		border-color: var(--accent);
		box-shadow: 0 6px 20px rgb(17 24 39 / 0.08);
	}

	svg {
		width: 56px;
		height: 56px;
		fill: none;
		stroke: var(--accent);
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
		margin-bottom: 0.5rem;
	}

	.name {
		font-size: 1.35rem;
		font-weight: 700;
	}

	.hint {
		color: var(--muted);
	}
</style>
