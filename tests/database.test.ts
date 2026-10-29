import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { sampleWorkspace } from "../src/frontend/src/planner/sample.ts";

test("security migration enforces shared rate limits, blocks direct browser reads, and prevents revision reuse after deletion", async () => {
	const db = new PGlite();
	const a = "11111111-1111-4111-8111-111111111111",
		b = "22222222-2222-4222-8222-222222222222";
	try {
		await db.exec(
			`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
		);
		await db.query("insert into auth.users values($1),($2)", [a, b]);
		for (const file of ["001_workspace_storage.sql", "002_security_limits.sql"])
			await db.exec(
				await readFile(
					new URL("../database/migrations/" + file, import.meta.url),
					"utf8",
				),
			);
		await db.exec("set role service_role");
		const save = async (owner: string, revision: number) =>
			db.query<{ revision: number }>(
				"select * from public.save_workspace($1,$2,$3::jsonb)",
				[owner, revision, JSON.stringify(sampleWorkspace())],
			);
		const first = Number((await save(a, 0)).rows[0].revision);
		await db.query("select public.delete_workspace($1,$2)", [a, first]);
		const recreated = Number((await save(a, 0)).rows[0].revision);
		assert.ok(recreated > first);
		assert.equal((await save(a, first)).rows.length, 0);
		await save(b, 0);
		await db.exec("reset role;set role authenticated");
		await db.query("select set_config('request.jwt.claim.sub',$1,false)", [a]);
		await assert.rejects(
			() => db.query("select * from public.workspaces"),
			/permission denied/,
		);
		await assert.rejects(
			() => db.query("select * from public.read_workspace($1)", [a]),
			/permission denied/,
		);
		await assert.rejects(
			() => db.query("select public.check_workspace_rate_limit($1)", [a]),
			/permission denied/,
		);
		await db.exec(
			"reset role;set role service_role;truncate public.workspace_request_limits",
		);
		for (let i = 0; i < 60; i++)
			await db.query("select * from public.read_workspace($1)", [a]);
		await assert.rejects(
			() => db.query("select * from public.read_workspace($1)", [a]),
			/RATE_LIMITED/,
		);
		assert.equal(
			(await db.query("select * from public.read_workspace($1)", [b])).rows
				.length,
			1,
		);
		await db.query(
			"update public.workspace_request_limits set window_start=clock_timestamp()-interval '2 minutes' where owner_id=$1",
			[a],
		);
		assert.equal(
			(await db.query("select * from public.read_workspace($1)", [a])).rows
				.length,
			1,
		);
	} finally {
		await db.close();
	}
});
test("PostgreSQL migration executes: RLS isolates users, direct writes are denied, RPC uses atomic revisions", async () => {
	const db = new PGlite();
	const a = "11111111-1111-4111-8111-111111111111",
		b = "22222222-2222-4222-8222-222222222222";
	try {
		await db.exec(
			`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
		);
		await db.query("insert into auth.users values ($1),($2)", [a, b]);
		await db.exec(
			await readFile(
				new URL(
					"../database/migrations/001_workspace_storage.sql",
					import.meta.url,
				),
				"utf8",
			),
		);
		const board = sampleWorkspace();
		await db.exec("set role service_role");
		const first = await db.query<{ revision: number }>(
			"select * from public.save_workspace($1,0,$2::jsonb)",
			[a, JSON.stringify(board)],
		);
		assert.equal(Number(first.rows[0].revision), 1);
		assert.equal(
			(
				await db.query("select * from public.save_workspace($1,0,$2::jsonb)", [
					a,
					JSON.stringify(board),
				])
			).rows.length,
			0,
		);
		await db.query("select * from public.save_workspace($1,0,$2::jsonb)", [
			b,
			JSON.stringify(board),
		]);
		assert.equal(
			(
				await db.query("select * from public.save_workspace($1,1,$2::jsonb)", [
					a,
					JSON.stringify(board),
				])
			).rows.length,
			1,
		);
		assert.equal(
			(
				await db.query("select * from public.save_workspace($1,1,$2::jsonb)", [
					a,
					JSON.stringify(board),
				])
			).rows.length,
			0,
		);
		await db.exec("reset role;set role authenticated");
		await db.query("select set_config('request.jwt.claim.sub',$1,false)", [a]);
		assert.deepEqual(
			(
				await db.query<{ owner_id: string }>(
					"select owner_id from public.workspaces",
				)
			).rows,
			[{ owner_id: a }],
		);
		assert.equal(
			(await db.query("select * from public.workspaces where owner_id=$1", [b]))
				.rows.length,
			0,
		);
		await assert.rejects(
			() =>
				db.query("update public.workspaces set revision=99 where owner_id=$1", [
					a,
				]),
			/permission denied/,
		);
		await assert.rejects(
			() =>
				db.query("select * from public.save_workspace($1,2,$2::jsonb)", [
					a,
					JSON.stringify(board),
				]),
			/permission denied/,
		);
		await db.query("select set_config('request.jwt.claim.sub',$1,false)", [b]);
		assert.deepEqual(
			(
				await db.query<{ owner_id: string }>(
					"select owner_id from public.workspaces",
				)
			).rows,
			[{ owner_id: b }],
		);
		await db.exec("reset role;set role anon");
		await assert.rejects(
			() => db.query("select * from public.workspaces"),
			/permission denied/,
		);
		await db.exec("reset role;set role service_role");
		assert.equal(
			(
				await db.query<{ deleted: boolean }>(
					"select public.delete_workspace($1,1) as deleted",
					[a],
				)
			).rows[0].deleted,
			false,
		);
		assert.equal(
			(
				await db.query<{ deleted: boolean }>(
					"select public.delete_workspace($1,2) as deleted",
					[a],
				)
			).rows[0].deleted,
			true,
		);
		assert.equal(
			(await db.query("select * from public.workspaces where owner_id=$1", [b]))
				.rows.length,
			1,
		);
	} finally {
		await db.close();
	}
});
