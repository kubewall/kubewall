export {};

self.onmessage = (e: MessageEvent) => {
	try {
		// @ts-expect-error self typing in worker context
		const ctx: DedicatedWorkerGlobalScope = self as any;
		const { id, text } = (e as any).data || {};
		let data: any = undefined;
		try {
			data = JSON.parse(text);
			ctx.postMessage({ id, ok: true, data });
		} catch (error) {
			ctx.postMessage({ id, ok: false, error: String(error) });
		}
	} catch (err) {
		// swallow
	}
};
