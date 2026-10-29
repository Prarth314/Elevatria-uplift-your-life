import test from "node:test";
import assert from "node:assert/strict";
import { workspaceRequest, ApiError } from "../src/server/workspace-service.ts";
import type {
	WorkspaceRepository,
	CloudDocument,
} from "../src/server/workspace-service.ts";
import { sampleWorkspace } from "../src/frontend/src/planner/sample.ts";
import { supabaseDependencies } from "../src/server/supabase-repository.ts";
function service() {
	const documents = new Map<string, CloudDocument>();
	const repository: WorkspaceRepository = {
		async read(owner) {
			return structuredClone(documents.get(owner) ?? null);
		},
		async write(owner, revision, workspace) {
			if ((documents.get(owner)?.revision ?? 0) !== revision) return null;
			const result = {
				revision: revision + 1,
				workspace: structuredClone(workspace),
			};
			documents.set(owner, result);
			return structuredClone(result);
		},
		async remove(owner, revision) {
			if (documents.get(owner)?.revision !== revision) return false;
			return documents.delete(owner);
		},
	};
	return {
		authenticate: async (token: string) =>
			token === "token-a" ? "user-a" : token === "token-b" ? "user-b" : null,
		repository,
	};
}
const status = (expected: number) => (error: unknown) =>
	error instanceof ApiError && error.status === expected;
test("API derives ownership from verified identity; two users cannot read or overwrite each other", async () => {
	const deps = service(),
		a = sampleWorkspace(),
		b = sampleWorkspace();
	b.goals[0].title = "Private B";
	await workspaceRequest(
		{
			method: "PUT",
			token: "token-a",
			body: { workspace: a, expectedRevision: 0 },
		},
		deps,
	);
	await assert.rejects(
		() => workspaceRequest({ method: "GET", token: "token-b" }, deps),
		status(404),
	);
	await workspaceRequest(
		{
			method: "PUT",
			token: "token-b",
			body: { workspace: b, expectedRevision: 0 },
		},
		deps,
	);
	assert.deepEqual(
		(
			(await workspaceRequest(
				{ method: "GET", token: "token-a" },
				deps,
			)) as CloudDocument
		).workspace,
		a,
	);
	await assert.rejects(
		() =>
			workspaceRequest(
				{
					method: "PUT",
					token: "token-b",
					body: { ownerId: "user-a", workspace: b, expectedRevision: 1 },
				},
				deps,
			),
		status(400),
	);
	await assert.rejects(
		() =>
			workspaceRequest(
				{
					method: "DELETE",
					token: "token-b",
					body: { ownerId: "user-a", expectedRevision: 1 },
				},
				deps,
			),
		status(400),
	);
});
test("cloud mutations reject absent authentication, malformed plans, stale writes, stale deletion, and oversized documents", async () => {
	const deps = service(),
		workspace = sampleWorkspace();
	await assert.rejects(
		() => workspaceRequest({ method: "GET", token: "" }, deps),
		status(401),
	);
	await assert.rejects(
		() => workspaceRequest({ method: "GET", token: "invalid" }, deps),
		status(401),
	);
	await assert.rejects(
		() => workspaceRequest({ method: "PATCH", token: "token-a" }, deps),
		status(405),
	);
	await assert.rejects(
		() =>
			workspaceRequest(
				{
					method: "PUT",
					token: "token-a",
					body: { workspace: { version: 2 }, expectedRevision: 0 },
				},
				deps,
			),
		status(422),
	);
	await workspaceRequest(
		{
			method: "PUT",
			token: "token-a",
			body: { workspace, expectedRevision: 0 },
		},
		deps,
	);
	await assert.rejects(
		() =>
			workspaceRequest(
				{
					method: "PUT",
					token: "token-a",
					body: { workspace, expectedRevision: 0 },
				},
				deps,
			),
		status(409),
	);
	await assert.rejects(
		() =>
			workspaceRequest(
				{ method: "DELETE", token: "token-a", body: { expectedRevision: 0 } },
				deps,
			),
		status(409),
	);
	workspace.items[0].image =
		"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZrYcAAAAASUVORK5CYII" +
		"A".repeat(1_050_001);
	await assert.rejects(
		() =>
			workspaceRequest(
				{
					method: "PUT",
					token: "token-a",
					body: { workspace, expectedRevision: 1 },
				},
				deps,
			),
		status(413),
	);
	await workspaceRequest(
		{ method: "DELETE", token: "token-a", body: { expectedRevision: 1 } },
		deps,
	);
	await assert.rejects(
		() => workspaceRequest({ method: "GET", token: "token-a" }, deps),
		status(404),
	);
});
test("Supabase adapter uses verified IDs and privileged headers only on the server; infrastructure failure is visible", async () => {
	const calls: { url: string; init?: RequestInit }[] = [];
	const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
		calls.push({ url: String(url), init });
		if (String(url).endsWith("/auth/v1/user"))
			return Response.json({
				id: "11111111-1111-4111-8111-111111111111",
				app_metadata: { providers: ["github"] },
			});
		return Response.json([]);
	};
	const deps = supabaseDependencies(
		{
			url: "https://example.supabase.co",
			publishableKey: "test-public",
			secretKey: "sb_secret_test",
		},
		fetcher as typeof fetch,
	);
	await assert.rejects(
		() => workspaceRequest({ method: "GET", token: "valid" }, deps),
		status(404),
	);
	assert.ok(calls[1].url.endsWith("/rest/v1/rpc/read_workspace"));
	assert.equal(
		(calls[0].init?.headers as Record<string, string>).apikey,
		"test-public",
	);
	assert.equal(
		(calls[1].init?.headers as Record<string, string>).apikey,
		"sb_secret_test",
	);
	assert.ok(calls.every((call) => call.init?.redirect === "error"));
	const down = supabaseDependencies(
		{
			url: "https://example.supabase.co",
			publishableKey: "test-public",
			secretKey: "test-secret",
		},
		(async () => {
			throw Error("network");
		}) as typeof fetch,
	);
	await assert.rejects(
		() => workspaceRequest({ method: "GET", token: "valid" }, down),
		status(503),
	);
});

test("Supabase adapter rejects anonymous/non-GitHub identities, malformed replies, and shared rate-limit errors", async () => {
	const config = {
		url: "https://example.supabase.co",
		publishableKey: "test-public",
		secretKey: "test-secret",
	};
	for (const identity of [
		null,
		{},
		{ id: "bad", app_metadata: { providers: ["github"] } },
		{
			id: "11111111-1111-4111-8111-111111111111",
			is_anonymous: true,
			app_metadata: { providers: ["github"] },
		},
		{
			id: "11111111-1111-4111-8111-111111111111",
			app_metadata: { providers: ["email"] },
		},
	]) {
		const deps = supabaseDependencies(config, (async () =>
			Response.json(identity)) as typeof fetch);
		assert.equal(await deps.authenticate("synthetic-token"), null);
	}
	const board = sampleWorkspace();
	const malformed = supabaseDependencies(config, (async () =>
		Response.json({ unexpected: "object" })) as typeof fetch);
	await assert.rejects(() => malformed.repository.read("owner"), status(502));
	await assert.rejects(
		() => malformed.repository.write("owner", 0, board),
		status(502),
	);
	await assert.rejects(
		() => malformed.repository.remove("owner", 1),
		status(502),
	);
	const throttled = supabaseDependencies(config, (async () =>
		Response.json(
			{ message: "RATE_LIMITED" },
			{ status: 400 },
		)) as typeof fetch);
	await assert.rejects(() => throttled.repository.read("owner"), status(429));
});
