<script lang="ts">
	import SignaturePad from 'signature_pad';
	import { onMount } from 'svelte';
	import type { Signature, SignatureDraft } from '$lib/invoice';
	import {
		forgetSignature,
		loadSavedSignature,
		rememberSignature,
		savedSignature
	} from '$lib/saved-signature.svelte';
	import LocalTime from './LocalTime.svelte';

	let {
		label,
		signed,
		draft = $bindable()
	}: {
		label: string;
		/** A signature already on the invoice: shown read-only. */
		signed?: Signature;
		/** The signature being added; undefined until something is drawn. */
		draft?: SignatureDraft;
	} = $props();

	const MAX_WIDTH = 600;
	const MAX_HEIGHT = 240;

	let image = $state('');
	let name = $state('');
	// 'draw' shows the pad; 'image' shows a reused saved signature.
	let mode = $state<'draw' | 'image'>('draw');
	let pad: SignaturePad | undefined;

	const saved = $derived(savedSignature.value);
	const isSaved = $derived(!!saved && saved.image === image && saved.name === name.trim());

	onMount(loadSavedSignature);

	function emit() {
		draft = image ? { image, name: name.trim() } : undefined;
	}

	/** The drawn strokes cropped to their bounding box and scaled to a sane size. */
	function exportDrawing(canvas: HTMLCanvasElement): string {
		const { width, height } = canvas;
		const pixels = canvas.getContext('2d')!.getImageData(0, 0, width, height).data;
		let left = width;
		let top = height;
		let right = -1;
		let bottom = -1;
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				if (pixels[(y * width + x) * 4 + 3] === 0) continue;
				if (x < left) left = x;
				if (x > right) right = x;
				if (y < top) top = y;
				if (y > bottom) bottom = y;
			}
		}
		if (right < 0) return '';

		const margin = 4;
		left = Math.max(0, left - margin);
		top = Math.max(0, top - margin);
		const w = Math.min(width, right + margin + 1) - left;
		const h = Math.min(height, bottom + margin + 1) - top;
		const scale = Math.min(1, MAX_WIDTH / w, MAX_HEIGHT / h);

		const out = document.createElement('canvas');
		out.width = Math.max(1, Math.round(w * scale));
		out.height = Math.max(1, Math.round(h * scale));
		out.getContext('2d')!.drawImage(canvas, left, top, w, h, 0, 0, out.width, out.height);
		return out.toDataURL('image/png');
	}

	function attachPad(canvas: HTMLCanvasElement) {
		const instance = new SignaturePad(canvas, { penColor: '#111a3a', minWidth: 0.7, maxWidth: 2.3 });
		pad = instance;

		// Match the canvas resolution to its displayed size, keeping any strokes.
		const resize = () => {
			const ratio = Math.max(window.devicePixelRatio || 1, 1);
			const width = Math.round(canvas.clientWidth * ratio);
			const height = Math.round(canvas.clientHeight * ratio);
			if (!width || (canvas.width === width && canvas.height === height)) return;
			const strokes = instance.toData();
			canvas.width = width;
			canvas.height = height;
			canvas.getContext('2d')!.scale(ratio, ratio);
			instance.fromData(strokes);
		};
		const observer = new ResizeObserver(resize);
		observer.observe(canvas);
		resize();

		instance.addEventListener('endStroke', () => {
			image = exportDrawing(canvas);
			emit();
		});

		return () => {
			observer.disconnect();
			instance.off();
			pad = undefined;
		};
	}

	function clear() {
		pad?.clear();
		image = '';
		mode = 'draw';
		emit();
	}

	function useSaved() {
		if (!saved) return;
		image = saved.image;
		if (!name.trim()) name = saved.name;
		mode = 'image';
		emit();
	}
</script>

<div class="signature">
	<h3>{label}</h3>

	{#if signed}
		<div class="box"><img src={signed.image} alt="Signature of {signed.name}" /></div>
		<p class="signer">{signed.name}</p>
		<p class="small muted">Signed <LocalTime iso={signed.signedAt} /></p>
	{:else}
		<div class="box">
			{#if mode === 'image'}
				<img src={image} alt="Your saved signature" />
			{:else}
				<canvas {@attach attachPad} aria-label="{label} signature: draw here"></canvas>
				{#if !image}
					<span class="placeholder">Sign here</span>
				{/if}
			{/if}
		</div>

		<div class="tools">
			{#if image}
				<button type="button" class="link-btn" onclick={clear}>
					{mode === 'image' ? 'Draw instead' : 'Clear'}
				</button>
			{/if}
			{#if saved && saved.image !== image}
				<button type="button" class="link-btn" onclick={useSaved}>Use saved signature</button>
			{/if}
			{#if image && !isSaved}
				<button
					type="button"
					class="link-btn"
					onclick={() => rememberSignature({ image, name: name.trim() })}
				>
					Save on this device
				</button>
			{/if}
			{#if isSaved}
				<button type="button" class="link-btn danger" onclick={forgetSignature}>
					Forget saved signature
				</button>
			{/if}
		</div>

		<label>
			<span class="small muted">Name of signer</span>
			<input bind:value={name} oninput={emit} maxlength="100" autocomplete="name" />
		</label>
	{/if}
</div>

<style>
	.signature {
		display: grid;
		gap: 0.5rem;
		align-content: start;
	}

	h3 {
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--muted);
	}

	.box {
		position: relative;
		height: 150px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: #fff;
		display: grid;
		place-items: center;
		overflow: hidden;
	}

	canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		touch-action: none;
		cursor: crosshair;
	}

	.box img {
		width: calc(100% - 2rem);
		height: calc(100% - 2rem);
		object-fit: contain;
	}

	.placeholder {
		color: #b6bcc8;
		pointer-events: none;
		user-select: none;
	}

	.tools {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1rem;
		min-height: 1.75rem;
	}

	.link-btn.danger {
		color: var(--danger);
	}

	.signer {
		font-weight: 600;
	}

	label {
		display: grid;
		gap: 0.3rem;
	}
</style>
