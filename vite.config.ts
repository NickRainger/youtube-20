import tailwindcss from '@tailwindcss/vite';
import { withPwa } from '@vite-pwa/sveltekit';
import adapter from '@sveltejs/adapter-node';
import { defineConfig } from 'vite';

export default defineConfig({
	server: {
		host: '127.0.0.1',
		port: 5173
	},
	plugins: [
		tailwindcss(),
		withPwa(
			{
				compilerOptions: {
					runes: ({ filename }: { filename: string }) =>
						filename.split(/[/\\]/).includes('node_modules') ? undefined : true
				},
				adapter: adapter()
			},
			{
				strategy: 'generateSW',
				registerType: 'autoUpdate',
				manifest: {
					name: 'YouTube 2.0',
					short_name: 'YT 2.0',
					description: 'Soepel kijken zonder Shorts en zonder advertenties',
					theme_color: '#e11d2e',
					background_color: '#e8eef2',
					display: 'standalone',
					orientation: 'any',
					start_url: '/',
					lang: 'nl',
					icons: [
						{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
						{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
						{
							src: 'icons/icon-512-maskable.png',
							sizes: '512x512',
							type: 'image/png',
							purpose: 'maskable'
						}
					]
				},
				generateSW: {
					navigateFallback: '/',
					globStrict: false,
					globPatterns: ['client/**/*.{js,css,ico,png,svg,webp,webmanifest}', 'prerendered/**/*.{html,json}']
				},
				devOptions: { enabled: true }
			}
		)
	]
});
