import type { SessionData } from '#lib/server/session';

declare global {
	namespace App {
		interface Locals {
			session: SessionData | null;
			googleConfigured: boolean;
		}
	}
}

export {};
