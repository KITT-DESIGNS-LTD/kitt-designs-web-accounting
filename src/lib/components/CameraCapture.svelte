<script lang="ts">
	import { onMount } from 'svelte';

	let { oncapture, onclose }: { oncapture: (file: File) => void; onclose: () => void } = $props();

	let video = $state<HTMLVideoElement>();
	let ready = $state(false);
	let failure = $state('');
	let taken = $state(0);

	onMount(() => {
		let stream: MediaStream | undefined;
		let cancelled = false;

		navigator.mediaDevices
			.getUserMedia({
				audio: false,
				video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1440 } }
			})
			.then((result) => {
				if (cancelled || !video) {
					result.getTracks().forEach((track) => track.stop());
					return;
				}
				stream = result;
				video.srcObject = result;
				return video.play();
			})
			.catch((err: unknown) => {
				failure =
					err instanceof DOMException && err.name === 'NotAllowedError'
						? 'Camera access was blocked. Allow it in your browser to take photos.'
						: 'No camera could be started on this device.';
			});

		return () => {
			cancelled = true;
			stream?.getTracks().forEach((track) => track.stop());
		};
	});

	function capture() {
		if (!video || !ready) return;
		const canvas = document.createElement('canvas');
		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;
		canvas.getContext('2d')!.drawImage(video, 0, 0);
		canvas.toBlob(
			(blob) => {
				if (!blob) return;
				oncapture(new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' }));
				taken += 1;
			},
			'image/jpeg',
			0.92
		);
	}
</script>

<dialog {@attach (dialog) => dialog.showModal()} {onclose} aria-label="Take a photo">
	{#if failure}
		<p class="notice error">{failure}</p>
	{:else}
		<!-- svelte-ignore a11y_media_has_caption -->
		<video bind:this={video} playsinline muted onloadedmetadata={() => (ready = true)}></video>
	{/if}
	<div class="actions">
		{#if !failure}
			<button type="button" class="btn primary" onclick={capture} disabled={!ready}>
				Take photo
			</button>
		{/if}
		<button type="button" class="btn" onclick={onclose}>
			{taken ? `Done (${taken} taken)` : 'Close'}
		</button>
	</div>
</dialog>

<style>
	dialog {
		width: min(94vw, 760px);
		padding: 1rem;
		border: 0;
		border-radius: 14px;
	}

	dialog::backdrop {
		background: rgb(10 14 25 / 0.7);
	}

	video {
		display: block;
		width: 100%;
		max-height: 70dvh;
		border-radius: 8px;
		background: #000;
	}

	.actions {
		justify-content: center;
		margin-top: 1rem;
	}
</style>
