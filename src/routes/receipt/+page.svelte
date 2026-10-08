<script lang="ts">
	import { resolve } from '$app/paths';
	import { MAX_UPLOAD_BYTES, shrinkImage } from '$lib/shrink-image';
	import CameraCapture from '$lib/components/CameraCapture.svelte';

	interface Item {
		id: number;
		file: File;
		previewUrl: string;
		status: 'ready' | 'uploading' | 'done' | 'error';
		/** The saved file name when done, the reason when failed. */
		message: string;
	}

	let items = $state<Item[]>([]);
	let label = $state('');
	let notice = $state('');
	let uploading = $state(false);
	let cameraOpen = $state(false);
	let dragDepth = $state(0);
	let fileInput = $state<HTMLInputElement>();
	let cameraInput = $state<HTMLInputElement>();
	let nextId = 0;

	const pending = $derived(items.filter((item) => item.status === 'ready' || item.status === 'error'));
	const finished = $derived(items.filter((item) => item.status === 'done'));

	function add(files: Iterable<File>) {
		let skipped = 0;
		for (const file of files) {
			if (!file.type.startsWith('image/')) {
				skipped += 1;
				continue;
			}
			items.push({
				id: nextId++,
				file,
				previewUrl: URL.createObjectURL(file),
				status: 'ready',
				message: ''
			});
		}
		notice = skipped ? `${skipped} file${skipped > 1 ? 's were' : ' was'} skipped: only images can be uploaded.` : '';
	}

	function remove(item: Item) {
		URL.revokeObjectURL(item.previewUrl);
		items = items.filter((other) => other.id !== item.id);
	}

	function onPicked(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		add(input.files ?? []);
		input.value = ''; // allow picking the same file again
	}

	function takePhoto() {
		// Phones and tablets open their own camera app through the capture input;
		// elsewhere we show a live webcam preview (mediaDevices needs HTTPS).
		const touchDevice = matchMedia('(pointer: coarse)').matches;
		if (!touchDevice && 'mediaDevices' in navigator) cameraOpen = true;
		else cameraInput?.click();
	}

	function hasFiles(event: DragEvent) {
		return event.dataTransfer?.types.includes('Files') ?? false;
	}

	function onDrop(event: DragEvent) {
		if (!hasFiles(event)) return;
		event.preventDefault();
		dragDepth = 0;
		add(event.dataTransfer?.files ?? []);
	}

	async function uploadAll() {
		const batch = pending;
		uploading = true;
		for (const [index, item] of batch.entries()) {
			item.status = 'uploading';
			try {
				const file = await shrinkImage(item.file);
				if (file.size > MAX_UPLOAD_BYTES) throw new Error('This image is too large (over 4 MB). Try a JPEG.');
				const body = new FormData();
				body.set('file', file);
				body.set('label', label);
				if (batch.length > 1) body.set('sequence', String(index + 1));
				const response = await fetch(resolve('/api/receipts'), { method: 'POST', body });
				const result = await response.json().catch(() => ({}));
				if (!response.ok) throw new Error(result.message || 'Upload failed.');
				item.status = 'done';
				item.message = result.name;
			} catch (err) {
				item.status = 'error';
				item.message = err instanceof TypeError ? 'No connection. Try again.' : (err as Error).message;
			}
		}
		uploading = false;
	}
</script>

<svelte:head>
	<title>Upload receipts</title>
</svelte:head>

<svelte:window
	ondragenter={(event) => hasFiles(event) && (dragDepth += 1)}
	ondragleave={(event) => hasFiles(event) && (dragDepth = Math.max(0, dragDepth - 1))}
	ondragover={(event) => hasFiles(event) && event.preventDefault()}
	ondrop={onDrop}
/>

<h1 class="page-title">Upload receipts</h1>

<!-- Desktop gets a drop target; touch devices (phones, tablets) can't drag files,
     so they get two big tap targets instead. Switched in CSS to avoid a flash on load. -->
<div class="dropzone" class:dragging={dragDepth > 0}>
	<p class="drop-hint">Drag and drop receipt photos here</p>
	<div class="actions">
		<button type="button" class="btn" onclick={takePhoto}>Take a photo</button>
		<button type="button" class="btn" onclick={() => fileInput?.click()}>Choose files</button>
	</div>
</div>

<div class="touch-picker">
	<button type="button" class="tile primary" onclick={takePhoto}>
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
			<circle cx="12" cy="13.5" r="3.5" />
		</svg>
		Take photo
	</button>
	<button type="button" class="tile" onclick={() => fileInput?.click()}>
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M4 14v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" />
		</svg>
		Upload files
	</button>
</div>

<input
	bind:this={fileInput}
	class="visually-hidden"
	type="file"
	accept="image/*"
	multiple
	tabindex="-1"
	aria-hidden="true"
	onchange={onPicked}
/>
<input
	bind:this={cameraInput}
	class="visually-hidden"
	type="file"
	accept="image/*"
	capture="environment"
	tabindex="-1"
	aria-hidden="true"
	onchange={onPicked}
/>

{#if notice}
	<p class="notice error" role="alert">{notice}</p>
{/if}

{#if items.length}
	<ul class="items">
		{#each items as item (item.id)}
			<li class="item {item.status}">
				<!-- Formats the browser cannot preview (e.g. HEIC) just show a blank tile. -->
				<img
					src={item.previewUrl}
					alt=""
					onerror={(event) => ((event.currentTarget as HTMLImageElement).style.visibility = 'hidden')}
				/>
				<div class="info">
					<span class="file-name">{item.status === 'done' ? item.message : item.file.name}</span>
					<span class="status" role={item.status === 'error' ? 'alert' : undefined}>
						{#if item.status === 'ready'}
							Ready to upload
						{:else if item.status === 'uploading'}
							Uploading…
						{:else if item.status === 'done'}
							Saved
						{:else}
							{item.message}
						{/if}
					</span>
				</div>
				{#if item.status === 'ready' || item.status === 'error'}
					<button
						type="button"
						class="link-btn"
						onclick={() => remove(item)}
						disabled={uploading}
						aria-label="Remove {item.file.name}"
					>
						Remove
					</button>
				{/if}
			</li>
		{/each}
	</ul>

	<div class="card submit">
		<label>
			<span class="small muted">Label added to the file names (optional)</span>
			<input bind:value={label} maxlength="60" placeholder="e.g. Taxi to airport" disabled={uploading} />
		</label>
		<div class="actions">
			<button type="button" class="btn primary" onclick={uploadAll} disabled={uploading || !pending.length}>
				{#if uploading}
					Uploading…
				{:else if !pending.length}
					All uploaded
				{:else}
					Upload {pending.length} receipt{pending.length === 1 ? '' : 's'}
				{/if}
			</button>
			{#if finished.length && !uploading}
				<button type="button" class="btn" onclick={() => finished.forEach(remove)}>
					Clear uploaded
				</button>
			{/if}
		</div>
	</div>
{/if}

{#if cameraOpen}
	<CameraCapture oncapture={(file) => add([file])} onclose={() => (cameraOpen = false)} />
{/if}

<style>
	.dropzone {
		display: grid;
		justify-items: center;
		gap: 1rem;
		padding: 2rem 1rem;
		border: 2px dashed var(--border);
		border-radius: 14px;
		background: var(--surface);
		text-align: center;
	}

	.dropzone.dragging {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 6%, var(--surface));
	}

	.drop-hint {
		color: var(--muted);
	}

	.touch-picker {
		display: none;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		gap: 0.75rem;
	}

	.tile {
		display: grid;
		justify-items: center;
		align-content: center;
		gap: 0.6rem;
		min-height: 8.5rem;
		padding: 1.25rem 1rem;
		border: 1px solid var(--border);
		border-radius: 14px;
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-size: 1.05rem;
		font-weight: 600;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.tile:active {
		border-color: var(--accent);
	}

	.tile.primary {
		background: var(--ink);
		border-color: var(--ink);
		color: #fff;
	}

	.tile svg {
		width: 2.25rem;
		height: 2.25rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	/* Touch devices can't drag files, so swap the drop zone for tap targets. Matches
	   on input type (phones, tablets of any size) or on a phone-sized viewport. */
	@media (pointer: coarse), (max-width: 40rem) {
		.dropzone {
			display: none;
		}

		.touch-picker {
			display: grid;
		}
	}

	.actions {
		justify-content: center;
	}

	.notice {
		margin-top: 1rem;
	}

	.items {
		list-style: none;
		margin: 1rem 0;
		padding: 0;
		display: grid;
		gap: 0.5rem;
	}

	.item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0.75rem 0.5rem 0.5rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}

	.item img {
		width: 56px;
		height: 56px;
		flex: none;
		object-fit: cover;
		border-radius: 6px;
		background: var(--soft);
	}

	.info {
		flex: 1;
		min-width: 0;
		display: grid;
	}

	.file-name {
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.status {
		font-size: 0.875rem;
		color: var(--muted);
	}

	.item.done .status {
		color: var(--success);
	}

	.item.error .status {
		color: var(--danger);
	}

	.submit {
		display: grid;
		gap: 1rem;
	}

	.submit label {
		display: grid;
		gap: 0.3rem;
	}

	.submit .actions {
		justify-content: flex-start;
	}
</style>
